import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  extrairDuplicatasCobrancaDoXml,
  extrairCampoXml,
  montarParcelasContaPagarDaNfe,
  normalizarXmlNfe,
} from '../focus-nfe/parser-xml-nfe.js'
import { repositorioDeContasAPagar, ErroBaixa } from './repositorio-contas-a-pagar.js'
import {
  primeiroPlanoLiberadoFornecedor,
  resolverPlanoFinanceiroEntrada,
} from './resolver-plano-financeiro-entrada.js'
import { resolverParcelasRecorrencia } from './resolver-parcelas-recorrencia.js'

function decimalNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

function dataIsoDia(v: Date | string | null | undefined): Date | null {
  if (v == null) return null
  const d = v instanceof Date ? new Date(v) : new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

type ParcelaStub = {
  numeroDocumento?: string | null
  vencimento?: string | Date | null
  valor?: number | string | null
}

function parcelasDoStubDespesa(despesa: {
  numeroDocumento: string | null
  vencimento: Date | null
  valor: unknown
  parcelas: unknown
}): Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }> {
  const lista: ParcelaStub[] =
    Array.isArray(despesa.parcelas) && despesa.parcelas.length > 0
      ? (despesa.parcelas as ParcelaStub[])
      : [
          {
            numeroDocumento: despesa.numeroDocumento,
            vencimento: despesa.vencimento,
            valor: decimalNum(despesa.valor),
          },
        ]

  const out: Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }> = []
  for (const p of lista) {
    const vencimento = dataIsoDia(p.vencimento ?? null)
    const valor = decimalNum(p.valor)
    if (!vencimento || !(valor > 0)) continue
    out.push({
      numeroDocumento: p.numeroDocumento?.toString().trim() || null,
      vencimento,
      valor,
    })
  }
  return out
}

async function promoverFreteParaContaPagar(companyId: string, notaMercadoriaId: string) {
  const nota = await clientePrisma.nfeRecebida.findFirst({
    where: { id: notaMercadoriaId, companyId },
    select: {
      id: true,
      modFrete: true,
      vinculosComoNfe: {
        select: {
          cteRecebidaId: true,
          cteRecebida: {
            select: {
              id: true,
              fornecedorPessoaId: true,
              chaveNfe: true,
              dataEmissao: true,
            },
          },
        },
      },
    },
  })
  if (!nota || nota.modFrete !== '1') {
    return [] as Array<{ id: string; codigo: string; origem: string }>
  }

  const criados: Array<{ id: string; codigo: string; origem: string }> = []

  for (const v of nota.vinculosComoNfe) {
    const cteId = v.cteRecebidaId
    const despesa = await clientePrisma.despesaEntradaDocumento.findUnique({
      where: { nfeRecebidaId_origem: { nfeRecebidaId: cteId, origem: 'cte' } },
    })
    if (!despesa) continue

    const parcelas = parcelasDoStubDespesa(despesa)
    if (parcelas.length === 0) continue

    const planoFinanceiroId =
      despesa.planoFinanceiroId ??
      (await primeiroPlanoLiberadoFornecedor(
        companyId,
        despesa.pessoaId ?? v.cteRecebida?.fornecedorPessoaId ?? null
      ))

    try {
      const { conta, criado } = await repositorioDeContasAPagar.criarDeEntrada(companyId, {
        origem: 'cte',
        pessoaId: despesa.pessoaId ?? v.cteRecebida?.fornecedorPessoaId ?? null,
        planoFinanceiroId,
        // Liga à NF de mercadoria para filtrar/listar juntos na Entrada
        nfeRecebidaId: notaMercadoriaId,
        despesaEntradaId: despesa.id,
        numeroDocumento:
          despesa.numeroDocumento ??
          (v.cteRecebida?.chaveNfe ? v.cteRecebida.chaveNfe.slice(-9) : null),
        dataEmissao: v.cteRecebida?.dataEmissao ?? null,
        observacao: `Frete CT-e ${v.cteRecebida?.chaveNfe?.slice(-8) ?? cteId.slice(0, 8)}…`,
        parcelas,
      })
      if (criado) {
        criados.push({ id: conta.id, codigo: conta.codigo, origem: 'cte' })
      }
    } catch (e) {
      if (e instanceof ErroBaixa) {
        throw new ErroDaAplicacao(e.message, 400)
      }
      throw e
    }
  }

  return criados
}

