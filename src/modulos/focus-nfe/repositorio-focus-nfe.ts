/**
 * Persistência Focus NFe / NFe recebidas.
 */
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { normalizarDocumento } from '../../compartilhado/validacoes/documentos.js'
import { REGRAS_FISCAIS_PADRAO } from './esquema-focus-nfe.js'
import { xmlNfeTemItensParseaveis } from './parser-xml-nfe.js'

function resolverNfeCompleta(params: {
  tipoDocumento: string | null | undefined
  xmlConteudo: string | null | undefined
  nfeCompleta?: boolean
}): boolean {
  const tipo = params.tipoDocumento ?? 'nfe55'
  if (tipo !== 'nfe55') return params.nfeCompleta ?? false
  if (!params.xmlConteudo) return false
  if (!xmlNfeTemItensParseaveis(params.xmlConteudo)) return false
  return params.nfeCompleta ?? true
}

async function buscarConfigPorEmpresa(companyId: string) {
  return clientePrisma.configuracaoFocusNfe.findUnique({ where: { companyId } })
}

async function salvarConfig(companyId: string, apiToken: string, homologacao: boolean) {
  return clientePrisma.configuracaoFocusNfe.upsert({
    where: { companyId },
    create: {
      companyId,
      apiToken,
      homologacao,
      regrasFiscaisJson: REGRAS_FISCAIS_PADRAO,
    },
    update: { apiToken, homologacao, updatedAt: new Date() },
  })
}

async function salvarRegrasFiscais(
  companyId: string,
  regras: {
    versaoSchema: 1
    ativo: boolean
    checks: Array<'ncm' | 'origem' | 'cst_cfop'>
    observacao?: string | null
  }
) {
  const existente = await buscarConfigPorEmpresa(companyId)
  if (!existente) {
    return null
  }
  return clientePrisma.configuracaoFocusNfe.update({
    where: { companyId },
    data: {
      regrasFiscaisJson: {
        versaoSchema: 1,
        ativo: regras.ativo,
        checks: regras.checks,
        observacao: regras.observacao ?? null,
      },
      updatedAt: new Date(),
    },
  })
}

async function atualizarUltimaVersao(companyId: string, versao: number) {
  return clientePrisma.configuracaoFocusNfe.update({
    where: { companyId },
    data: { ultimaVersaoNfeRecebida: versao },
  })
}

async function atualizarUltimaVersaoNfse(companyId: string, versao: number) {
  return clientePrisma.configuracaoFocusNfe.update({
    where: { companyId },
    data: { ultimaVersaoNfseRecebida: versao },
  })
}

async function atualizarUltimaVersaoCte(companyId: string, versao: number) {
  return clientePrisma.configuracaoFocusNfe.update({
    where: { companyId },
    data: { ultimaVersaoCteRecebida: versao },
  })
}

async function resetarUltimaVersao(companyId: string) {
  const cfg = await buscarConfigPorEmpresa(companyId)
  if (!cfg) return null
  return clientePrisma.configuracaoFocusNfe.update({
    where: { companyId },
    data: {
      ultimaVersaoNfeRecebida: 0,
      ultimaVersaoNfseRecebida: 0,
      ultimaVersaoCteRecebida: 0,
    },
  })
}

async function criarJob(dados: {
  companyId: string
  tipo: string
  payloadJson?: unknown
}) {
  return clientePrisma.focusNfeJob.create({
    data: {
      companyId: dados.companyId,
      tipo: dados.tipo,
      status: 'pendente',
      payloadJson: dados.payloadJson as object | undefined,
    },
  })
}

async function atualizarJob(
  id: string,
  data: {
    status?: string
    progresso?: number
    mensagem?: string | null
    logResumo?: string | null
    iniciadoEm?: Date | null
    finalizadoEm?: Date | null
  }
) {
  return clientePrisma.focusNfeJob.update({ where: { id }, data })
}

async function buscarJob(id: string, companyId: string) {
  return clientePrisma.focusNfeJob.findFirst({ where: { id, companyId } })
}

