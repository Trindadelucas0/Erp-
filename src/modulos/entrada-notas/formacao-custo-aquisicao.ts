import { Decimal } from '@prisma/client/runtime/library'
import type { RegrasFiscais } from '../configuracoes/esquema-regras-fiscais.js'
import { extrairCustosXml, type OriginalCustoXml, type TributoCusto } from '../focus-nfe/parser-custo-nfe.js'
import { ajustesCustoVazios, type AjustesCusto } from './esquema-custo-aquisicao.js'

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })
const dec = (n: number | null | undefined) => new D(n ?? 0)
const dinheiro = (n: Decimal) => n.toDecimalPlaces(2).toNumber()
export type FonteFreteCusto = { valorFrete: number; valorIcms: number | null; baseCalculoIcms: number | null; aliquotaIcms: number | null; chaveNfe: string | null }
export type ItemCusto = { itemId: string; nItem: number; cfopEntradaId: string | null; multiplicador: number; freteCte: number; creditoFrete: number; peso: number | null; baseCreditoFrete?: number | null; fontesFrete?: FonteFreteCusto[] }
export type ComponenteCusto = { origem: string; valor: number; incluido: boolean; credito: number; regra?: unknown; base?: number | null; percentual?: number | null }
export type MemoriaCusto = {
  original: OriginalCustoXml | null; componentes: ComponenteCusto[]; pendencias: string[]
  bruto: number | null; desconto: number; frete: number; seguro: number; outras: number; despesasAdicionais: number
  tributosNaoRecuperaveis: number; creditos: Partial<Record<TributoCusto, number>>
  quantidadeNf: number | null; quantidadeVenda: number | null; multiplicador: number
  total: number | null; unitarioNf: number | null; unitarioVenda: number | null
}

