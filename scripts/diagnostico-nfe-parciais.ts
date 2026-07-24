/**
 * Diagnóstico: por que só algumas NF-e aparecem / entram no sync.
 * Uso: npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/diagnostico-nfe-parciais.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const configs = await prisma.configuracaoFocusNfe.findMany({
    where: { ativo: true },
    select: {
      companyId: true,
      ultimaVersaoNfeRecebida: true,
      ultimaVersaoNfseRecebida: true,
      ultimaVersaoCteRecebida: true,
      homologacao: true,
      ativo: true,
    },
  })

  if (configs.length === 0) {
    console.log('Nenhuma ConfiguracaoFocusNfe ativa.')
  }

  console.log('=== CONFIG FOCUS + FILTRO MÊS ===')
  for (const cfg of configs) {
    const company = await prisma.company.findUnique({
      where: { id: cfg.companyId },
      select: { name: true, cnpj: true },
    })
    const maxNfe = await prisma.nfeRecebida.aggregate({
      where: { companyId: cfg.companyId, tipoDocumento: 'nfe55' },
      _max: { versaoFocus: true },
      _count: true,
    })
    const porTipo = await prisma.nfeRecebida.groupBy({
      by: ['tipoDocumento'],
      where: { companyId: cfg.companyId },
      _count: true,
    })
    const porMes = await prisma.$queryRaw<Array<{ mes: string; qtd: number }>>`
      SELECT to_char("dataEmissao", 'YYYY-MM') AS mes, COUNT(*)::int AS qtd
      FROM "NfeRecebida"
      WHERE "companyId" = ${cfg.companyId} AND "dataEmissao" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 6
    `
    const semData = await prisma.nfeRecebida.count({
      where: { companyId: cfg.companyId, dataEmissao: null },
    })
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const noMesAtual = await prisma.nfeRecebida.count({
      where: {
        companyId: cfg.companyId,
        dataEmissao: { gte: inicioMes },
      },
    })
    const total = await prisma.nfeRecebida.count({ where: { companyId: cfg.companyId } })
    const cursor = cfg.ultimaVersaoNfeRecebida ?? 0
    const maxSalvo = maxNfe._max.versaoFocus ?? 0
    const gap = cursor > maxSalvo && (maxNfe._count as number) > 0

    console.log(
      JSON.stringify(
        {
          companyId: cfg.companyId,
          nome: company?.name,
          cnpj: company?.cnpj,
          homologacao: cfg.homologacao,
          cursorNfe: cursor,
          cursorNfse: cfg.ultimaVersaoNfseRecebida ?? 0,
          cursorCte: cfg.ultimaVersaoCteRecebida ?? 0,
          maxVersaoSalvaNfe: maxSalvo,
          gapCursorNfe: gap,
          totalNotas: total,
          noMesAtualFiltroPadrao: noMesAtual,
          escondidasPeloFiltroPadrao: Math.max(0, total - noMesAtual - semData),
          semDataEmissao: semData,
          porTipo,
          porMes,
          nfeCount: maxNfe._count,
        },
        null,
        2
      )
    )
  }

  console.log('=== ULTIMOS JOBS SYNC ===')
  const jobs = await prisma.focusNfeJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      companyId: true,
      tipo: true,
      status: true,
      mensagem: true,
      logResumo: true,
      progresso: true,
      createdAt: true,
      finalizadoEm: true,
      payloadJson: true,
    },
  })

  if (jobs.length === 0) {
    console.log('Nenhum FocusNfeJob encontrado.')
  }

  for (const j of jobs) {
    const log = j.logResumo ?? ''
    console.log(
      JSON.stringify(
        {
          id: j.id,
          companyId: j.companyId,
          tipo: j.tipo,
          status: j.status,
          mensagem: j.mensagem,
          progresso: j.progresso,
          createdAt: j.createdAt,
          finalizadoEm: j.finalizadoEm,
          payload: j.payloadJson,
          logTail: log.split('\n').filter(Boolean).slice(-10),
        },
        null,
        2
      )
    )
  }

  const agora = new Date()
  const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const inicioMes = new Date(`${mesRef}-01T00:00:00-03:00`)
  const proximoMes = agora.getMonth() === 11 ? 1 : agora.getMonth() + 2
  const proximoAno = agora.getMonth() === 11 ? agora.getFullYear() + 1 : agora.getFullYear()
  const fimMes = new Date(
    `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01T00:00:00-03:00`
  )

  console.log(`=== COTA MES ${mesRef} (origem=focus) ===`)
  for (const cfg of configs) {
    const usados = await prisma.nfeRecebida.count({
      where: {
        companyId: cfg.companyId,
        origem: 'focus',
        createdAt: { gte: inicioMes, lt: fimMes },
      },
    })
    const cota = Number(process.env.FOCUS_NFE_COTA_MENSAL ?? 100)
    const habilitada = (process.env.FOCUS_NFE_COTA_HABILITADA ?? 'true') !== 'false' && cota > 0
    console.log({
      companyId: cfg.companyId,
      habilitada,
      usadosNoMes: usados,
      cota,
      restantes: habilitada ? Math.max(0, cota - usados) : 'illimitado',
      esgotada: habilitada && usados >= cota,
    })
  }

  console.log('=== RESUMO DIAGNOSTICO ===')
  console.log(
    [
      '1) Filtro lista: padrão = 1º dia do mês → hoje; use Ver todas (sem data).',
      '2) Sync: cada BUSCAR/agendador processa no máx. 10 docs (LIMITE_LOTE_SYNC).',
      '3) Cota: ver bloco acima; se esgotada, agendador pausa e BUSCAR pede extras.',
      '4) gapCursorNfe=true → rodar scripts/reparar-cursor-nfe-focus.ts',
      '5) Jobs: procurar mensagem "Lote de 10", rate limit ou cota.',
    ].join('\n')
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
