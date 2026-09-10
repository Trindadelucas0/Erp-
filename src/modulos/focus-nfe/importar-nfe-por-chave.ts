/**
 * Importa NFe 55 pela chave via Focus (ciência + XML + fallback JSON), independente do DistDFe.
 * Usado quando CT-e referencia NF ainda ausente ou só com resumo `resNFe` no ERP.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioEntradaNotas } from '../entrada-notas/repositorio-entrada-notas.js'
import { clienteFocusNfe } from './cliente-focus-nfe.js'
import { logFocus } from './logs-focus-nfe.js'
import {
  extrairCamposResumoDoXml,
  extrairItensDoJsonFocusCompleta,
  xmlNfeTemItensParseaveis,
} from './parser-xml-nfe.js'
import { repositorioFocusNfe } from './repositorio-focus-nfe.js'
import { comContextoEmpresaFocus } from './protecao-focus-nfe.js'

export type ResultadoImportNfePorChave =
  | { ok: true; notaId: string; jaExistia: boolean }
  | { ok: false; mensagem: string }

const INTERVALO_RETRY_XML_MS = 2500

function lerTokenEnvFocus(): string | null {
  const token = process.env.FOCUS_NFE_TOKEN?.trim()
  return token || null
}

function lerHomologacaoEnvFocus(): boolean {
  const raw = (process.env.FOCUS_NFE_HOMOLOGACAO ?? 'true').trim().toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'nao' || raw === 'não') return false
  return true
}

async function obterCredenciaisFocus(companyId: string): Promise<{
  apiToken: string
  homologacao: boolean
}> {
  const config = await repositorioFocusNfe.buscarConfigPorEmpresa(companyId)
  if (config?.ativo && config.apiToken) {
    return {
      apiToken: config.apiToken.trim(),
      homologacao: config.homologacao,
    }
  }
  const tokenEnv = lerTokenEnvFocus()
  if (tokenEnv) {
    return { apiToken: tokenEnv, homologacao: lerHomologacaoEnvFocus() }
  }
  throw new ErroDaAplicacao(
    'Focus NFe não configurado. Acesse Configurações → Focus NFe ou defina FOCUS_NFE_TOKEN.',
    400
  )
}

function mensagemFocus404(chave: string): string {
  return (
    `Focus não encontrou a NF …${chave.slice(-8)} para o CNPJ desta empresa ` +
    `(404). A chave do CT-e está correta, mas a NF ainda não chegou no DistDFe ` +
    `ou a empresa não é destinatária. Importe o XML da NF na Entrada de Notas.`
  )
}

function mensagemResumoDistDfe(chave: string): string {
  return (
    `Focus ainda devolveu resumo DistDFe (sem itens) para a NF …${chave.slice(-8)}. ` +
    `Importe o XML completo ou tente Reanalisar / BUSCAR mais tarde.`
  )
}

/**
 * Garante NFe 55 local a partir da chave (44 dígitos).
 * Se já houver XML completo ou itens no banco, só devolve o id.
 */
export async function importarNfePorChave(
  companyId: string,
  chaveNfeBruta: string
): Promise<ResultadoImportNfePorChave> {
  const chave = chaveNfeBruta.replace(/\D/g, '')
  if (chave.length !== 44 || chave.slice(20, 22) !== '55') {
    return { ok: false, mensagem: 'Chave de NF-e inválida (esperado 44 dígitos, modelo 55).' }
  }

  const existente = await repositorioFocusNfe.buscarPorChave(companyId, chave)
  if (existente?.xmlConteudo && xmlNfeTemItensParseaveis(existente.xmlConteudo)) {
    return { ok: true, notaId: existente.id, jaExistia: true }
  }
  if (existente) {
    const qtd = await repositorioEntradaNotas.contarItens(existente.id)
    if (qtd > 0) {
      return { ok: true, notaId: existente.id, jaExistia: true }
    }
  }

  return comContextoEmpresaFocus(companyId, () =>
    importarNfePorChaveNaFocus(companyId, chave, existente)
  )
}

