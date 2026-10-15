import { beforeEach, describe, expect, it, vi } from 'vitest'
import { xmlCusto } from './formacao-custo-fixture.js'
vi.mock('./repositorio-entrada-notas.js', () => ({ repositorioEntradaNotas: { buscarNotaCompleta: vi.fn(), buscarUltimoPrecoConsolidadoPorProduto: vi.fn() } }))
vi.mock('../configuracoes/servico-parametrizacao-custos.js', () => ({ servicoParametrizacaoCustos: { obter: vi.fn() } }))
vi.mock('../configuracoes/servico-regras-fiscais.js', () => ({ servicoRegrasFiscais: { obter: vi.fn() } }))
vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({ registrarAuditoria: vi.fn() }))
vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({ clientePrisma: {
  nfeCteVinculo: { findMany: vi.fn() }, estoqueSaldo: { findMany: vi.fn() },
  produto: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
  custoEntradaAjuste: { findFirst: vi.fn(), upsert: vi.fn() }, custoEntradaMemoria: { findMany: vi.fn(), createMany: vi.fn() }, logDeAuditoria: { create: vi.fn() },
  user: { findMany: vi.fn() },
} }))
import { repositorioEntradaNotas } from './repositorio-entrada-notas.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { servicoParametrizacaoCustos } from '../configuracoes/servico-parametrizacao-custos.js'
import { servicoRegrasFiscais } from '../configuracoes/servico-regras-fiscais.js'
import { servicoPrecificacaoEntrada } from './servico-precificacao-entrada.js'