export function calcularCustoAquisicaoItem(original: OriginalCustoXml | null, item: ItemCusto, regras: RegrasFiscais, ajustes = ajustesCustoVazios(), adicionais: ComponenteCusto[] = [], gerais: string[] = []): MemoriaCusto {
  const pendencias = [...gerais]
  const componentes: ComponenteCusto[] = []
  const creditos: Partial<Record<TributoCusto, number>> = {}
  if (!original) pendencias.push('XML completo do item indisponível.')
  for (const tag of original?.invalidos ?? []) pendencias.push(`Valor inválido no XML: ${tag}.`)
  if (!item.cfopEntradaId) pendencias.push('CFOP de entrada não definido.')
  const qtd = original?.quantidade ?? null
  const bruto = original?.bruto ?? null
  if (qtd == null || qtd <= 0) pendencias.push('Quantidade comercial inválida.')
  if (bruto == null) pendencias.push('Valor bruto vProd ausente ou inválido.')
  if (!(item.multiplicador > 0) || !Number.isFinite(item.multiplicador)) pendencias.push('Multiplicador de embalagem inválido.')
  const desconto = original?.desconto ?? 0
  if (bruto != null && desconto > bruto) pendencias.push('Desconto maior que o valor bruto.')
  if (original?.unitario != null && qtd != null && bruto != null && dec(qtd).mul(original.unitario).sub(bruto).abs().gt('0.01')) pendencias.push('qCom × vUnCom diverge de vProd.')
  let total = dec(bruto).sub(desconto)
  componentes.push({ origem: 'vProd', valor: bruto ?? 0, incluido: true, credito: 0 }, { origem: 'vDesc', valor: -desconto, incluido: true, credito: 0 })
  const freteNf = original?.frete ?? 0
  const freteCte = item.freteCte
  const ambos = freteNf > 0 && freteCte > 0
  if (ambos && !ajustes.decisaoFrete) pendencias.push('Confira se frete da NF-e e CT-e são despesas distintas.')
  const usarNf = ajustes.decisaoFrete !== 'cte'
  const usarCte = ajustes.decisaoFrete !== 'nfe'
  const frete = dinheiro(dec(usarNf ? freteNf : 0).add(usarCte ? freteCte : 0))
  const seguro = original?.seguro ?? 0
  const outras = original?.outras ?? 0
  const incluirSeguro = !ajustes.exclusoesXml?.some(e => e.nItem === item.nItem && e.campo === 'seguro')
  const incluirOutras = !ajustes.exclusoesXml?.some(e => e.nItem === item.nItem && e.campo === 'outras')
  componentes.push({ origem: 'vFrete', valor: freteNf, incluido: usarNf, credito: 0 }, { origem: 'CT-e lançado', valor: freteCte, incluido: usarCte, credito: 0, regra: { fontesFrete: item.fontesFrete ?? [] } },
    { origem: 'vSeg', valor: seguro, incluido: incluirSeguro, credito: 0 }, { origem: 'vOutro', valor: outras, incluido: incluirOutras, credito: 0 })
  total = total.add(frete).add(incluirSeguro ? seguro : 0).add(incluirOutras ? outras : 0)
  let naoRecuperaveis = new D(0)
  for (const tributo of ['icms', 'icms_st', 'fcp_st', 'ipi', 'ii', 'pis', 'cofins', 'icms_frete'] as const) {
    const imp = original?.tributos[tributo === 'icms_frete' ? 'icms' : tributo]
    const valor = tributo === 'icms_frete' ? (usarCte ? item.creditoFrete : 0) : imp?.valor ?? 0
    const creditoXml = tributo === 'icms' ? imp?.credito ?? null : valor
    const potencial = tributo === 'icms' && regras.mercadoria.modo === 'pre_definida' && (regras.mercadoria.aliquota ?? 0) > 0
    const transporteAtivo = tributo === 'icms_frete' && usarCte && freteCte > 0
    const regra = regras.operacoes?.find(r => r.cfopEntradaId === item.cfopEntradaId && r.tributo === tributo && r.cst === imp?.cst)
    const faltaCreditoSn = tributo === 'icms' && regras.mercadoria.modo === 'nota' && regra?.recuperabilidade === 'aplicavel' && /^ICMSSN/.test(imp?.grupo ?? '') && creditoXml == null
    if (faltaCreditoSn) pendencias.push('Crédito ICMS aplicável sem vCredICMSSN no XML.')
    const exigeValor = tributo === 'icms' ? /^(ICMS00|ICMS10|ICMS20|ICMS51|ICMS70|ICMS90)$/.test(imp?.grupo ?? '')
      : tributo === 'icms_st' ? /^(ICMS10|ICMS30|ICMS70)$/.test(imp?.grupo ?? '')
      : tributo === 'ipi' ? imp?.grupo === 'IPITrib'
      : tributo === 'pis' ? /^(PISAliq|PISQtde|PISOutr)$/.test(imp?.grupo ?? '')
      : tributo === 'cofins' ? /^(COFINSAliq|COFINSQtde|COFINSOutr)$/.test(imp?.grupo ?? '')
      : tributo === 'ii' ? imp?.grupo === 'II' : false
    if (exigeValor && imp?.valor == null) pendencias.push(`Valor de ${tributo} ausente no grupo ${imp?.grupo}.`)
    if (valor === 0 && !potencial && !(creditoXml != null && creditoXml > 0) && !(exigeValor && imp?.valor == null) && !faltaCreditoSn && !transporteAtivo) continue
    if (!regra || regra.recuperabilidade === 'revisao') pendencias.push(`Regra fiscal insuficiente: ${tributo}, CST/CSOSN ${imp?.cst ?? 'ausente'}.`)
    const adicional = regra?.composicao === 'adicional'
    let credito = new D(0)
    let base: number | null = imp?.base ?? null
    let percentual: number | null = imp?.aliquota ?? null
    if (tributo === 'icms_frete') {
      base = regras.transporte.modo === 'pre_definida' ? item.baseCreditoFrete ?? item.freteCte : item.freteCte
      percentual = regras.transporte.modo === 'pre_definida' ? regras.transporte.aliquota : null
      if (regra?.recuperabilidade === 'aplicavel' && regras.transporte.modo === 'nota' && (!item.fontesFrete?.length || item.fontesFrete.some(f => f.valorIcms == null))) pendencias.push('Crédito do transporte aplicável sem ICMS completo do CT-e.')
    }
    if (regra?.recuperabilidade === 'aplicavel') {
      if (tributo === 'icms' && regras.mercadoria.modo === 'pre_definida') {
        percentual = regras.mercadoria.aliquota
        base = regras.baseIcms === 'vbc' ? imp?.base ?? null : regras.baseIcms === 'liquido' ? dinheiro(dec(bruto).sub(desconto)) : bruto
        if (base == null || percentual == null) pendencias.push('Base ou percentual padrão de ICMS ausente.')
        else credito = dec(base).mul(percentual).div(100)
      } else {
        if (creditoXml == null) pendencias.push(`Valor do crédito de ${tributo} ausente no XML.`)
        credito = dec(creditoXml)
      }
    }
    const creditoValor = dinheiro(credito)
    creditos[tributo] = creditoValor
    if (adicional) total = total.add(valor)
    if (regra?.recuperabilidade === 'nao_aplicavel') naoRecuperaveis = naoRecuperaveis.add(valor)
    total = total.sub(creditoValor)
    componentes.push({ origem: tributo, valor, incluido: adicional, credito: creditoValor, regra: regra ? {
      ...regra,
      ...(tributo === 'icms' ? { modoCredito: regras.mercadoria.modo, baseCredito: regras.baseIcms ?? 'bruto' } : {}),
      ...(tributo === 'icms_frete' ? { modoCredito: regras.transporte.modo, descricaoBase: regras.transporte.modo === 'nota' ? 'Base de rateio: frete lançado' : 'Frete vinculado proporcional à linha' } : {}),
    } : null, base, percentual })
  }
  for (const c of adicionais) { componentes.push(c); if (c.incluido) total = total.add(c.valor) }
  const qtdVenda = qtd != null && item.multiplicador > 0 ? dec(qtd).mul(item.multiplicador) : null
  if (total.lte(0)) pendencias.push('Custo de aquisição deve ser maior que zero.')
  return { original, componentes, pendencias: [...new Set(pendencias)], bruto, desconto, frete, seguro, outras,
    despesasAdicionais: dinheiro(adicionais.filter(c => c.incluido).reduce((s, c) => s.add(c.valor), new D(0))), tributosNaoRecuperaveis: dinheiro(naoRecuperaveis), creditos,
    quantidadeNf: qtd, quantidadeVenda: qtdVenda?.toNumber() ?? null, multiplicador: item.multiplicador,
    total: bruto == null ? null : dinheiro(total), unitarioNf: qtd != null && qtd > 0 ? total.div(qtd).toDecimalPlaces(6).toNumber() : null,
    unitarioVenda: qtdVenda?.gt(0) ? total.div(qtdVenda).toDecimalPlaces(6).toNumber() : null }
}

