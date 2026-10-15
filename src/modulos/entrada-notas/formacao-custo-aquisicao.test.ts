import { describe, expect, it } from 'vitest'
import { calcularCustoAquisicaoItem, distribuirDespesa, formarCustosNota, type ItemCusto } from './formacao-custo-aquisicao.js'
import { extrairCustosXml } from '../focus-nfe/parser-custo-nfe.js'
import { extrairItensDoXml } from '../focus-nfe/parser-xml-nfe.js'
import { regrasFiscaisPadrao, esquemaRegrasFiscais, type RegrasFiscais } from '../configuracoes/esquema-regras-fiscais.js'
import { ajustesCustoVazios } from './esquema-custo-aquisicao.js'
import { xmlCusto } from './formacao-custo-fixture.js'

const cfop = '5a39b8db-5a0d-4bb5-8f2c-91271ea61600'
const entrada: ItemCusto = { itemId: 'i', nItem: 1, cfopEntradaId: cfop, multiplicador: 5, freteCte: 0, creditoFrete: 0, peso: null }
const regra = (): RegrasFiscais => ({ ...regrasFiscaisPadrao(), baseIcms: 'bruto', operacoes: (['icms', 'ipi', 'pis', 'cofins', 'icms_st', 'fcp_st', 'ii', 'icms_frete'] as const).map(tributo => ({ cfopEntradaId: cfop, tributo, cst: tributo === 'ipi' ? '50' : tributo === 'pis' || tributo === 'cofins' ? '01' : tributo === 'ii' ? 'sem_cst' : '00', recuperabilidade: tributo === 'ipi' || tributo === 'ii' || tributo.endsWith('_st') ? 'nao_aplicavel' : 'aplicavel', composicao: tributo === 'ipi' || tributo === 'ii' || tributo.endsWith('_st') ? 'adicional' : 'embutido' })) })
const calcular = (xml = xmlCusto(), r = regra(), e = entrada) => formarCustosNota(xml, [e], r, ajustesCustoVazios()).itens[0].memoria

