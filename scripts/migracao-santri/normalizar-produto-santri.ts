/**
 * Normalização Santri → payload de produto do ERP (Fase 1: catálogo).
 *
 * Decisões de escopo (plano):
 * - Mantém SKU Santri (campo Código)
 * - Não grava Preço em precoCusto
 * - Não cria ProdutoFornecedor
 * - Não migra estoque
 */
import {
  codigoBarrasGtinValido,
  normalizarCodigoBarrasGtin,
} from '../../src/compartilhado/validacoes/codigo-barras-gtin.js'
import { normalizarTextoCadastro } from '../../src/compartilhado/normalizacao/texto-cadastro.js'
import type { ProdutoSantriBruto } from './tipos.js'

export type AvisoNormalizacao = {
  campo: string
  mensagem: string
}

export type ProdutoSantriNormalizado = {
  sku: string
  nomeVenda: string
  nomeCompra?: string
  marca: string
  unidade: string
  ativo: boolean
  bloqueadoCompra: boolean
  controlaEstoque: boolean
  permiteEstoqueNegativo: boolean
  entregaNoAto: boolean
  entregaARetirar: boolean
  entregar: boolean
  flagComissao: boolean
  flagDevolucao: boolean
  ncm?: string
  codigoOrigem?: string
  codigoBarras?: string
  pesoKg?: number
  alturaCm?: number
  larguraCm?: number
  comprimentoCm?: number
  capacidadeEmpilhamento?: number
  multiploVenda: number
  permiteVendaFracionada: boolean
  embalagensMaster: {
    quantidade: number
    alturaCm?: number
    larguraCm?: number
    comprimentoCm?: number
  }[]
  /** Dados para Fase 2 (não gravados no produto na Fase 1). */
  fase2: {
    codigoOriginal?: string
    undCompra?: string
    multiploCompraUnitario?: number
    multiploCompraSecundario?: number
    fabricante?: string
    precoSantriIgnorado?: number
    estoqueSantriIgnorado?: number
    kit: boolean
  }
  avisos: AvisoNormalizacao[]
}

const NOMES_UNIDADE: Record<string, string> = {
  UN: 'Unidade',
  CX: 'Caixa',
  KG: 'Quilograma',
  PC: 'Peça',
  PR: 'Par',
  PAR: 'Par',
  M: 'Metro',
  M2: 'Metro quadrado',
  M3: 'Metro cúbico',
  L: 'Litro',
  LT: 'Litro',
  ML: 'Mililitro',
  GL: 'Galão',
  RL: 'Rolo',
  SC: 'Saco',
  BO: 'Bobina',
  BD: 'Balde',
  BR: 'Barra',
  CJ: 'Conjunto',
  CR: 'Cartela',
  CT: 'Cartão',
  FA: 'Fardo',
  OZ: 'Onça',
  SCH: 'Sache',
  AM: 'Ampola',
  T: 'Tonelada',
}

export function nomeUnidadePorSigla(sigla: string): string {
  return NOMES_UNIDADE[sigla] ?? sigla
}

export function parsearBooleanoSantri(valor: string): boolean | null {
  const v = valor.trim().toLowerCase()
  if (!v) return null
  if (['sim', 's', 'yes', 'true', '1'].includes(v)) return true
  if (['nao', 'não', 'n', 'no', 'false', '0'].includes(v)) return false
  return null
}

export function parsearDecimalSantri(valor: string): number | undefined {
  const t = valor.trim()
  if (!t) return undefined
  // 1.200,000 (pt-BR milhar) ou 0,158000
  const limpo = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : t
  const n = Number(limpo)
  return Number.isFinite(n) ? n : undefined
}

/** Normaliza sigla de unidade (M²/M³ → M2/M3). */
export function normalizarSiglaUnidade(valor: string): string {
  let s = valor.trim().toUpperCase()
  if (!s) return 'UN'
  s = s
    .replace(/M²/g, 'M2')
    .replace(/M³/g, 'M3')
    .replace(/M2/g, 'M2')
    .replace(/M3/g, 'M3')
  // ODS às vezes corrompe ²/³
  s = s.replace(/^M\uFFFD$/u, 'M2').replace(/^M�$/u, 'M2')
  if (s === 'MÂ²' || s === 'MÃ²') return 'M2'
  if (s === 'MÂ³' || s === 'MÃ³') return 'M3'
  // Caracteres que sobraram no lugar de ²/³
  if (/^M.$/u.test(s) && s !== 'M2' && s !== 'M3' && s[0] === 'M') {
    const extra = s.codePointAt(1)
    if (extra && extra > 127) return 'M2'
  }
  return s.slice(0, 10)
}

