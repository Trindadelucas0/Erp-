import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../banco-dados/cliente-prisma.js', () => ({
  clientePrisma: {
    job: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

vi.mock('./worker-jobs.js', () => ({
  acordarWorkerJobs: vi.fn(),
}))

import { clientePrisma } from '../banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../erros/ErroDaAplicacao.js'
import { repositorioJobs } from './repositorio-jobs.js'
import { servicoJobs } from './servico-jobs.js'
import { jobAtivoEstaTravado } from './tipos-job.js'

/** `$transaction(callback)` executando contra o próprio mock do Prisma. */
function transacaoDireta() {
  vi.mocked(clientePrisma.$transaction).mockImplementation(
    (async (callback: (tx: unknown) => Promise<unknown>) => callback(clientePrisma)) as never
  )
}

const jobPendente = {
  id: 'job-1',
  companyId: 'empresa-1',
  tipo: 'focus_sync',
  status: 'pendente',
  tentativas: 0,
  maxTentativas: 1,
  createdAt: new Date(),
  iniciadoEm: null,
}

describe('enfileirar — dedupe por chave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transacaoDireta()
  })

  it('cria o job quando não há outro ativo para a mesma chave', async () => {
    vi.mocked(clientePrisma.job.findFirst).mockResolvedValue(null as never)
    vi.mocked(clientePrisma.job.create).mockResolvedValue(jobPendente as never)

    const resultado = await servicoJobs.enfileirar({
      companyId: 'empresa-1',
      tipo: 'focus_sync',
      chaveDedupe: 'sync',
    })

    expect(resultado).toEqual({ jobId: 'job-1', status: 'pendente', criado: true })
    expect(clientePrisma.job.create).toHaveBeenCalledTimes(1)
  })

  it('recusa com 409 quando já existe job ativo da mesma chave', async () => {
    vi.mocked(clientePrisma.job.findFirst).mockResolvedValue(
      { ...jobPendente, status: 'rodando' } as never
    )

    const promessa = servicoJobs.enfileirar({
      companyId: 'empresa-1',
      tipo: 'focus_sync',
      chaveDedupe: 'sync',
      mensagemConflito: 'Já existe uma sincronização Focus em andamento para esta empresa.',
    })

    await expect(promessa).rejects.toBeInstanceOf(ErroDaAplicacao)
    await expect(promessa).rejects.toMatchObject({
      codigoHttp: 409,
      message: 'Já existe uma sincronização Focus em andamento para esta empresa.',
    })
    expect(clientePrisma.job.create).not.toHaveBeenCalled()
  })

  it('reusa o job ativo quando reusarAtivo=true (BUSCAR acompanha o agendador)', async () => {
    vi.mocked(clientePrisma.job.findFirst).mockResolvedValue(
      { ...jobPendente, status: 'rodando', iniciadoEm: new Date() } as never
    )

    const resultado = await servicoJobs.enfileirar({
      companyId: 'empresa-1',
      tipo: 'focus_sync',
      chaveDedupe: 'sync',
      reusarAtivo: true,
    })

    expect(resultado).toEqual({ jobId: 'job-1', status: 'rodando', criado: false })
    expect(clientePrisma.job.create).not.toHaveBeenCalled()
  })

  it('abandona job pendente travado e cria outro quando reusarAtivo', async () => {
    const antigo = {
      ...jobPendente,
      createdAt: new Date(Date.now() - 120_000),
    }
    vi.mocked(clientePrisma.job.findFirst)
      .mockResolvedValueOnce(antigo as never)
      .mockResolvedValueOnce(null as never)
    vi.mocked(clientePrisma.job.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(clientePrisma.job.create).mockResolvedValue({
      ...jobPendente,
      id: 'job-2',
    } as never)

    const resultado = await servicoJobs.enfileirar({
      companyId: 'empresa-1',
      tipo: 'focus_sync',
      chaveDedupe: 'sync',
      reusarAtivo: true,
    })

    expect(clientePrisma.job.updateMany).toHaveBeenCalled()
    expect(resultado).toEqual({ jobId: 'job-2', status: 'pendente', criado: true })
  })

  it('serializa o dedupe com advisory lock antes de consultar', async () => {
    vi.mocked(clientePrisma.job.findFirst).mockResolvedValue(null as never)
    vi.mocked(clientePrisma.job.create).mockResolvedValue(jobPendente as never)

    await servicoJobs.enfileirar({
      companyId: 'empresa-1',
      tipo: 'ia_conferencia',
      chaveDedupe: 'pedido:abc',
    })

    expect(clientePrisma.$executeRaw).toHaveBeenCalledTimes(1)
    const [fragmentos, valor] = vi.mocked(clientePrisma.$executeRaw).mock.calls[0] as [
      TemplateStringsArray,
      string,
    ]
    expect(fragmentos.join('?')).toContain('pg_advisory_xact_lock')
    expect(valor).toBe('job:empresa-1:ia_conferencia:pedido:abc')
  })
})

