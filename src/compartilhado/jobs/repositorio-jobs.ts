/**
 * Persistência da fila de jobs.
 *
 * O claim usa `FOR UPDATE SKIP LOCKED`: dois workers (ou duas instâncias da API)
 * nunca pegam o mesmo job, sem precisar de Redis.
 */
import { clientePrisma } from '../banco-dados/cliente-prisma.js'
import { STATUS_JOB_ATIVO } from './tipos-job.js'
import type { StatusJob } from './tipos-job.js'

/** Job sem heartbeat há mais que isso é considerado órfão (queda da API). */
export const LOCK_EXPIRA_MS = 3 * 60_000

/** Quantas vezes um job pode ser reexecutado após queda da API. */
const MAX_RECUPERACOES = 1

export type JobReivindicado = {
  id: string
  companyId: string
  tipo: string
  payloadJson: unknown
}

async function criar(dados: {
  companyId: string
  tipo: string
  chaveDedupe?: string | null
  payloadJson?: unknown
  maxTentativas?: number
}) {
  return clientePrisma.job.create({
    data: {
      companyId: dados.companyId,
      tipo: dados.tipo,
      status: 'pendente',
      chaveDedupe: dados.chaveDedupe ?? null,
      payloadJson: (dados.payloadJson ?? undefined) as object | undefined,
      maxTentativas: dados.maxTentativas ?? 1,
    },
  })
}