function parseValorBusca(termo: string): number | null {
  const t = termo.trim()
  if (!t) return null
  // 1.500,50 ou 1500,50 → 1500.50
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(t) || /^\d+,\d{1,2}$/.test(t)) {
    const n = Number(t.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  // 1500.50
  if (/^\d+(\.\d{1,2})?$/.test(t)) {
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

async function listarNfesPorPainel(
  companyId: string,
  filtros?: {
    dataDe?: Date
    dataAte?: Date
    painel?: 'analise' | 'contagem' | 'consolidada' | 'problemas' | 'cancelada'
    busca?: string
  }
) {
  const painel = filtros?.painel ?? 'analise'
  const statusPorPainel: Record<string, string[]> = {
    analise: ['pendente', 'em_analise', 'stand_by'],
    contagem: ['entrada_contagem'],
    consolidada: ['entrada_consolidada'],
    problemas: ['com_problema', 'problema_resolvido'],
    cancelada: ['cancelada'],
  }
  const statuses = statusPorPainel[painel] ?? statusPorPainel.analise

  const dataFiltro =
    filtros?.dataDe || filtros?.dataAte
      ? {
          dataEmissao: {
            ...(filtros.dataDe ? { gte: filtros.dataDe } : {}),
            ...(filtros.dataAte ? { lte: filtros.dataAte } : {}),
          },
        }
      : {}

  const busca = (filtros?.busca ?? '').trim()
  let buscaFiltro: Record<string, unknown> = {}
  if (busca) {
    const or: Array<Record<string, unknown>> = [
      { nomeEmitente: { contains: busca, mode: 'insensitive' } },
      { chaveNfe: { contains: busca, mode: 'insensitive' } },
    ]
    const soDigitos = busca.replace(/\D/g, '')
    const alfa = normalizarDocumento(busca)
    if (soDigitos.length >= 3) {
      or.push({ documentoEmitente: { contains: soDigitos } })
      or.push({ cnpjDestinatario: { contains: soDigitos } })
    }
    if (alfa.length >= 3 && alfa !== soDigitos) {
      or.push({ documentoEmitente: { contains: alfa } })
      or.push({ cnpjDestinatario: { contains: alfa } })
    }
    const valor = parseValorBusca(busca)
    if (valor != null) {
      or.push({ valorTotal: valor })
    }
    buscaFiltro = { OR: or }
  }

  return clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      statusEntrada: { in: statuses },
      ...dataFiltro,
      ...buscaFiltro,
    },
    orderBy: [{ dataEmissao: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: {
        select: {
          vinculosComoCte: true,
          vinculosComoNfe: true,
        },
      },
    },
  })
}

async function buscarPorId(companyId: string, id: string) {
  return clientePrisma.nfeRecebida.findFirst({ where: { id, companyId } })
}

async function listarCompanyIdsComFocusAtivo() {
  const rows = await clientePrisma.configuracaoFocusNfe.findMany({
    where: { ativo: true, apiToken: { not: '' } },
    select: { companyId: true },
  })
  return rows.map((r) => r.companyId)
}

/** @deprecated use listarNfesPorPainel — mantido como alias do painel análise */
async function listarNfesPendentes(
  companyId: string,
  filtros?: { dataDe?: Date; dataAte?: Date }
) {
  return listarNfesPorPainel(companyId, { ...filtros, painel: 'analise' })
}

async function listarComXmlPendenteCampos(companyId: string) {
  return clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      xmlConteudo: { not: null },
      statusEntrada: { in: ['pendente', 'em_analise', 'stand_by'] },
    },
    select: { id: true, chaveNfe: true, xmlConteudo: true },
  })
}

async function buscarPorChave(companyId: string, chaveNfe: string) {
  return clientePrisma.nfeRecebida.findUnique({
    where: { companyId_chaveNfe: { companyId, chaveNfe } },
  })
}