describe('reivindicarProximo — claim com SKIP LOCKED', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca o job como rodando e devolve o payload', async () => {
    vi.mocked(clientePrisma.$queryRaw).mockResolvedValue([
      { id: 'job-1', companyId: 'empresa-1', tipo: 'focus_sync', payloadJson: { completo: true } },
    ] as never)

    const job = await repositorioJobs.reivindicarProximo('host#1')

    expect(job).toMatchObject({ id: 'job-1', tipo: 'focus_sync' })
    const sql = (vi.mocked(clientePrisma.$queryRaw).mock.calls[0][0] as TemplateStringsArray).join(
      '?'
    )
    expect(sql).toContain('FOR UPDATE SKIP LOCKED')
    expect(sql).toContain("status = 'rodando'")
    expect(sql).toContain('tentativas = tentativas + 1')
  })

  // As colunas são `timestamp` sem fuso e o Prisma grava em UTC; `NOW()` puro
  // usa o fuso da sessão do Postgres e esconderia o job por horas.
  it('compara datas em UTC, não no fuso da sessão do Postgres', async () => {
    vi.mocked(clientePrisma.$queryRaw).mockResolvedValue([] as never)

    await repositorioJobs.reivindicarProximo('host#1')

    const sql = (vi.mocked(clientePrisma.$queryRaw).mock.calls[0][0] as TemplateStringsArray).join(
      '?'
    )
    expect(sql).toContain(`"agendadoPara" <= (NOW() AT TIME ZONE 'UTC')`)
    expect(sql).not.toMatch(/NOW\(\)(?! AT TIME ZONE)/)
  })

  it('devolve null quando a fila está vazia', async () => {
    vi.mocked(clientePrisma.$queryRaw).mockResolvedValue([] as never)
    expect(await repositorioJobs.reivindicarProximo('host#1')).toBeNull()
  })
})

describe('recuperarOrfaos — job interrompido por reinício da API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devolve à fila apenas jobs rodando sem heartbeat recente', async () => {
    vi.mocked(clientePrisma.$executeRaw).mockResolvedValue(1 as never)

    const recuperados = await repositorioJobs.recuperarOrfaos()

    expect(recuperados).toBe(1)
    const chamada = vi.mocked(clientePrisma.$executeRaw).mock.calls[0] as unknown as unknown[]
    const fragmentos = chamada[0] as TemplateStringsArray
    const sql = fragmentos.join('?')
    expect(sql).toContain(`status = 'rodando'`)
    expect(sql).toContain('make_interval(secs =>')
    expect(sql).toContain(`(NOW() AT TIME ZONE 'UTC')`)
    // Volta para pendente sem consumir tentativa, para o worker reexecutar.
    expect(sql).toContain(`THEN 'pendente' ELSE 'erro'`)
    expect(sql).toContain('GREATEST(tentativas - 1, 0)')
    expect(sql).not.toMatch(/NOW\(\)(?! AT TIME ZONE)/)
    // Prisma injeta MAX_RECUPERACOES várias vezes no CASE; o último param é o TTL em segundos.
    expect(chamada.slice(1, -1).every((v) => v === 1)).toBe(true)
    expect(chamada.at(-1)).toBe(180)
  })
})

describe('registrarFalha — retry x erro final', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fecha como erro quando não há tentativa sobrando', async () => {
    vi.mocked(clientePrisma.job.findUnique).mockResolvedValue({
      ...jobPendente,
      tentativas: 1,
      maxTentativas: 1,
    } as never)

    const status = await repositorioJobs.registrarFalha('job-1', { mensagem: 'falhou' })

    expect(status).toBe('erro')
    expect(vi.mocked(clientePrisma.job.update).mock.calls[0][0]).toMatchObject({
      data: { status: 'erro', mensagem: 'falhou' },
    })
  })

  it('reagenda com backoff quando ainda há tentativa', async () => {
    vi.mocked(clientePrisma.job.findUnique).mockResolvedValue({
      ...jobPendente,
      tentativas: 1,
      maxTentativas: 3,
    } as never)

    const status = await repositorioJobs.registrarFalha('job-1', { mensagem: 'instável' })

    expect(status).toBe('pendente')
    const dados = vi.mocked(clientePrisma.job.update).mock.calls[0][0].data as {
      status: string
      agendadoPara: Date
    }
    expect(dados.status).toBe('pendente')
    expect(dados.agendadoPara.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('statusJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('expõe resultado do handler para o poll da tela', async () => {
    vi.mocked(clientePrisma.job.findFirst).mockResolvedValue({
      ...jobPendente,
      status: 'ok',
      progresso: 100,
      mensagem: 'Conferência concluída.',
      logResumo: null,
      resultadoJson: { statusGeral: 'ok' },
      iniciadoEm: null,
      finalizadoEm: null,
    } as never)

    const job = await servicoJobs.statusJob('empresa-1', 'job-1')

    expect(job).toMatchObject({
      status: 'ok',
      progresso: 100,
      resultado: { statusGeral: 'ok' },
    })
  })

  it('404 quando o job é de outra empresa', async () => {
    vi.mocked(clientePrisma.job.findFirst).mockResolvedValue(null as never)
    await expect(servicoJobs.statusJob('empresa-2', 'job-1')).rejects.toMatchObject({
      codigoHttp: 404,
    })
  })
})

describe('jobAtivoEstaTravado', () => {
  const agora = Date.parse('2026-09-10T13:00:00.000Z')

  it('marca pendente antigo como travado', () => {
    expect(
      jobAtivoEstaTravado(
        { status: 'pendente', createdAt: new Date(agora - 60_000), iniciadoEm: null },
        agora
      )
    ).toBe(true)
  })

  it('não marca pendente recente', () => {
    expect(
      jobAtivoEstaTravado(
        { status: 'pendente', createdAt: new Date(agora - 5_000), iniciadoEm: null },
        agora
      )
    ).toBe(false)
  })
})