async function buscarAtivoPorChave(companyId: string, tipo: string, chaveDedupe: string) {
  return clientePrisma.job.findFirst({
    where: {
      companyId,
      tipo,
      chaveDedupe,
      status: { in: STATUS_JOB_ATIVO as unknown as string[] },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Cria o job garantindo que só exista um ativo por (empresa, tipo, chave).
 * O advisory lock serializa BUSCAR e agendador disputando o mesmo alvo.
 */
async function criarComDedupe(dados: {
  companyId: string
  tipo: string
  chaveDedupe?: string | null
  payloadJson?: unknown
  maxTentativas?: number
}) {
  if (!dados.chaveDedupe) {
    return { job: await criar(dados), criado: true }
  }

  const trava = `job:${dados.companyId}:${dados.tipo}:${dados.chaveDedupe}`
  return clientePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trava}))`

    const ativo = await tx.job.findFirst({
      where: {
        companyId: dados.companyId,
        tipo: dados.tipo,
        chaveDedupe: dados.chaveDedupe,
        status: { in: STATUS_JOB_ATIVO as unknown as string[] },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (ativo) return { job: ativo, criado: false }

    const job = await tx.job.create({
      data: {
        companyId: dados.companyId,
        tipo: dados.tipo,
        status: 'pendente',
        chaveDedupe: dados.chaveDedupe,
        payloadJson: (dados.payloadJson ?? undefined) as object | undefined,
        maxTentativas: dados.maxTentativas ?? 1,
      },
    })
    return { job, criado: true }
  })
}

/**
 * Pega o próximo job pendente e o marca como `rodando`. Null = fila vazia.
 *
 * As colunas são `timestamp` sem fuso e o Prisma grava sempre em UTC, então o
 * SQL cru usa `AGORA_UTC` — `NOW()` puro seria convertido para o fuso da sessão
 * do Postgres e deslocaria a comparação em horas.
 */
async function reivindicarProximo(lockedPor: string): Promise<JobReivindicado | null> {
  const linhas = await clientePrisma.$queryRaw<JobReivindicado[]>`
    UPDATE "Job"
    SET status = 'rodando',
        "lockedAt" = (NOW() AT TIME ZONE 'UTC'),
        "lockedPor" = ${lockedPor},
        "iniciadoEm" = COALESCE("iniciadoEm", (NOW() AT TIME ZONE 'UTC')),
        tentativas = tentativas + 1,
        "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE id = (
      SELECT id FROM "Job"
      WHERE status = 'pendente' AND "agendadoPara" <= (NOW() AT TIME ZONE 'UTC')
      ORDER BY "agendadoPara" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "companyId", tipo, "payloadJson"
  `
  return linhas[0] ?? null
}

async function atualizarProgresso(
  id: string,
  progresso: number,
  mensagem?: string,
  logResumo?: string | null
) {
  await clientePrisma.job.update({
    where: { id },
    data: {
      progresso: Math.max(0, Math.min(100, Math.round(progresso))),
      ...(mensagem === undefined ? {} : { mensagem }),
      ...(logResumo === undefined ? {} : { logResumo }),
      lockedAt: new Date(),
    },
  })
}

/** Renova o lock de um job longo para ele não ser tratado como órfão. */
async function baterHeartbeat(id: string) {
  await clientePrisma.job.updateMany({
    where: { id, status: 'rodando' },
    data: { lockedAt: new Date() },
  })
}

async function finalizarComSucesso(
  id: string,
  dados: { mensagem?: string | null; resultado?: unknown; logResumo?: string | null }
) {
  await clientePrisma.job.update({
    where: { id },
    data: {
      status: 'ok',
      progresso: 100,
      mensagem: dados.mensagem ?? null,
      resultadoJson: (dados.resultado ?? undefined) as object | undefined,
      logResumo: dados.logResumo ?? null,
      finalizadoEm: new Date(),
      lockedAt: null,
      lockedPor: null,
    },
  })
}

/**
 * Falha do handler: reagenda com backoff enquanto houver tentativa sobrando,
 * senão fecha o job como `erro`.
 */
async function registrarFalha(
  id: string,
  dados: { mensagem: string; logResumo?: string | null }
): Promise<StatusJob> {
  const job = await clientePrisma.job.findUnique({ where: { id } })
  if (!job) return 'erro'

  const podeTentarDeNovo = job.tentativas < job.maxTentativas
  if (podeTentarDeNovo) {
    const atrasoMs = Math.min(5 * 60_000, 15_000 * 2 ** (job.tentativas - 1))
    await clientePrisma.job.update({
      where: { id },
      data: {
        status: 'pendente',
        mensagem: dados.mensagem,
        logResumo: dados.logResumo ?? null,
        agendadoPara: new Date(Date.now() + atrasoMs),
        lockedAt: null,
        lockedPor: null,
      },
    })
    return 'pendente'
  }

  await clientePrisma.job.update({
    where: { id },
    data: {
      status: 'erro',
      mensagem: dados.mensagem,
      logResumo: dados.logResumo ?? null,
      finalizadoEm: new Date(),
      lockedAt: null,
      lockedPor: null,
    },
  })
  return 'erro'
}

/**
 * Devolve à fila os jobs que ficaram `rodando` sem heartbeat (queda da API,
 * restart do `tsx watch`, deploy PM2). A reexecução não consome `tentativas`.
 */
async function recuperarOrfaos(): Promise<number> {
  const limite = new Date(Date.now() - LOCK_EXPIRA_MS)
  const afetados = await clientePrisma.$executeRaw`
    UPDATE "Job"
    SET status = CASE WHEN recuperacoes < ${MAX_RECUPERACOES} THEN 'pendente' ELSE 'erro' END,
        tentativas = CASE WHEN recuperacoes < ${MAX_RECUPERACOES} THEN GREATEST(tentativas - 1, 0) ELSE tentativas END,
        recuperacoes = recuperacoes + 1,
        mensagem = CASE
          WHEN recuperacoes < ${MAX_RECUPERACOES} THEN mensagem
          ELSE 'Job interrompido por reinício da API e sem novas tentativas.'
        END,
        "finalizadoEm" = CASE
          WHEN recuperacoes < ${MAX_RECUPERACOES} THEN NULL
          ELSE (NOW() AT TIME ZONE 'UTC')
        END,
        "agendadoPara" = (NOW() AT TIME ZONE 'UTC'),
        "lockedAt" = NULL,
        "lockedPor" = NULL,
        "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE status = 'rodando'
      AND ("lockedAt" IS NULL OR "lockedAt" < ${limite})
  `
  return afetados
}

async function buscarPorId(id: string, companyId: string) {
  return clientePrisma.job.findFirst({ where: { id, companyId } })
}

async function existeAtivo(companyId: string, tipo: string) {
  const total = await clientePrisma.job.count({
    where: { companyId, tipo, status: { in: STATUS_JOB_ATIVO as unknown as string[] } },
  })
  return total > 0
}

export const repositorioJobs = {
  criar,
  criarComDedupe,
  buscarAtivoPorChave,
  reivindicarProximo,
  atualizarProgresso,
  baterHeartbeat,
  finalizarComSucesso,
  registrarFalha,
  recuperarOrfaos,
  buscarPorId,
  existeAtivo,
}