async function upsertNfeRecebida(dados: {
  companyId: string
  chaveNfe: string
  tipoDocumento?: string
  nomeEmitente?: string | null
  documentoEmitente?: string | null
  cnpjDestinatario?: string | null
  valorTotal?: number | null
  dataEmissao?: Date | null
  situacao?: string | null
  manifestacaoDestinatario?: string | null
  nfeCompleta?: boolean
  tipoNfe?: string | null
  versaoFocus?: number
  origem?: string
  xmlConteudo?: string | null
  etapaAtual?: string
  modFrete?: string | null
  chaveNfeReferenciada?: string | null
}) {
  const existente = await buscarPorChave(dados.companyId, dados.chaveNfe)
  if (existente) {
    const tipoDocumento = dados.tipoDocumento ?? existente.tipoDocumento
    const xmlConteudo = dados.xmlConteudo ?? existente.xmlConteudo
    const nfeCompleta = resolverNfeCompleta({
      tipoDocumento,
      xmlConteudo,
      nfeCompleta: dados.nfeCompleta ?? existente.nfeCompleta,
    })
    return {
      registro: await clientePrisma.nfeRecebida.update({
        where: { id: existente.id },
        data: {
          tipoDocumento,
          nomeEmitente: dados.nomeEmitente ?? existente.nomeEmitente,
          documentoEmitente: dados.documentoEmitente ?? existente.documentoEmitente,
          cnpjDestinatario: dados.cnpjDestinatario ?? existente.cnpjDestinatario,
          valorTotal: dados.valorTotal ?? existente.valorTotal,
          dataEmissao: dados.dataEmissao ?? existente.dataEmissao,
          situacao: dados.situacao ?? existente.situacao,
          manifestacaoDestinatario:
            dados.manifestacaoDestinatario ?? existente.manifestacaoDestinatario,
          nfeCompleta,
          tipoNfe: dados.tipoNfe ?? existente.tipoNfe,
          versaoFocus: dados.versaoFocus ?? existente.versaoFocus,
          xmlConteudo,
          ...(dados.etapaAtual ? { etapaAtual: dados.etapaAtual } : {}),
          ...(dados.modFrete !== undefined ? { modFrete: dados.modFrete } : {}),
          ...(dados.chaveNfeReferenciada !== undefined
            ? { chaveNfeReferenciada: dados.chaveNfeReferenciada }
            : {}),
        },
      }),
      criado: false,
    }
  }

  const tipoDocumento = dados.tipoDocumento ?? 'nfe55'
  const nfeCompleta = resolverNfeCompleta({
    tipoDocumento,
    xmlConteudo: dados.xmlConteudo,
    nfeCompleta: dados.nfeCompleta,
  })
  return {
    registro: await clientePrisma.nfeRecebida.create({
      data: {
        companyId: dados.companyId,
        chaveNfe: dados.chaveNfe,
        tipoDocumento,
        nomeEmitente: dados.nomeEmitente,
        documentoEmitente: dados.documentoEmitente,
        cnpjDestinatario: dados.cnpjDestinatario,
        valorTotal: dados.valorTotal,
        dataEmissao: dados.dataEmissao,
        situacao: dados.situacao,
        manifestacaoDestinatario: dados.manifestacaoDestinatario,
        nfeCompleta,
        tipoNfe: dados.tipoNfe,
        versaoFocus: dados.versaoFocus ?? 0,
        origem: dados.origem ?? 'focus',
        xmlConteudo: dados.xmlConteudo,
        statusEntrada: 'pendente',
        etapaAtual: dados.etapaAtual ?? 'cadastro',
        modFrete: dados.modFrete ?? null,
        chaveNfeReferenciada: dados.chaveNfeReferenciada ?? null,
      },
    }),
    criado: true,
  }
}

async function buscarEmpresaCnpj(companyId: string) {
  return clientePrisma.company.findUnique({
    where: { id: companyId },
    select: { cnpj: true, name: true },
  })
}

async function atualizarDanfe(
  id: string,
  dados: {
    danfeCaminho?: string | null
    danfeStatus?: string | null
    danfeAtualizadoEm?: Date | null
  }
) {
  return clientePrisma.nfeRecebida.update({
    where: { id },
    data: {
      ...(dados.danfeCaminho !== undefined ? { danfeCaminho: dados.danfeCaminho } : {}),
      ...(dados.danfeStatus !== undefined ? { danfeStatus: dados.danfeStatus } : {}),
      ...(dados.danfeAtualizadoEm !== undefined
        ? { danfeAtualizadoEm: dados.danfeAtualizadoEm }
        : {}),
    },
  })
}

export const repositorioFocusNfe = {
  buscarConfigPorEmpresa,
  salvarConfig,
  salvarRegrasFiscais,
  atualizarUltimaVersao,
  atualizarUltimaVersaoNfse,
  atualizarUltimaVersaoCte,
  resetarUltimaVersao,
  criarJob,
  atualizarJob,
  buscarJob,
  listarNfesPendentes,
  listarNfesPorPainel,
  listarComXmlPendenteCampos,
  buscarPorChave,
  buscarPorId,
  listarCompanyIdsComFocusAtivo,
  upsertNfeRecebida,
  buscarEmpresaCnpj,
  atualizarDanfe,
}