async function importarNfePorChaveNaFocus(
  companyId: string,
  chave: string,
  existente: Awaited<ReturnType<typeof repositorioFocusNfe.buscarPorChave>>
): Promise<ResultadoImportNfePorChave> {
  let credenciais: { apiToken: string; homologacao: boolean }
  try {
    credenciais = await obterCredenciaisFocus(companyId)
  } catch (e) {
    const msg = e instanceof ErroDaAplicacao ? e.message : 'Focus NFe não configurado.'
    return { ok: false, mensagem: msg }
  }

  const { apiToken, homologacao } = credenciais
  const empresa = await repositorioFocusNfe.buscarEmpresaCnpj(companyId)
  const cnpjEmpresa = empresa?.cnpj ?? null

  const consultaInicial = await clienteFocusNfe.consultarNfeRecebida(
    apiToken,
    homologacao,
    chave,
    { cnpj: cnpjEmpresa, completa: true }
  )
  if (!consultaInicial.sucesso && consultaInicial.codigoHttp === 404) {
    logFocus('warn', 'import_chave_consulta_404_continua_xml', {
      companyId,
      chave: chave.slice(-8),
      cnpj: cnpjEmpresa
        ? `**********${cnpjEmpresa.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(-4)}`
        : null,
    })
  } else if (!consultaInicial.sucesso && consultaInicial.codigoHttp === 429) {
    return {
      ok: false,
      mensagem: `Focus rate limit (429) ao consultar NF …${chave.slice(-8)}. Tente novamente em instantes.`,
    }
  }

  // Ciência sempre enquanto o XML local ainda é resumo (Focus 573 = duplicidade ok).
  const manResp = await clienteFocusNfe.manifestar(
    apiToken,
    homologacao,
    chave,
    'ciencia',
    undefined,
    cnpjEmpresa
  )
  if (manResp && !manResp.sucesso) {
    logFocus('warn', 'import_chave_ciencia_falhou', {
      companyId,
      chave: chave.slice(-8),
      mensagem: manResp.mensagem,
      codigoHttp: manResp.codigoHttp,
    })
    if (manResp.codigoHttp === 429) {
      return {
        ok: false,
        mensagem: `Focus rate limit (429) na ciência da NF …${chave.slice(-8)}. Tente novamente em instantes.`,
      }
    }
  }

  async function baixarXmlAtual(): Promise<
    | { ok: true; xml: string }
    | { ok: false; codigoHttp?: number; mensagem: string }
  > {
    const xmlResp = await clienteFocusNfe.baixarXml(apiToken, homologacao, chave, cnpjEmpresa)
    if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
      return {
        ok: false,
        codigoHttp: xmlResp.sucesso === false ? xmlResp.codigoHttp : undefined,
        mensagem:
          xmlResp.sucesso === false ? xmlResp.mensagem : 'XML vazio ou indisponível na Focus',
      }
    }
    return { ok: true, xml: xmlResp.dados }
  }

  const xml1 = await baixarXmlAtual()
  if (!xml1.ok) {
    logFocus('warn', 'import_chave_xml_falhou', {
      companyId,
      chave: chave.slice(-8),
      mensagem: xml1.mensagem,
      codigoHttp: xml1.codigoHttp,
    })
    if (xml1.codigoHttp === 429) {
      return {
        ok: false,
        mensagem: `Focus rate limit (429) ao baixar XML da NF …${chave.slice(-8)}. Tente novamente em instantes.`,
      }
    }
    if (xml1.codigoHttp === 404) {
      return { ok: false, mensagem: mensagemFocus404(chave) }
    }
    return {
      ok: false,
      mensagem: `Falha ao importar NF …${chave.slice(-8)} pela Focus: ${xml1.mensagem}`,
    }
  }

  let xml = xml1.xml
  if (!xmlNfeTemItensParseaveis(xml)) {
    await new Promise((r) => setTimeout(r, INTERVALO_RETRY_XML_MS))
    const xml2 = await baixarXmlAtual()
    if (xml2.ok) xml = xml2.xml
  }

  let itensJson: ReturnType<typeof extrairItensDoJsonFocusCompleta> = []
  let modFreteJson: string | null = null
  if (!xmlNfeTemItensParseaveis(xml)) {
    const consulta = await clienteFocusNfe.consultarNfeRecebida(apiToken, homologacao, chave, {
      cnpj: cnpjEmpresa,
      completa: true,
    })
    if (consulta?.sucesso && consulta.dados && typeof consulta.dados === 'object') {
      const dados = consulta.dados as Record<string, unknown>
      itensJson = extrairItensDoJsonFocusCompleta(dados)
      const req = dados.requisicao_nota_fiscal
      if (req && typeof req === 'object') {
        const mf = (req as { modalidade_frete?: unknown }).modalidade_frete
        if (mf != null && String(mf).trim() !== '') modFreteJson = String(mf).trim()
      }
      logFocus('info', 'import_chave_fallback_json', {
        companyId,
        chave: chave.slice(-8),
        itensJson: itensJson.length,
        nfeCompletaFocus: dados.nfe_completa ?? null,
      })
    } else if (consulta && !consulta.sucesso) {
      logFocus('warn', 'import_chave_consulta_completa_falhou', {
        companyId,
        chave: chave.slice(-8),
        mensagem: consulta.mensagem,
        codigoHttp: consulta.codigoHttp,
      })
    }
  }

  const xmlCompleto = xmlNfeTemItensParseaveis(xml)
  const campos = extrairCamposResumoDoXml(xml)

  const { registro } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    tipoDocumento: 'nfe55',
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xml,
    nfeCompleta: xmlCompleto,
    origem: 'focus',
    situacao: existente?.situacao ?? 'autorizada',
    manifestacaoDestinatario: existente?.manifestacaoDestinatario ?? 'ciencia',
    modFrete: campos.modFrete ?? modFreteJson ?? null,
    etapaAtual: 'cadastro',
  })

  if (xmlCompleto) {
    const { servicoEntradaNotas } = await import('../entrada-notas/servico-pipeline-entrada.js')
    await servicoEntradaNotas.processarAposXml(companyId, registro.id)
    logFocus('info', 'import_chave_nfe_ok', {
      companyId,
      chave: chave.slice(-8),
      notaId: registro.id,
    })
    return { ok: true, notaId: registro.id, jaExistia: false }
  }

  if (itensJson.length > 0) {
    const qtd = await repositorioEntradaNotas.contarItens(registro.id)
    if (qtd === 0) {
      await repositorioEntradaNotas.substituirItensDoXml(registro.id, itensJson)
    }
    if (modFreteJson && !existente?.modFrete) {
      await repositorioEntradaNotas.atualizarNota(registro.id, { modFrete: modFreteJson })
    }
    logFocus('info', 'import_chave_nfe_ok_json', {
      companyId,
      chave: chave.slice(-8),
      notaId: registro.id,
      itensJson: itensJson.length,
    })
    return { ok: true, notaId: registro.id, jaExistia: false }
  }

  logFocus('warn', 'import_chave_nfe_ainda_resumo', {
    companyId,
    chave: chave.slice(-8),
    notaId: registro.id,
    bytes: xml.length,
  })
  return { ok: false, mensagem: mensagemResumoDistDfe(chave) }
}