function nota(modFrete = '1') {
  return { id: 'n', statusEntrada: 'entrada_consolidada', tipoDocumento: 'nfe55', finalidadeEntrada: 'revenda', modFrete,
    xmlConteudo: xmlCusto({ itens: 2, quantidade: '1', desconto: '0', seguro: '0', outras: '0', ipi: '0', pis: '0', cofins: '0' }),
    itens: [60, 40].map((frete, index) => ({ id: `i${index}`, nItem: index + 1, quantidade: 1, valorUnitario: 100, custoFreteRateado: frete,
      cfopEntradaId: 'c', produtoId: `p${index}`, produto: { id: `p${index}`, companyId: 'a', fornecedores: [], precoVenda: 200 } })) } as never
}
describe('integração das regras fiscais na grade e na gravação', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(nota())
    vi.mocked(repositorioEntradaNotas.buscarUltimoPrecoConsolidadoPorProduto).mockResolvedValue(new Map())
    vi.mocked(clientePrisma.estoqueSaldo.findMany).mockResolvedValue([])
    vi.mocked(servicoParametrizacaoCustos.obter).mockResolvedValue({ id: 'cfg', totalVenda: 0 } as never)
    vi.mocked(servicoRegrasFiscais.obter).mockResolvedValue({ mercadoria: { modo: 'pre_definida', aliquota: 12 }, transporte: { modo: 'pre_definida', aliquota: 12 }, operacoes: ['icms', 'icms_frete'].map(tributo => ({ cfopEntradaId: 'c', tributo, cst: '00', recuperabilidade: 'aplicavel', composicao: 'embutido' })) } as never)
    vi.mocked(clientePrisma.nfeCteVinculo.findMany).mockResolvedValue([{ valorFrete: 100, cteRecebida: { xmlConteudo: null } }] as never)
    vi.mocked(clientePrisma.produto.findMany).mockResolvedValue([{ id: 'p0', precoVenda: 200 }, { id: 'p1', precoVenda: 200 }] as never)
    vi.mocked(clientePrisma.custoEntradaAjuste.findFirst).mockResolvedValue(null)
    vi.mocked(clientePrisma.custoEntradaMemoria.findMany).mockResolvedValue([])
    vi.mocked(clientePrisma.user.findMany).mockResolvedValue([])
    vi.mocked(clientePrisma.$queryRaw).mockResolvedValue([])
    vi.mocked(clientePrisma.produto.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(clientePrisma.$transaction).mockImplementation((async (fn: (db: unknown) => unknown) => fn(clientePrisma)) as never)
  })
  it('aplica os dois créditos, filtra CT-es por empresa e não altera preços ao ler', async () => {
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    expect(grade.itens.map((i) => [i.creditoIcms, i.creditoIcmsFrete, i.custoContabil])).toEqual([[12, 7.2, 140.8], [12, 4.8, 123.2]])
    expect(clientePrisma.nfeCteVinculo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'a', nfeRecebidaId: 'n', cteRecebida: { companyId: 'a' } } }))
    expect(clientePrisma.produto.update).not.toHaveBeenCalled()
    expect(grade.itens[0].memoria.componentes.find(c => c.origem === 'icms_frete')).toMatchObject({ base: 60, percentual: 12, credito: 7.2 })
  })
  it('grade retornada após gravar usa os mesmos créditos e consulta a regra vigente', async () => {
    const antes = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    vi.mocked(clientePrisma.custoEntradaMemoria.findMany).mockResolvedValue(antes.itens.map(i => ({ nItem: i.nItem, revisao: antes.revisaoCusto })) as never)
    const depois = await servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', antes.itens.map((i) => ({ produtoId: i.produtoId!, precoVenda: i.precoSugerido!, margemPercentual: 0 })))
    expect(depois.itens.map((i) => i.custoContabil)).toEqual(antes.itens.map((i) => i.custoContabil))
    expect(servicoRegrasFiscais.obter).toHaveBeenCalledTimes(3)
    expect(clientePrisma.produto.updateMany).toHaveBeenCalledTimes(2)
  })
  it('frete remetente não consulta CT-es nem aplica seu crédito', async () => {
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(nota('0'))
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    expect(grade.itens.map((i) => i.creditoIcmsFrete)).toEqual([0, 0])
    expect(clientePrisma.nfeCteVinculo.findMany).not.toHaveBeenCalled()
  })
  it('recusa gravar preço de uma grade aberta antes de a regra mudar', async () => {
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    vi.mocked(servicoRegrasFiscais.obter).mockResolvedValue({ mercadoria: { modo: 'pre_definida', aliquota: 18 }, transporte: { modo: 'pre_definida', aliquota: 12 } })
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 140.8 }], grade.regrasFiscais)).rejects.toMatchObject({ codigoHttp: 409 })
    expect(clientePrisma.produto.update).not.toHaveBeenCalled()
  })
  it('não grava preço sem confirmar custo, mesmo quando não envia margem', async () => {
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 409 })
    expect(clientePrisma.produto.updateMany).not.toHaveBeenCalled()
  })
  it('XML insuficiente bloqueia gravação sem margem e não grava memória', async () => {
    const atual = nota() as unknown as { xmlConteudo: string | null }
    atual.xmlConteudo = null
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(atual as never)
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    expect(grade.itens.every(i => i.estadoCusto === 'pendente')).toBe(true)
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 400 })
    await expect(servicoPrecificacaoEntrada.confirmarCusto('a', 'n', 'u', grade.revisaoCusto, ['i0'])).rejects.toMatchObject({ codigoHttp: 400 })
    expect(clientePrisma.custoEntradaMemoria.createMany).not.toHaveBeenCalled()
  })
  it('confirma memória pelo XML/nItem sem alterar preços e só aceita revisão atual', async () => {
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    await servicoPrecificacaoEntrada.confirmarCusto('a', 'n', 'u', grade.revisaoCusto, ['i0'])
    expect(clientePrisma.custoEntradaMemoria.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ companyId: 'a', nItem: 1, revisao: grade.revisaoCusto, usuarioId: 'u' })], skipDuplicates: true }))
    expect(clientePrisma.produto.updateMany).not.toHaveBeenCalled()
    await expect(servicoPrecificacaoEntrada.confirmarCusto('a', 'n', 'u', 'antiga', ['i0'])).rejects.toMatchObject({ codigoHttp: 409 })
  })
  it('memória anterior permanece mas XML alterado exige nova confirmação', async () => {
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    vi.mocked(clientePrisma.custoEntradaMemoria.findMany).mockResolvedValue([{ nItem: 1, revisao: grade.revisaoCusto }] as never)
    const outra = nota() as unknown as { xmlConteudo: string }; outra.xmlConteudo += ' '
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(outra as never)
    expect((await servicoPrecificacaoEntrada.obterGrade('a', 'n')).itens[0].estadoCusto).toBe('desatualizado')
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 409 })
  })
  it('não aceita item externo nos ajustes, confirmação ou seleção de preço', async () => {
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    await expect(servicoPrecificacaoEntrada.confirmarCusto('a', 'n', 'u', grade.revisaoCusto, ['externo'])).rejects.toMatchObject({ codigoHttp: 400 })
    await expect(servicoPrecificacaoEntrada.salvarAjustes('a', 'n', 'u', grade.revisaoCusto, { decisaoFrete: null, despesas: [], bases: [{ nItem: 99, peso: 1, volume: 1 }] })).rejects.toMatchObject({ codigoHttp: 400 })
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', itemId: 'externo', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 400 })
    expect(clientePrisma.custoEntradaAjuste.upsert).not.toHaveBeenCalled()
  })
  it('produto repetido exige seleção explícita; grava uma linha escolhida', async () => {
    const atual = nota() as unknown as { itens: { produtoId: string; produto: { id: string } }[] }
    atual.itens[1].produtoId = 'p0'; atual.itens[1].produto.id = 'p0'
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(atual as never)
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    vi.mocked(clientePrisma.custoEntradaMemoria.findMany).mockResolvedValue([{ nItem: 2, revisao: grade.revisaoCusto }] as never)
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 400 })
    await servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', itemId: 'i1', precoVenda: 100 }])
    expect(clientePrisma.produto.updateMany).toHaveBeenCalledWith({ where: { id: 'p0', companyId: 'a' }, data: { precoVenda: 100 } })
  })
  it('conflito transacional vira 409 sem substituir histórico', async () => {
    vi.mocked(clientePrisma.$transaction).mockRejectedValue({ code: 'P2034' })
    await expect(servicoPrecificacaoEntrada.confirmarCusto('a', 'n', 'u', 'r', ['i0'])).rejects.toMatchObject({ codigoHttp: 409 })
    expect(clientePrisma.custoEntradaMemoria.createMany).not.toHaveBeenCalled()
  })
  it('vínculo corrompido com produto de outra empresa não expõe a grade', async () => {
    const atual = nota() as unknown as { itens: { produto: { companyId: string } }[] }
    atual.itens[0].produto.companyId = 'b'
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(atual as never)
    await expect(servicoPrecificacaoEntrada.obterGrade('a', 'n')).rejects.toMatchObject({ codigoHttp: 404 })
    expect(clientePrisma.custoEntradaMemoria.findMany).not.toHaveBeenCalled()
  })
})