export function distribuirDespesa(valor: number, bases: number[]): number[] | null {
  if (!bases.length || bases.some(b => !Number.isFinite(b) || b <= 0)) return null
  const soma = bases.reduce((s, b) => s.add(b), new D(0))
  const centavos = dec(valor).mul(100).toDecimalPlaces(0)
  const exatos = bases.map(b => centavos.mul(b).div(soma))
  const partes = exatos.map(v => v.floor())
  let resto = centavos.sub(partes.reduce((s, v) => s.add(v), new D(0))).toNumber()
  const ordem = exatos.map((v, i) => ({ i, resto: v.sub(partes[i]) })).sort((a, b) => b.resto.comparedTo(a.resto) || a.i - b.i)
  for (const { i } of ordem) { if (resto-- <= 0) break; partes[i] = partes[i].add(1) }
  return partes.map(v => v.div(100).toNumber())
}

export function formarCustosNota(xml: string | null, itens: ItemCusto[], regras: RegrasFiscais, ajustes: AjustesCusto) {
  const parsed = extrairCustosXml(xml)
  const originais = new Map(parsed.itens.map(i => [i.nItem, i]))
  const gerais: string[] = []
  const locais = new Map<number, string[]>(itens.map(i => [i.nItem, []]))
  const despesasPorItem = new Map<number, ComponenteCusto[]>(itens.map(i => [i.nItem, []]))
  const residuais: { origem: 'residual_frete' | 'residual_seguro' | 'residual_outras'; valor: number }[] = []
  if (!parsed.completo) gerais.push('XML da NF-e incompleto ou totais indisponíveis.')
  if (parsed.itens.length !== itens.length || new Set(parsed.itens.map(i => i.nItem)).size !== parsed.itens.length || itens.some(i => !originais.has(i.nItem))) gerais.push('Itens do XML divergem dos itens persistidos da nota.')
  const conferir = (tag: string, soma: Decimal, residual?: typeof residuais[number]['origem']) => {
    const total = parsed.totais[tag]
    if (total == null) { if (tag === 'vProd' || tag === 'vNF' || soma.gt(0)) gerais.push(`Total ${tag} ausente ou inválido.`); return }
    const diferenca = dec(total).sub(soma)
    if (diferenca.abs().lte('0.01')) return
    if (diferenca.gt(0) && residual) {
      const valor = dinheiro(diferenca)
      residuais.push({ origem: residual, valor })
      const ajustesResidual = ajustes.despesas.filter(d => d.origem === residual)
      if (ajustesResidual.length !== 1 || !dec(ajustesResidual[0].valor).eq(valor)) gerais.push(`Distribua ou exclua explicitamente a diferença de ${tag}: R$ ${valor.toFixed(2)}.`)
    } else gerais.push(`Somatório dos itens diverge de ${tag}.`)
  }
  const itensTotais = parsed.itens.filter(i => i.indTot !== '0')
  for (const [tag, campo, residual] of [['vProd', 'bruto'], ['vDesc', 'desconto'], ['vFrete', 'frete', 'residual_frete'], ['vSeg', 'seguro', 'residual_seguro'], ['vOutro', 'outras', 'residual_outras']] as const) {
    conferir(tag, itensTotais.reduce((s, i) => s.add(i[campo] ?? 0), new D(0)), residual)
  }
  for (const [tag, tributo] of [['vICMS', 'icms'], ['vST', 'icms_st'], ['vFCPST', 'fcp_st'], ['vIPI', 'ipi'], ['vII', 'ii'], ['vPIS', 'pis'], ['vCOFINS', 'cofins']] as const) conferir(tag, itensTotais.reduce((s, i) => s.add(i.tributos[tributo]?.valor ?? 0), new D(0)))
  if ((parsed.totais.vIPIDevol ?? 0) > 0 || (parsed.totais.vICMSDeson ?? 0) > 0 || /<(?:[\w.]+:)?(?:IBSCBS|IS|ICMSTotRet)\b/i.test(xml ?? '')) gerais.push('Composição adicional do total exige revisão: devolução, desoneração ou tributo não suportado.')
  const esperado = dec(parsed.totais.vProd).sub(parsed.totais.vDesc ?? 0).add(parsed.totais.vFrete ?? 0).add(parsed.totais.vSeg ?? 0).add(parsed.totais.vOutro ?? 0).add(parsed.totais.vST ?? 0).add(parsed.totais.vFCPST ?? 0).add(parsed.totais.vIPI ?? 0).add(parsed.totais.vII ?? 0)
  if (parsed.totais.vNF == null || esperado.sub(parsed.totais.vNF).abs().gt('0.01')) gerais.push('Composição do valor total vNF inconsistente ou não suportada.')
  const totalFreteNf = dec(parsed.totais.vFrete).gt(0)
  if (totalFreteNf && itens.some(i => i.freteCte > 0) && !ajustes.decisaoFrete) gerais.push('Confira se frete da NF-e e CT-e são despesas distintas.')
  for (const despesa of ajustes.despesas) {
    if (despesa.origem !== 'externa' && !residuais.some(r => r.origem === despesa.origem && dec(r.valor).eq(despesa.valor))) { gerais.push(`Despesa ${despesa.descricao}: diferença do XML já distribuída ou alterada.`); continue }
    const destinos = despesa.nItem == null ? itens : itens.filter(i => i.nItem === despesa.nItem)
    if (!destinos.length) { gerais.push('Despesa vinculada a item inexistente.'); continue }
    const bases = destinos.map(i => {
      const original = originais.get(i.nItem)
      const base = ajustes.bases.find(b => b.nItem === i.nItem)
      return despesa.criterio === 'peso' ? base?.peso ?? i.peso ?? 0 : despesa.criterio === 'volume' ? base?.volume ?? 0 : despesa.criterio === 'quantidade' ? original?.quantidade ?? 0 : dec(original?.bruto).sub(original?.desconto ?? 0).toNumber()
    })
    const parcelas = destinos.length === 1 && despesa.nItem != null ? [dinheiro(dec(despesa.valor))] : distribuirDespesa(despesa.valor, bases)
    const excluido = despesa.origem === 'residual_frete' && ajustes.decisaoFrete === 'cte'
    if (!parcelas && despesa.compoeCusto && !excluido) { for (const i of destinos) locais.get(i.nItem)?.push(`Despesa ${despesa.descricao}: base de ${despesa.criterio} ausente ou inválida.`); continue }
    destinos.forEach((i, idx) => despesasPorItem.get(i.nItem)?.push({ origem: `${despesa.origem}: ${despesa.descricao}`, valor: parcelas?.[idx] ?? 0, incluido: despesa.compoeCusto && !excluido, credito: 0, regra: { criterio: despesa.criterio, base: bases[idx], valorOriginal: despesa.valor, id: despesa.id } }))
  }
  return { pendenciasGerais: [...new Set(gerais)], residuais, itens: itens.map(i => ({ itemId: i.itemId, nItem: i.nItem,
    memoria: calcularCustoAquisicaoItem(originais.get(i.nItem) ?? null, i, regras, ajustes, despesasPorItem.get(i.nItem), [...gerais, ...locais.get(i.nItem) ?? []]) })) }
}