function parcelasDaNotaDocumental(nota: {
  valorTotal: unknown
  parcelasFinanceiras: unknown
}): Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }> {
  const stub = {
    numeroDocumento: null as string | null,
    vencimento: null as Date | null,
    valor: nota.valorTotal,
    parcelas: nota.parcelasFinanceiras,
  }
  return parcelasDoStubDespesa(stub)
}

/**
 * Título NFe Revenda cujas parcelas não batem com `cobr/dup` do XML:
 * regrava se aberto e sem baixa (§7.16 / chamado duplicatas).
 */
async function tentarRepararParcelasDuplicatasXml(
  companyId: string,
  nota: {
    xmlConteudo: string | null
    valorTotal: unknown
    prazoPagamentoXml: string | null
    prazoPagamentoTexto: string | null
    tipoDocumento?: string | null
    finalidadeEntrada?: string | null
  },
  conta: {
    id: string
    status: string
    valorTotal: number
    parcelas?: Array<{
      numeroDocumento?: string | null
      vencimento?: string | Date | null
      valor: number
      valorPago: number
      baixas?: unknown[]
    }>
  }
) {
  if (conta.status !== 'aberto') return null
  const tipo = nota.tipoDocumento || 'nfe55'
  if (tipo === 'nfse' || (tipo === 'nfe55' && nota.finalidadeEntrada === 'uso_consumo')) {
    return null
  }

  const parcelasAtuais = conta.parcelas ?? []
  if (parcelasAtuais.some((p) => (p.baixas?.length ?? 0) > 0 || p.valorPago > 0)) {
    return null
  }

  const valorNf = decimalNum(nota.valorTotal)
  if (!(valorNf > 0)) return null

  const xml = nota.xmlConteudo ? normalizarXmlNfe(nota.xmlConteudo) : ''
  const dupsXml = xml ? extrairDuplicatasCobrancaDoXml(xml) : []
  const dupsComVenc = dupsXml.filter((d) => d.vencimento != null)
  if (dupsComVenc.length < 2) return null

  const montagem = montarParcelasContaPagarDaNfe({
    duplicatasXml: dupsXml,
    valorTotalNf: valorNf,
    prazoPagamentoXml: nota.prazoPagamentoXml,
    prazoPagamentoTexto: nota.prazoPagamentoTexto,
  })
  if (!montagem.ok || montagem.parcelas.length < 2) return null

  const esperadas = montagem.parcelas
  if (parcelasBatemComEsperadas(parcelasAtuais, esperadas)) return null

  return repositorioDeContasAPagar.substituirParcelasSemBaixa(
    companyId,
    conta.id,
    esperadas
  )
}

function diaCivil(v: string | Date | null | undefined): string | null {
  if (v == null) return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return v.toISOString().slice(0, 10)
  }
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

function parcelasBatemComEsperadas(
  atuais: Array<{
    numeroDocumento?: string | null
    vencimento?: string | Date | null
    valor: number
  }>,
  esperadas: Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }>
): boolean {
  if (atuais.length !== esperadas.length) return false
  for (let i = 0; i < esperadas.length; i++) {
    const a = atuais[i]
    const e = esperadas[i]
    if (!a || !e) return false
    if (Math.abs(a.valor - e.valor) > 0.02) return false
    if (diaCivil(a.vencimento) !== diaCivil(e.vencimento)) return false
    const docA = (a.numeroDocumento ?? '').trim()
    const docE = (e.numeroDocumento ?? '').trim()
    if (docE && docA && docA !== docE) return false
  }
  return true
}