export function normalizarNcm(valor: string): { ncm?: string; aviso?: string } {
  const digitos = valor.replace(/\D/g, '')
  if (!digitos) return {}
  if (digitos.length >= 8) {
    const ncm = digitos.slice(0, 8)
    if (digitos.length > 8 || /-\d/.test(valor)) {
      return { ncm, aviso: `NCM normalizado de "${valor}" para ${ncm}` }
    }
    return { ncm }
  }
  return { aviso: `NCM inválido ignorado: "${valor}"` }
}

export function normalizarCodigoOrigem(valor: string): string | undefined {
  const m = valor.trim().match(/^([0-8])\b/)
  return m?.[1]
}

export function normalizarGtin(
  valor: string
): { codigoBarras?: string; aviso?: string } {
  const digitos = normalizarCodigoBarrasGtin(valor)
  if (!digitos) return {}
  if (codigoBarrasGtinValido(digitos)) {
    return { codigoBarras: digitos }
  }
  // UPC-12 → EAN-13 com zero à esquerda (quando o dígito verificador fecha)
  if (digitos.length === 12) {
    const ean13 = `0${digitos}`
    if (codigoBarrasGtinValido(ean13)) {
      return {
        codigoBarras: ean13,
        aviso: `UPC-12 convertido para EAN-13: ${ean13}`,
      }
    }
  }
  return {
    aviso: `Código de barras inválido/ignorado (ERP aceita EAN-13/DUN-14): "${valor}"`,
  }
}

/**
 * Regra ERP para vínculo de compra (Fase 2).
 * Unidades iguais → embalagem/múltiplo = 1.
 * Unidades diferentes → embalagem deve ser ≠ 1.
 */
export function resolverMultiplicadoresVinculo(params: {
  unidadeVenda: string
  unidadeEntrada: string
  multiploCompraUnitario?: number
  multiploCompraSecundario?: number
  overrideMultiplicador?: number
}): {
  unidadeEntrada: string
  multiplicadorEntrada: number
  multiploEntrada: number
  avisos: AvisoNormalizacao[]
  ok: boolean
  motivoErro?: string
} {
  const avisos: AvisoNormalizacao[] = []
  const undVenda = normalizarSiglaUnidade(params.unidadeVenda)
  const undEntrada = normalizarSiglaUnidade(
    params.unidadeEntrada || params.unidadeVenda
  )
  const iguais = undVenda === undEntrada

  if (iguais) {
    if (
      params.multiploCompraUnitario != null &&
      params.multiploCompraUnitario !== 1
    ) {
      avisos.push({
        campo: 'multiplicadorEntrada',
        mensagem: `Santri tinha múltiplo ${params.multiploCompraUnitario} com unidades iguais; ERP força 1`,
      })
    }
    return {
      unidadeEntrada: undEntrada,
      multiplicadorEntrada: 1,
      multiploEntrada: 1,
      avisos,
      ok: true,
    }
  }

  const candidato =
    params.overrideMultiplicador ??
    params.multiploCompraUnitario ??
    params.multiploCompraSecundario

  if (candidato == null || !Number.isFinite(candidato) || candidato === 1) {
    return {
      unidadeEntrada: undEntrada,
      multiplicadorEntrada: 1,
      multiploEntrada: 1,
      avisos,
      ok: false,
      motivoErro:
        'Unidade de entrada ≠ venda exige multiplicador/quantidade por embalagem diferente de 1 (informe override no de-para)',
    }
  }

  return {
    unidadeEntrada: undEntrada,
    multiplicadorEntrada: candidato,
    multiploEntrada: candidato,
    avisos,
    ok: true,
  }
}