describe('formação de custo de aquisição', () => {
  it('extrai valores originais, grupos e CST de cada imposto, inclusive namespace', () => {
    const xml = xmlCusto({ st: '8', fcp: '2', ii: '3', prefixo: 'n' })
    const o = extrairCustosXml(xml).itens[0]
    expect(o).toMatchObject({ quantidade: 2, bruto: 100, desconto: 10, tributos: { ipi: { grupo: 'IPITrib', cst: '50', valor: 5 }, pis: { grupo: 'PISAliq', cst: '01', valor: 1.65 }, ii: { grupo: 'II', valor: 3 } } })
    expect(extrairItensDoXml(xml)[0].dadosCustoXml).toEqual(o)
  })
  it('desconta somente créditos aplicáveis, não duplica tributos embutidos e converte embalagem', () => {
    const m = calcular()
    expect(m.pendencias).toEqual([])
    expect(m.total).toBe(72.75)
    expect(m.unitarioNf).toBe(36.375)
    expect(m.unitarioVenda).toBe(7.275)
    expect(m.quantidadeVenda).toBe(10)
  })
  it('não recuperável mantém ICMS/PIS/COFINS embutidos; IPI/ST/FCP-ST/II entram uma vez', () => {
    const r = regra(); r.operacoes?.forEach(o => o.recuperabilidade = 'nao_aplicavel')
    const m = calcular(xmlCusto({ st: '8', fcp: '2', ii: '3' }), r)
    expect(m.pendencias).toEqual([]); expect(m.total).toBe(113); expect(m.creditos.icms).toBe(0)
  })
  it('IPI recuperável entra como parcela adicional e crédito separado', () => {
    const r = regra(); r.operacoes!.find(o => o.tributo === 'ipi')!.recuperabilidade = 'aplicavel'
    expect(calcular(undefined, r).total).toBe(67.75)
  })
  it.each([['bruto', 12], ['liquido', 10.8], ['vbc', 9.6]] as const)('ICMS padrão prevalece na base %s', (baseIcms, esperado) => {
    const r = { ...regra(), baseIcms, mercadoria: { modo: 'pre_definida' as const, aliquota: 12 } }
    const m = calcular(undefined, r); expect(m.creditos.icms).toBe(esperado)
    expect(m.componentes.find(c => c.origem === 'icms')?.percentual).toBe(12)
  })
  it('não aplica percentual padrão quando a operação não admite crédito', () => {
    const r = regra(); r.mercadoria = { modo: 'pre_definida', aliquota: 12 }; r.operacoes![0].recuperabilidade = 'nao_aplicavel'
    expect(calcular(undefined, r).creditos.icms).toBe(0)
  })
  it('regra e base ausentes deixam pendência, sem custo definitivo', () => {
    expect(calcular(undefined, regrasFiscaisPadrao()).pendencias).toContain('Regra fiscal insuficiente: icms, CST/CSOSN 00.')
    const r = regra(); r.baseIcms = 'vbc'; r.mercadoria = { modo: 'pre_definida', aliquota: 12 }
    expect(calcular(xmlCusto().replace('<vBC>80.00</vBC>', ''), r).pendencias).toContain('Base ou percentual padrão de ICMS ausente.')
  })
  it('zero explícito e tributo opcional ausente não exigem regra; CST próprio não vem do ICMS', () => {
    const m = calcular(xmlCusto({ icms: '0', ipi: '0', pis: '0', cofins: '0' }), regrasFiscaisPadrao())
    expect(m.pendencias).toEqual([])
    const xml = xmlCusto().replace(/<PIS>[\s\S]*?<\/PIS>/, '').replace('<vPIS>1.65</vPIS>', '<vPIS>0</vPIS>').replace('<vNF>100</vNF>', '<vNF>100</vNF>')
    expect(calcular(xml).creditos.pis).toBeUndefined()
  })
  it('ICMS Simples usa vCredICMSSN e não cria vICMS', () => {
    const xml = xmlCusto({ icms: '0' }).replace(/<ICMS>[\s\S]*?<\/ICMS>/, '<ICMS><ICMSSN101><CSOSN>101</CSOSN><pCredSN>3</pCredSN><vCredICMSSN>3</vCredICMSSN></ICMSSN101></ICMS>')
    const r = regra(); r.operacoes![0].cst = '101'
    expect(calcular(xml, r).creditos.icms).toBe(3)
  })
  it.each(['distintos', 'nfe', 'cte'] as const)('frete conferido %s inclui e exclui as origens corretas', decisaoFrete => {
    const m = formarCustosNota(xmlCusto({ frete: '10' }), [{ ...entrada, freteCte: 20, creditoFrete: 2, fontesFrete: [{ valorFrete: 20, valorIcms: 2, baseCalculoIcms: 20, aliquotaIcms: 10, chaveNfe: null }] }], regra(), { ...ajustesCustoVazios(), decisaoFrete }).itens[0].memoria
    expect(m.pendencias).toEqual([]); expect(m.frete).toBe(decisaoFrete === 'distintos' ? 30 : decisaoFrete === 'nfe' ? 10 : 20)
    expect(m.creditos.icms_frete ?? 0).toBe(decisaoFrete === 'nfe' ? 0 : 2)
  })
  it('frete simultâneo sem conferência bloqueia, quantidade zero e XML incompleto bloqueiam', () => {
    expect(calcular(xmlCusto({ frete: '10' }), regra(), { ...entrada, freteCte: 20 }).pendencias.some(p => p.includes('frete da NF-e'))).toBe(true)
    const o = extrairCustosXml(xmlCusto()).itens[0]; o.quantidade = 0
    expect(calcularCustoAquisicaoItem(o, entrada, regra()).pendencias).toContain('Quantidade comercial inválida.')
    expect(formarCustosNota(null, [entrada], regra(), ajustesCustoVazios()).itens[0].memoria.unitarioVenda).toBeNull()
  })
  it('CT-e sem ICMS no modo nota aplicável não vira crédito zero definitivo', () => {
    const m = calcular(undefined, regra(), { ...entrada, freteCte: 20, creditoFrete: 0, fontesFrete: [{ valorFrete: 20, valorIcms: null, baseCalculoIcms: null, aliquotaIcms: null, chaveNfe: null }] })
    expect(m.pendencias).toContain('Crédito do transporte aplicável sem ICMS completo do CT-e.')
  })
  it.each(['valor', 'quantidade', 'peso', 'volume'] as const)('rateia despesa por %s preservando centavos', criterio => {
    const ajustes = { ...ajustesCustoVazios(), bases: [{ nItem: 1, peso: 1, volume: 1 }, { nItem: 2, peso: 2, volume: 2 }], despesas: [{ id: 'd', descricao: 'Serviço', valor: 10.01, compoeCusto: true, nItem: null, criterio, origem: 'externa' as const }] }
    const m = formarCustosNota(xmlCusto({ itens: 2 }), [entrada, { ...entrada, itemId: 'j', nItem: 2 }], regra(), ajustes)
    expect(m.itens.every(i => !i.memoria.pendencias.length)).toBe(true)
    expect(m.itens.reduce((s, i) => s + i.memoria.despesasAdicionais, 0)).toBeCloseTo(10.01)
  })
  it('peso/volume ausentes bloqueiam só os itens do rateio; exclusão não adiciona custo', () => {
    const ajustes = { ...ajustesCustoVazios(), despesas: [{ id: 'd', descricao: 'Serviço', valor: 10, compoeCusto: true, nItem: null, criterio: 'volume' as const, origem: 'externa' as const }] }
    expect(formarCustosNota(xmlCusto(), [entrada], regra(), ajustes).itens[0].memoria.pendencias.some(p => p.includes('volume'))).toBe(true)
    ajustes.despesas[0].compoeCusto = false
    expect(formarCustosNota(xmlCusto(), [entrada], regra(), ajustes).itens[0].memoria.total).toBe(72.75)
  })
  it('total geral não é somado novamente e residual exige rateio explícito', () => {
    const xml = xmlCusto().replace('<vSeg>3</vSeg>', '<vSeg>8</vSeg>').replace('<vNF>100</vNF>', '<vNF>105</vNF>')
    const atual = formarCustosNota(xml, [entrada], regra(), ajustesCustoVazios())
    expect(atual.residuais).toEqual([{ origem: 'residual_seguro', valor: 5 }])
    const resolvido = formarCustosNota(xml, [entrada], regra(), { ...ajustesCustoVazios(), despesas: [{ id: 'd', descricao: 'Seguro residual', valor: 5, compoeCusto: true, nItem: null, criterio: 'valor', origem: 'residual_seguro' }] })
    expect(resolvido.itens[0].memoria.pendencias).toEqual([]); expect(resolvido.itens[0].memoria.total).toBe(77.75)
  })
  it('centavos e bases inválidas não recebem fallback silencioso', () => {
    expect(distribuirDespesa(0.01, [1, 1, 1])).toEqual([0.01, 0, 0]); expect(distribuirDespesa(10, [0, 1])).toBeNull()
  })
  it('despesas originais excluídas permanecem na memória sem aumentar o custo', () => {
    const m = formarCustosNota(xmlCusto(), [entrada], regra(), { ...ajustesCustoVazios(), exclusoesXml: [{ nItem: 1, campo: 'seguro' }, { nItem: 1, campo: 'outras' }] }).itens[0].memoria
    expect(m.pendencias).toEqual([]); expect(m.total).toBe(67.75)
    expect(m.componentes.find(c => c.origem === 'vSeg')).toMatchObject({ incluido: false, valor: 3 })
    expect(m.original?.seguro).toBe(3)
  })
  it('valores malformados, total negativo e tributo obrigatório sem valor são pendências', () => {
    expect(calcular(xmlCusto().replace('<vDesc>10.00</vDesc>', '<vDesc>abc</vDesc>')).pendencias).toContain('Valor inválido no XML: vDesc.')
    expect(calcular(xmlCusto().replace('<vICMS>18.00</vICMS>', '')).pendencias.some(p => p.includes('Valor de icms ausente'))).toBe(true)
    expect(calcular(xmlCusto().replace('<vNF>100</vNF>', '<vNF>-1</vNF>')).pendencias.some(p => p.includes('vNF'))).toBe(true)
  })
  it('regras duplicadas ou tributos embutidos configurados como adicionais são recusados', () => {
    const r = regra(); r.operacoes!.push({ ...r.operacoes![0] }); expect(esquemaRegrasFiscais.safeParse(r).success).toBe(false)
    r.operacoes!.pop(); r.operacoes![0].composicao = 'adicional'; expect(esquemaRegrasFiscais.safeParse(r).success).toBe(false)
  })
})