export type ResultadoReparoDuplicatasCap = {
  examinados: number
  reparados: number
  pulados: number
  detalhes: Array<{
    companyId: string
    contaId: string
    codigo: string
    nfeRecebidaId: string
    de: number
    para: number
  }>
}

/**
 * Varre Contas a Pagar origem NFe (todas as empresas ou uma) e corrige
 * títulos abertos sem baixa cujas parcelas não batem com `<dup>` do XML.
 */
export async function repararParcelasDuplicatasContasPagar(opcoes?: {
  companyId?: string
  dryRun?: boolean
  limite?: number
}): Promise<ResultadoReparoDuplicatasCap> {
  const where: {
    origem: string
    status: string
    nfeRecebidaId: { not: null }
    companyId?: string
  } = {
    origem: 'nfe',
    status: 'aberto',
    nfeRecebidaId: { not: null },
  }
  if (opcoes?.companyId) where.companyId = opcoes.companyId

  const rows = await clientePrisma.contaPagar.findMany({
    where,
    select: {
      id: true,
      companyId: true,
      codigo: true,
      status: true,
      valorTotal: true,
      nfeRecebidaId: true,
      parcelas: {
        orderBy: { numeroParcela: 'asc' },
        select: {
          numeroDocumento: true,
          vencimento: true,
          valor: true,
          valorPago: true,
          baixas: { take: 1, select: { id: true } },
        },
      },
      nfeRecebida: {
        select: {
          id: true,
          tipoDocumento: true,
          finalidadeEntrada: true,
          xmlConteudo: true,
          valorTotal: true,
          prazoPagamentoXml: true,
          prazoPagamentoTexto: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: opcoes?.limite && opcoes.limite > 0 ? opcoes.limite : undefined,
  })

  const resultado: ResultadoReparoDuplicatasCap = {
    examinados: 0,
    reparados: 0,
    pulados: 0,
    detalhes: [],
  }

  for (const row of rows) {
    resultado.examinados += 1
    const nota = row.nfeRecebida
    if (!nota || !row.nfeRecebidaId) {
      resultado.pulados += 1
      continue
    }

    const conta = {
      id: row.id,
      status: row.status,
      valorTotal: decimalNum(row.valorTotal),
      parcelas: row.parcelas.map((p) => ({
        numeroDocumento: p.numeroDocumento,
        vencimento: p.vencimento,
        valor: decimalNum(p.valor),
        valorPago: decimalNum(p.valorPago),
        baixas: p.baixas,
      })),
    }

    if (opcoes?.dryRun) {
      const tipo = nota.tipoDocumento || 'nfe55'
      if (tipo === 'nfse' || (tipo === 'nfe55' && nota.finalidadeEntrada === 'uso_consumo')) {
        resultado.pulados += 1
        continue
      }
      if (conta.parcelas.some((p) => (p.baixas?.length ?? 0) > 0 || p.valorPago > 0)) {
        resultado.pulados += 1
        continue
      }
      const xml = nota.xmlConteudo ? normalizarXmlNfe(nota.xmlConteudo) : ''
      const dupsXml = xml ? extrairDuplicatasCobrancaDoXml(xml) : []
      if (dupsXml.filter((d) => d.vencimento != null).length < 2) {
        resultado.pulados += 1
        continue
      }
      const montagem = montarParcelasContaPagarDaNfe({
        duplicatasXml: dupsXml,
        valorTotalNf: decimalNum(nota.valorTotal),
        prazoPagamentoXml: nota.prazoPagamentoXml,
        prazoPagamentoTexto: nota.prazoPagamentoTexto,
      })
      if (!montagem.ok || montagem.parcelas.length < 2) {
        resultado.pulados += 1
        continue
      }
      if (parcelasBatemComEsperadas(conta.parcelas, montagem.parcelas)) {
        resultado.pulados += 1
        continue
      }
      resultado.reparados += 1
      resultado.detalhes.push({
        companyId: row.companyId,
        contaId: row.id,
        codigo: row.codigo,
        nfeRecebidaId: row.nfeRecebidaId,
        de: conta.parcelas.length,
        para: montagem.parcelas.length,
      })
      continue
    }

    const reparado = await tentarRepararParcelasDuplicatasXml(row.companyId, nota, conta)
    if (reparado) {
      resultado.reparados += 1
      resultado.detalhes.push({
        companyId: row.companyId,
        contaId: row.id,
        codigo: row.codigo,
        nfeRecebidaId: row.nfeRecebidaId,
        de: conta.parcelas.length,
        para: reparado.parcelas?.length ?? 0,
      })
    } else {
      resultado.pulados += 1
    }
  }

  return resultado
}

async function gerarTituloMercadoriaNfe(
  companyId: string,
  notaId: string,
  opcoes?: { exigirVencimento?: boolean }
) {
  const nota = await clientePrisma.nfeRecebida.findFirst({
    where: { id: notaId, companyId },
    select: {
      id: true,
      tipoDocumento: true,
      finalidadeEntrada: true,
      xmlConteudo: true,
      valorTotal: true,
      dataEmissao: true,
      fornecedorPessoaId: true,
      chaveNfe: true,
      prazoPagamentoXml: true,
      prazoPagamentoTexto: true,
      recorrenciaFinanceiraId: true,
      cfopEntradaId: true,
      planoFinanceiroId: true,
      parcelasFinanceiras: true,
      recorrenciaFinanceira: {
        select: {
          id: true,
          produto: { select: { nomeVenda: true } },
        },
      },
    },
  })
  if (!nota) return null

  const tipo = nota.tipoDocumento || 'nfe55'
  const porRecorrencia = Boolean(nota.recorrenciaFinanceiraId)
  const ehNfse = tipo === 'nfse'
  const ehNfe55 = tipo === 'nfe55'
  /** NFS-e e NFe 55 Uso e Consumo: prévia financeira da nota (§7.16). */
  const ehDocumental = ehNfse || (ehNfe55 && nota.finalidadeEntrada === 'uso_consumo')

  if (!ehNfe55 && !ehNfse) return null

  const existente = await repositorioDeContasAPagar.buscarPorNfeOrigem(companyId, notaId, 'nfe')
  if (existente) {
    if (!ehDocumental && !porRecorrencia) {
      const reparado = await tentarRepararParcelasDuplicatasXml(companyId, nota, existente)
      if (reparado) return { conta: reparado, criado: false as const }
    }
    return { conta: existente, criado: false as const }
  }

  const valorTotal = decimalNum(nota.valorTotal)
  const planoFinanceiroId = await resolverPlanoFinanceiroEntrada(companyId, {
    notaId,
    fornecedorPessoaId: nota.fornecedorPessoaId,
    cfopEntradaId: nota.cfopEntradaId,
    planoGravadoNaNota: nota.planoFinanceiroId,
  })

  if (!planoFinanceiroId && opcoes?.exigirVencimento !== false) {
    throw new ErroDaAplicacao(
      'Informe o plano financeiro na prévia antes de consolidar.',
      400
    )
  }

  let parcelas: Array<{ numeroDocumento: string | null; vencimento: Date; valor: number }>
  let observacao: string
  let numeroDocumento: string | null

  if (ehDocumental) {
    const gravadas = parcelasDaNotaDocumental(nota)
    if (gravadas.length > 0) {
      parcelas = gravadas
    } else if (porRecorrencia) {
      const montagem = await resolverParcelasRecorrencia({
        companyId,
        fornecedorPessoaId: nota.fornecedorPessoaId,
        valorTotal,
        dataEmissao: nota.dataEmissao,
        xmlConteudo: nota.xmlConteudo,
        prazoPagamentoXml: nota.prazoPagamentoXml,
        prazoPagamentoTexto: nota.prazoPagamentoTexto,
        recorrenciaFinanceiraId: nota.recorrenciaFinanceiraId,
      })
      if (!montagem.ok) {
        if (opcoes?.exigirVencimento === false) return null
        throw new ErroDaAplicacao(montagem.mensagem, 400)
      }
      parcelas = montagem.parcelas
    } else {
      if (opcoes?.exigirVencimento === false) return null
      throw new ErroDaAplicacao(
        'Informe a data de vencimento na prévia financeira antes de consolidar.',
        400
      )
    }
    observacao = porRecorrencia
      ? 'Gerado automaticamente por recorrência na Entrada de Notas'
      : ehNfse
        ? 'Gerado na consolidação da NFS-e na Entrada de Notas'
        : 'Gerado na consolidação da NFe de uso e consumo na Entrada de Notas'
    numeroDocumento = nota.chaveNfe ? nota.chaveNfe.slice(-9) : null
  } else if (porRecorrencia) {
    const montagem = await resolverParcelasRecorrencia({
      companyId,
      fornecedorPessoaId: nota.fornecedorPessoaId,
      valorTotal,
      dataEmissao: nota.dataEmissao,
      xmlConteudo: nota.xmlConteudo,
      prazoPagamentoXml: nota.prazoPagamentoXml,
      prazoPagamentoTexto: nota.prazoPagamentoTexto,
      recorrenciaFinanceiraId: nota.recorrenciaFinanceiraId,
    })
    if (!montagem.ok) {
      if (opcoes?.exigirVencimento === false) return null
      throw new ErroDaAplicacao(montagem.mensagem, 400)
    }
    parcelas = montagem.parcelas
    observacao = 'Gerado automaticamente por recorrência na Entrada de Notas'
    numeroDocumento = nota.chaveNfe ? nota.chaveNfe.slice(-9) : null
  } else {
    const xml = nota.xmlConteudo ? normalizarXmlNfe(nota.xmlConteudo) : ''
    const dupsXml = xml ? extrairDuplicatasCobrancaDoXml(xml) : []
    const montagem = montarParcelasContaPagarDaNfe({
      duplicatasXml: dupsXml,
      valorTotalNf: valorTotal,
      prazoPagamentoXml: nota.prazoPagamentoXml,
      prazoPagamentoTexto: nota.prazoPagamentoTexto,
    })
    if (!montagem.ok) {
      if (opcoes?.exigirVencimento === false) return null
      throw new ErroDaAplicacao(montagem.mensagem, 400)
    }
    parcelas = montagem.parcelas
    const nNF = xml ? extrairCampoXml(xml, 'nNF') : null
    numeroDocumento = nNF ?? (nota.chaveNfe ? nota.chaveNfe.slice(-9) : null)
    observacao = 'Gerado automaticamente na Entrada de Notas'
  }

  try {
    return await repositorioDeContasAPagar.criarDeEntrada(companyId, {
      origem: 'nfe',
      pessoaId: nota.fornecedorPessoaId,
      planoFinanceiroId,
      nfeRecebidaId: notaId,
      despesaEntradaId: null,
      numeroDocumento,
      dataEmissao: nota.dataEmissao,
      observacao,
      parcelas,
    })
  } catch (e) {
    if (e instanceof ErroBaixa) {
      throw new ErroDaAplicacao(e.message, 400)
    }
    throw e
  }
}

/**
 * Gera Contas a Pagar da mercadoria (NFe / NFS-e por recorrência) e promove stubs de frete (CT-e).
 * Idempotente — seguro chamar em Liberar contagem e Consolidar.
 */
export async function gerarTitulosContasPagarDaEntrada(
  companyId: string,
  notaId: string,
  opcoes?: { exigirVencimentoMercadoria?: boolean }
) {
  const criados: Array<{ id: string; codigo: string; origem: string }> = []

  const mercadoria = await gerarTituloMercadoriaNfe(companyId, notaId, {
    exigirVencimento: opcoes?.exigirVencimentoMercadoria !== false,
  })
  if (mercadoria?.criado) {
    criados.push({
      id: mercadoria.conta.id,
      codigo: mercadoria.conta.codigo,
      origem: 'nfe',
    })
  }

  const fretes = await promoverFreteParaContaPagar(companyId, notaId)
  criados.push(...fretes)

  return {
    gerados: criados.length,
    contas: criados,
  }
}
