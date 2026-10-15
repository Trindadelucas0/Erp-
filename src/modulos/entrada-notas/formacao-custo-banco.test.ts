import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { clientePrisma as db } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { servicoPrecificacaoEntrada as servico } from './servico-precificacao-entrada.js'
import { xmlCusto } from './formacao-custo-fixture.js'

// Runs only against the disposable PostgreSQL created for this task; never the ERP DB.
const bancoTeste = 'postgresql://postgres@127.0.0.1:55439/erp_custo_migracao_v2'
const habilitado = process.env.CUSTO_TEST_DATABASE_URL === bancoTeste && process.env.DATABASE_URL === bancoTeste
describe.skipIf(!habilitado)('formação de custo — PostgreSQL descartável', () => {
  const empresa = randomUUID(), outraEmpresa = randomUUID(), usuario = randomUUID(), produto = randomUUID(), nota = randomUUID(), cfop = randomUUID(), item = randomUUID()
  let revisaoConfirmada: string
  beforeAll(async () => {
    await db.company.createMany({ data: [{ id: empresa, name: 'Custo teste', cnpj: empresa }, { id: outraEmpresa, name: 'Outra empresa teste', cnpj: outraEmpresa }] })
    await db.user.create({ data: { id: usuario, name: 'Operador teste', email: `${usuario}@example.invalid`, password: 'sem-login-neste-teste' } })
    await db.cfop.create({ data: { id: cfop, companyId: empresa, codigo: '1.102', nome: 'Entrada teste' } })
    await db.produto.create({ data: { id: produto, companyId: empresa, nomeVenda: 'Produto teste', marca: 'Teste', precoVenda: 200 } })
    await db.regraFiscal.create({ data: { companyId: empresa, operacoes: [
      { cfopEntradaId: cfop, tributo: 'icms', cst: '00', recuperabilidade: 'aplicavel', composicao: 'embutido' },
      { cfopEntradaId: cfop, tributo: 'ipi', cst: '50', recuperabilidade: 'nao_aplicavel', composicao: 'adicional' },
      { cfopEntradaId: cfop, tributo: 'pis', cst: '01', recuperabilidade: 'aplicavel', composicao: 'embutido' },
      { cfopEntradaId: cfop, tributo: 'cofins', cst: '01', recuperabilidade: 'aplicavel', composicao: 'embutido' },
    ] } })
    await db.nfeRecebida.create({ data: { id: nota, companyId: empresa, chaveNfe: nota, tipoDocumento: 'nfe55', finalidadeEntrada: 'revenda', statusEntrada: 'entrada_consolidada', xmlConteudo: xmlCusto(), itens: { create: { id: item, nItem: 1, quantidade: 2, valorUnitario: 50, valorTotal: 100, cfopEntradaId: cfop, produtoId: produto } } } })
  })
  afterAll(async () => { await db.$disconnect() })
  it('leitura não grava preços nem memória; outra empresa recebe 404', async () => {
    const grade = await servico.obterGrade(empresa, nota)
    expect(grade.itens[0].custoContabil).toBe(36.375)
    expect(await db.custoEntradaMemoria.count({ where: { nfeRecebidaId: nota } })).toBe(0)
    expect((await db.produto.findUniqueOrThrow({ where: { id: produto } })).precoVenda?.toNumber()).toBe(200)
    await expect(servico.obterGrade(outraEmpresa, nota)).rejects.toMatchObject({ codigoHttp: 404 })
  })
  it('confirma uma vez e grava preço sem margem somente após confirmação', async () => {
    const grade = await servico.obterGrade(empresa, nota)
    await expect(servico.gravarPrecos(empresa, nota, usuario, [{ produtoId: produto, precoVenda: 50 }])).rejects.toMatchObject({ codigoHttp: 409 })
    const confirmado = await servico.confirmarCusto(empresa, nota, usuario, grade.revisaoCusto, [item])
    expect(confirmado.itens[0].estadoCusto).toBe('confirmado')
    revisaoConfirmada = confirmado.revisaoCusto
    await servico.confirmarCusto(empresa, nota, usuario, revisaoConfirmada, [item])
    expect(await db.custoEntradaMemoria.count({ where: { nfeRecebidaId: nota } })).toBe(1)
    await servico.gravarPrecos(empresa, nota, usuario, [{ produtoId: produto, itemId: item, precoVenda: 50 }], undefined, revisaoConfirmada)
    expect((await db.produto.findUniqueOrThrow({ where: { id: produto } })).precoVenda?.toNumber()).toBe(50)
    expect(await db.logDeAuditoria.count({ where: { entidadeId: produto, usuarioId: usuario } })).toBe(1)
  })
  it('ajuste invalida confirmação; reprocessar item preserva memória pelo nItem', async () => {
    await servico.salvarAjustes(empresa, nota, usuario, revisaoConfirmada, { decisaoFrete: null, bases: [], despesas: [{ id: randomUUID(), descricao: 'Despesa de teste', valor: 10, compoeCusto: true, nItem: null, criterio: 'valor', origem: 'externa' }] })
    const grade = await servico.obterGrade(empresa, nota)
    expect(grade.itens[0].estadoCusto).toBe('desatualizado')
    await expect(servico.gravarPrecos(empresa, nota, usuario, [{ produtoId: produto, precoVenda: 60 }], undefined, revisaoConfirmada)).rejects.toMatchObject({ codigoHttp: 409 })
    await db.nfeRecebidaItem.deleteMany({ where: { nfeRecebidaId: nota } })
    await db.nfeRecebidaItem.create({ data: { nfeRecebidaId: nota, nItem: 1, quantidade: 2, valorUnitario: 50, valorTotal: 100, cfopEntradaId: cfop, produtoId: produto } })
    expect((await servico.listarMemorias(empresa, nota)).memorias).toHaveLength(1)
    expect((await db.produto.findUniqueOrThrow({ where: { id: produto } })).precoVenda?.toNumber()).toBe(50)
  })
  it('dois operadores não sobrescrevem ajustes a partir da mesma revisão', async () => {
    const grade = await servico.obterGrade(empresa, nota)
    const ajustar = (valor: number) => servico.salvarAjustes(empresa, nota, usuario, grade.revisaoCusto, { decisaoFrete: null, bases: [], despesas: [{ id: randomUUID(), descricao: 'Ajuste concorrente', valor, compoeCusto: true, nItem: null, criterio: 'valor', origem: 'externa' }] })
    const resultados = await Promise.allSettled([ajustar(15), ajustar(20)])
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const recusado = resultados.find(r => r.status === 'rejected') as PromiseRejectedResult
    expect(recusado.reason.codigoHttp).toBe(409)
    const final = await servico.obterGrade(empresa, nota)
    expect([15, 20]).toContain(final.ajustesCusto.despesas[0].valor)
    expect(await db.custoEntradaMemoria.count({ where: { nfeRecebidaId: nota } })).toBe(1)
  })
})
