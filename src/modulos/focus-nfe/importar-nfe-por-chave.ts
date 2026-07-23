/**
 * Importa NFe 55 pela chave via Focus (ciência + XML), independente do DistDFe.
 * Usado quando CT-e referencia NF ainda ausente no ERP.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clienteFocusNfe } from './cliente-focus-nfe.js'
import { logFocus } from './logs-focus-nfe.js'
import { extrairCamposResumoDoXml } from './parser-xml-nfe.js'
import { repositorioFocusNfe } from './repositorio-focus-nfe.js'

export type ResultadoImportNfePorChave =
  | { ok: true; notaId: string; jaExistia: boolean }
  | { ok: false; mensagem: string }

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

/**
 * Garante NFe 55 local a partir da chave (44 dígitos).
 * Se já houver XML completo, só devolve o id.
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
  if (existente?.xmlConteudo && existente.nfeCompleta) {
    return { ok: true, notaId: existente.id, jaExistia: true }
  }

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

  // Consulta individual (com CNPJ) — 404 não aborta: ainda tenta ciência + XML pela chave
  const consulta = await clienteFocusNfe.consultarNfeRecebida(apiToken, homologacao, chave, {
    cnpj: cnpjEmpresa,
    completa: true,
  })
  if (!consulta.sucesso && consulta.codigoHttp === 404) {
    logFocus('warn', 'import_chave_consulta_404_continua_xml', {
      companyId,
      chave: chave.slice(-8),
      cnpj: cnpjEmpresa ? `**********${cnpjEmpresa.replace(/\D/g, '').slice(-4)}` : null,
    })
  } else if (!consulta.sucesso && consulta.codigoHttp === 429) {
    return {
      ok: false,
      mensagem: `Focus rate limit (429) ao consultar NF …${chave.slice(-8)}. Tente novamente em instantes.`,
    }
  }

  // Ciência quando ainda não houve manifesto (mesmo padrão do sync)
  const manFocus =
    consulta.sucesso && consulta.dados && typeof consulta.dados === 'object'
      ? String(
          (consulta.dados as { manifestacao_destinatario?: string }).manifestacao_destinatario ?? ''
        ).toLowerCase()
      : ''
  const manLocal = (existente?.manifestacaoDestinatario ?? '').toLowerCase()
  const man = manFocus || manLocal
  if (!man || man === 'nulo' || man === 'null') {
    const manResp = await clienteFocusNfe.manifestar(
      apiToken,
      homologacao,
      chave,
      'ciencia',
      undefined,
      cnpjEmpresa
    )
    if (!manResp.sucesso) {
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
      // 404 ou outro erro: continua — XML pode estar disponível sem ciência
    }
  }

  const xmlResp = await clienteFocusNfe.baixarXml(apiToken, homologacao, chave, cnpjEmpresa)
  if (!xmlResp.sucesso || typeof xmlResp.dados !== 'string') {
    const rateLimit = xmlResp.sucesso === false && xmlResp.codigoHttp === 429
    const notFound = xmlResp.sucesso === false && xmlResp.codigoHttp === 404
    const detalhe =
      xmlResp.sucesso === false ? xmlResp.mensagem : 'XML vazio ou indisponível na Focus'
    logFocus('warn', 'import_chave_xml_falhou', {
      companyId,
      chave: chave.slice(-8),
      mensagem: detalhe,
      codigoHttp: xmlResp.sucesso === false ? xmlResp.codigoHttp : undefined,
    })
    if (rateLimit) {
      return {
        ok: false,
        mensagem: `Focus rate limit (429) ao baixar XML da NF …${chave.slice(-8)}. Tente novamente em instantes.`,
      }
    }
    if (notFound) {
      return { ok: false, mensagem: mensagemFocus404(chave) }
    }
    return {
      ok: false,
      mensagem: `Falha ao importar NF …${chave.slice(-8)} pela Focus: ${detalhe}`,
    }
  }

  const campos = extrairCamposResumoDoXml(xmlResp.dados)

  const { registro } = await repositorioFocusNfe.upsertNfeRecebida({
    companyId,
    chaveNfe: chave,
    tipoDocumento: 'nfe55',
    nomeEmitente: campos.nomeEmitente,
    documentoEmitente: campos.documentoEmitente,
    cnpjDestinatario: campos.cnpjDestinatario,
    dataEmissao: campos.dataEmissao,
    valorTotal: campos.valorTotal,
    xmlConteudo: xmlResp.dados,
    nfeCompleta: true,
    origem: 'focus',
    situacao: existente?.situacao ?? 'autorizada',
    manifestacaoDestinatario: existente?.manifestacaoDestinatario ?? 'ciencia',
    modFrete: campos.modFrete ?? null,
    etapaAtual: 'cadastro',
  })

  // Dynamic import evita ciclo focus ↔ pipeline ↔ vinculo-cte
  const { servicoEntradaNotas } = await import('../entrada-notas/servico-pipeline-entrada.js')
  await servicoEntradaNotas.processarAposXml(companyId, registro.id)

  logFocus('info', 'import_chave_nfe_ok', {
    companyId,
    chave: chave.slice(-8),
    notaId: registro.id,
  })

  return { ok: true, notaId: registro.id, jaExistia: false }
}