export function normalizarProdutoSantri(
  bruto: ProdutoSantriBruto
): ProdutoSantriNormalizado | { erro: string; sku?: string } {
  const avisos: AvisoNormalizacao[] = []
  const sku = bruto.codigo.trim()
  const nomeVenda = (normalizarTextoCadastro(bruto.nome) ?? '').slice(0, 60)
  if (!nomeVenda || nomeVenda.length < 2) {
    return { erro: 'Nome de venda inválido ou curto demais', sku }
  }

  const marca = normalizarTextoCadastro(bruto.marca)?.slice(0, 100)
  if (!marca) {
    return { erro: 'Marca obrigatória ausente', sku }
  }

  const unidade = normalizarSiglaUnidade(bruto.undVenda || 'UN')
  const ativo = parsearBooleanoSantri(bruto.ativo) ?? true
  const bloqueadoCompra = parsearBooleanoSantri(bruto.bloqueadoCompras) ?? false
  const pronta = parsearBooleanoSantri(bruto.prontaEntrega)
  const kit = parsearBooleanoSantri(bruto.kit) === true
  if (kit) {
    avisos.push({
      campo: 'kit',
      mensagem: 'Produto marcado como kit no Santri; importado como produto simples',
    })
  }

  const { ncm, aviso: avisoNcm } = normalizarNcm(bruto.ncm)
  if (avisoNcm) avisos.push({ campo: 'ncm', mensagem: avisoNcm })

  const codigoOrigem = normalizarCodigoOrigem(bruto.origem)
  const { codigoBarras, aviso: avisoGtin } = normalizarGtin(bruto.codigoBarras)
  if (avisoGtin) avisos.push({ campo: 'codigoBarras', mensagem: avisoGtin })

  const pesoKg = parsearDecimalSantri(bruto.pesoUnidade)
  const alturaCm = parsearDecimalSantri(bruto.alturaUnidade)
  const larguraCm = parsearDecimalSantri(bruto.larguraUnidade)
  const comprimentoCm = parsearDecimalSantri(bruto.comprimentoUnidade)
  const capacidadeEmpilhamento = (() => {
    const n = parsearDecimalSantri(bruto.capacidadeEmpilhamento)
    return n != null ? Math.round(n) : undefined
  })()

  let multiploVenda = parsearDecimalSantri(bruto.multiploVenda) ?? 1
  if (!(multiploVenda > 0)) multiploVenda = 1
  // Sem venda fracionada: múltiplo deve ser inteiro
  if (Math.abs(multiploVenda - Math.round(multiploVenda)) > 1e-9) {
    avisos.push({
      campo: 'multiploVenda',
      mensagem: `Múltiplo de venda fracionário ${multiploVenda} arredondado`,
    })
    multiploVenda = Math.round(multiploVenda) || 1
  }

  const embalagensMaster: ProdutoSantriNormalizado['embalagensMaster'] = []
  const altCx = parsearDecimalSantri(bruto.alturaCaixa)
  const largCx = parsearDecimalSantri(bruto.larguraCaixa)
  const compCx = parsearDecimalSantri(bruto.comprimentoCaixa)
  const multCompra = parsearDecimalSantri(bruto.multiploCompraUnitario)
  if (altCx || largCx || compCx) {
    const qtd =
      multCompra != null && multCompra > 1
        ? multCompra
        : parsearDecimalSantri(bruto.multiploCompraSecundario)
    if (qtd != null && qtd > 0) {
      embalagensMaster.push({
        quantidade: qtd,
        alturaCm: altCx,
        larguraCm: largCx,
        comprimentoCm: compCx,
      })
    } else {
      avisos.push({
        campo: 'embalagensMaster',
        mensagem: 'Dimensões de caixa sem quantidade válida; embalagem master omitida',
      })
    }
  }

  const nomeCompra =
    normalizarTextoCadastro(bruto.nomeCompra)?.slice(0, 200) || nomeVenda

  return {
    sku,
    nomeVenda,
    nomeCompra,
    marca,
    unidade,
    ativo,
    bloqueadoCompra,
    controlaEstoque: true,
    permiteEstoqueNegativo: parsearBooleanoSantri(bruto.aceitaEstoqueNegativo) ?? false,
    entregaNoAto: pronta ?? true,
    entregaARetirar: true,
    entregar: true,
    flagComissao: true,
    flagDevolucao: true,
    ncm,
    codigoOrigem,
    codigoBarras,
    pesoKg,
    alturaCm,
    larguraCm,
    comprimentoCm,
    capacidadeEmpilhamento,
    multiploVenda,
    permiteVendaFracionada: false,
    embalagensMaster,
    fase2: {
      codigoOriginal: bruto.codigoOriginal || undefined,
      undCompra: bruto.undCompra
        ? normalizarSiglaUnidade(bruto.undCompra)
        : undefined,
      multiploCompraUnitario: multCompra,
      multiploCompraSecundario: parsearDecimalSantri(bruto.multiploCompraSecundario),
      fabricante: bruto.fabricante || undefined,
      precoSantriIgnorado: parsearDecimalSantri(bruto.preco),
      estoqueSantriIgnorado: parsearDecimalSantri(bruto.estoque),
      kit,
    },
    avisos,
  }
}
