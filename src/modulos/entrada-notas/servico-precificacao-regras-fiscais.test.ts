import { beforeEach, describe, expect, it, vi } from 'vitest'
import { xmlCusto } from './formacao-custo-fixture.js'
import { calcularAquisicao, precoPorMargem } from '../../compartilhado/precificacao/calculo-precificacao.js'
vi.mock('./repositorio-entrada-notas.js', () => ({ repositorioEntradaNotas: { buscarNotaCompleta: vi.fn(), buscarUltimoPrecoConsolidadoPorProduto: vi.fn() } }))
vi.mock('../configuracoes/servico-parametrizacao-custos.js', () => ({ servicoParametrizacaoCustos: { obter: vi.fn() } }))
vi.mock('../configuracoes/servico-regras-fiscais.js', () => ({ servicoRegrasFiscais: { obter: vi.fn() } }))
vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({ registrarAuditoria: vi.fn() }))
vi.mock('../../compartilhado/banco-dados/cliente-prisma.js', () => ({ clientePrisma: {
  nfeCteVinculo: { findMany: vi.fn() }, estoqueSaldo: { findMany: vi.fn() },
  produto: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
  nfeRecebidaItem: { updateMany: vi.fn() },
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
    vi.mocked(clientePrisma.nfeRecebidaItem.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(clientePrisma.$transaction).mockImplementation((async (fn: (db: unknown) => unknown) => fn(clientePrisma)) as never)
  })
  it('aplica os dois créditos, filtra CT-es por empresa e não altera preços ao ler', async () => {
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    expect(grade.itens.map((i) => [i.creditoIcms, i.creditoIcmsFrete, i.custoContabil])).toEqual([[12, 7.2, 140.8], [12, 4.8, 123.2]])
    expect(clientePrisma.nfeCteVinculo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'a', nfeRecebidaId: 'n', cteRecebida: { companyId: 'a' } } }))
    expect(clientePrisma.produto.update).not.toHaveBeenCalled()
  })
  it('grade retornada após gravar usa os mesmos créditos e consulta a regra vigente', async () => {
    const antes = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    const depois = await servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', antes.itens.map((i) => ({ produtoId: i.produtoId!, precoVenda: i.precoSugerido!, margemPercentual: 0 })))
    expect(depois.itens.map((i) => i.custoContabil)).toEqual(antes.itens.map((i) => i.custoContabil))
    expect(servicoRegrasFiscais.obter).toHaveBeenCalledTimes(3)
    expect(clientePrisma.produto.updateMany).toHaveBeenCalledTimes(2)
  })
  it('restaura o custo por embalagem com frete, IPI, seguro, outras despesas e créditos, sem desconto ou vFrete adicional', async () => {
    const atual = nota() as unknown as { xmlConteudo: string; itens: { quantidade: number; produto: { fornecedores: unknown[] } }[]; fornecedorPessoaId: string }
    atual.fornecedorPessoaId = 'f'
    atual.xmlConteudo = xmlCusto({ itens: 2, quantidade: '2', bruto: '200', desconto: '10', frete: '30' })
    for (const item of atual.itens) { item.quantidade = 2; item.produto.fornecedores = [{ fornecedorPessoaId: 'f', multiplicadorEntrada: 4 }] }
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(atual as never)
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    expect(grade.itens[0].custoContabil).toBeCloseTo((200 + 60 + 5 + 3 + 2 - 24 - 7.2 - 1.65 - 7.6) / 8)
    expect(grade.itens[0]).not.toHaveProperty('memoria')
    expect(grade).not.toHaveProperty('revisaoCusto')
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
  it('grava sem confirmação ou consulta de memórias, inclusive com composição adicional no XML', async () => {
    const atual = nota() as unknown as { xmlConteudo: string }
    atual.xmlConteudo = atual.xmlConteudo.replace('</ICMSTot>', '<vIPIDevol>10</vIPIDevol></ICMSTot>')
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(atual as never)
    await servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 100 }])
    expect(clientePrisma.produto.updateMany).toHaveBeenCalledTimes(1)
    expect(clientePrisma.custoEntradaMemoria.findMany).not.toHaveBeenCalled()
    expect(clientePrisma.custoEntradaAjuste.findFirst).not.toHaveBeenCalled()
    expect(clientePrisma.custoEntradaMemoria.createMany).not.toHaveBeenCalled()
  })
  it.each([0, -1, NaN, Infinity])('recusa preço inválido %s', async precoVenda => {
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda }])).rejects.toMatchObject({ codigoHttp: 400 })
    expect(clientePrisma.produto.updateMany).not.toHaveBeenCalled()
  })
  it('não aceita item externo na seleção de preço', async () => {
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', itemId: 'externo', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 400 })
    expect(clientePrisma.produto.updateMany).not.toHaveBeenCalled()
  })
  it('produto repetido exige seleção explícita; grava uma linha escolhida', async () => {
    const atual = nota() as unknown as { itens: { produtoId: string; produto: { id: string } }[] }
    atual.itens[1].produtoId = 'p0'; atual.itens[1].produto.id = 'p0'
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(atual as never)
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 400 })
    await servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', itemId: 'i1', precoVenda: 100 }])
    expect(clientePrisma.produto.updateMany).toHaveBeenCalledWith({ where: { id: 'p0', companyId: 'a' }, data: { precoVenda: 100 } })
  })
  it('conflito transacional vira 409 sem substituir histórico', async () => {
    vi.mocked(clientePrisma.$transaction).mockRejectedValue({ code: 'P2034' })
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [{ produtoId: 'p0', precoVenda: 100 }])).rejects.toMatchObject({ codigoHttp: 409 })
    expect(clientePrisma.custoEntradaMemoria.createMany).not.toHaveBeenCalled()
  })
  it('vínculo corrompido com produto de outra empresa não expõe a grade', async () => {
    const atual = nota() as unknown as { itens: { produto: { companyId: string } }[] }
    atual.itens[0].produto.companyId = 'b'
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(atual as never)
    await expect(servicoPrecificacaoEntrada.obterGrade('a', 'n')).rejects.toMatchObject({ codigoHttp: 404 })
    expect(clientePrisma.custoEntradaMemoria.findMany).not.toHaveBeenCalled()
  })
  async function novaLinha() {
    const grade = await servicoPrecificacaoEntrada.obterGrade('a', 'n')
    const item = grade.itens[0]
    const ajustes = { transporteSimples: false }
    const custo = calcularAquisicao(item.base, ajustes).custo
    return { produtoId: item.produtoId!, itemId: item.itemId, ajustes, revisao: item.revisao, origem: item.origem,
      margemPercentual: 20, precoVenda: precoPorMargem(custo, 0, 20)!, margemAtacado: 10, precoAtacado: precoPorMargem(custo, 0, 10)! }
  }
  it('grava venda, atacado e parâmetros na mesma transação com revisão e empresa', async () => {
    const linha = await novaLinha()
    await servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [linha])
    expect(clientePrisma.nfeRecebidaItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'i0', nfeRecebidaId: 'n', precificacaoRevisao: 0, nfeRecebida: { companyId: 'a' } },
      data: expect.objectContaining({ precificacaoRevisao: { increment: 1 }, precificacaoParametros: expect.objectContaining({ ajustes: linha.ajustes }) }),
    }))
    expect(clientePrisma.produto.updateMany).toHaveBeenCalledWith({ where: { id: 'p0', companyId: 'a' }, data: { precoVenda: linha.precoVenda, precoAtacado: linha.precoAtacado } })
    expect(clientePrisma.logDeAuditoria.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ valoresDepois: expect.objectContaining({ precoAtacado: linha.precoAtacado, parametros: expect.any(Object) }) }) }))
  })
  it('reabre com os parâmetros salvos e preço atual de atacado', async () => {
    const original = nota() as unknown as { itens: Array<Record<string, unknown>> }
    original.itens[0].precificacaoParametros = { ajustes: { transporteSimples: false, descontoPercentual: 10 }, margemPercentual: 20, margemAtacado: 10 }
    original.itens[0].precificacaoRevisao = 2
    ;(original.itens[0].produto as Record<string, unknown>).precoAtacado = 150
    vi.mocked(repositorioEntradaNotas.buscarNotaCompleta).mockResolvedValue(original as never)
    const item = (await servicoPrecificacaoEntrada.obterGrade('a', 'n')).itens[0]
    expect(item.revisao).toBe(2)
    expect(item.parametros.ajustes.descontoPercentual).toBe(10)
    expect(item.precoAtacadoAtual).toBe(150)
    expect(item.precoAtacadoProposto).not.toBeNull()
  })
  it.each(['origem', 'revisao', 'precoVenda', 'precoAtacado'] as const)('recusa %s adulterado ou desatualizado sem alterar produtos', async campo => {
    const linha = await novaLinha()
    const adulterada = { ...linha, [campo]: campo === 'origem' ? 'invalida' : 999 }
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [adulterada])).rejects.toMatchObject({ codigoHttp: campo === 'origem' || campo === 'revisao' ? 409 : 400 })
    expect(clientePrisma.produto.updateMany).not.toHaveBeenCalled()
  })
  it('conflito na revisão do item impede atualização dos preços', async () => {
    const linha = await novaLinha()
    vi.mocked(clientePrisma.nfeRecebidaItem.updateMany).mockResolvedValue({ count: 0 })
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [linha])).rejects.toMatchObject({ codigoHttp: 409 })
    expect(clientePrisma.produto.updateMany).not.toHaveBeenCalled()
  })
  it('mudança dos encargos invalida a origem mesmo com as mesmas regras fiscais', async () => {
    const linha = await novaLinha()
    vi.mocked(servicoParametrizacaoCustos.obter).mockResolvedValue({ id: 'cfg', totalVenda: 5 } as never)
    await expect(servicoPrecificacaoEntrada.gravarPrecos('a', 'n', 'u', [linha])).rejects.toMatchObject({ codigoHttp: 409 })
  })
  it('simula sem gravar e recusa item de outra nota', async () => {
    const resultado = await servicoPrecificacaoEntrada.simular('a', 'n', { itemId: 'i0', ajustes: { transporteSimples: false }, margemPercentual: 20, margemAtacado: 10 })
    expect(resultado.erro).toBeNull()
    expect(resultado.precoVenda).toBeGreaterThan(resultado.precoAtacado!)
    expect(clientePrisma.produto.updateMany).not.toHaveBeenCalled()
    expect(clientePrisma.nfeRecebidaItem.updateMany).not.toHaveBeenCalled()
    await expect(servicoPrecificacaoEntrada.simular('a', 'n', { itemId: 'externo', ajustes: {}, margemPercentual: 0, margemAtacado: null })).rejects.toMatchObject({ codigoHttp: 404 })
  })
})
