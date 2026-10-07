import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { enviarEmailResend } from '../notificacoes-email/cliente-resend.js'
import { obterConfigNotificacoesEmail } from '../notificacoes-email/config-notificacoes-email.js'
import {
  escaparHtml,
  montarLayoutEmailCorporativo,
  montarParagrafo,
} from '../notificacoes-email/template-email-corporativo.js'
import type { DadosOrcamento } from './esquema-orcamentos.js'
import { repositorioParametrizacaoCustos } from '../configuracoes/repositorio-parametrizacao-custos.js'
import {
  ehUnicidadeNumero,
  repositorioDeOrcamentos,
  type OrcamentoPersistido,
} from './repositorio-orcamentos.js'

const VALIDADE_ORCAMENTO_DIAS_PADRAO = 14

function semNomeEmpresa<T extends { nomeEmpresa: string }>(registro: T) {
  const { nomeEmpresa: _nomeEmpresa, ...publico } = registro
  return publico
}

function statusAoGravar(statusAtual: string, statusPedido: string): string {
  if (statusAtual === 'enviado' && statusPedido === 'em_elaboracao') return 'enviado'
  return statusPedido
}

async function numeroParaGravar(companyId: string, numeroInformado: string): Promise<string> {
  const numero = numeroInformado.trim()
  if (numero) return numero
  return repositorioDeOrcamentos.proximoNumero(companyId)
}

async function validadeOrcamentoDiasDaEmpresa(companyId: string): Promise<number> {
  const registro = await repositorioParametrizacaoCustos.buscarDaEmpresa(companyId)
  const dias = registro?.validadeOrcamentoDias
  if (dias == null || !Number.isFinite(dias) || dias < 1) return VALIDADE_ORCAMENTO_DIAS_PADRAO
  return dias
}

async function preenchimentoNovo(companyId: string) {
  const [numero, validadeOrcamentoDias] = await Promise.all([
    repositorioDeOrcamentos.proximoNumero(companyId),
    validadeOrcamentoDiasDaEmpresa(companyId),
  ])
  return { numero, validadeOrcamentoDias }
}

async function listar(companyId: string) {
  return repositorioDeOrcamentos.listar(companyId)
}

async function obter(companyId: string, id: string) {
  const registro = await repositorioDeOrcamentos.buscarPorId(companyId, id)
  if (!registro) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  return semNomeEmpresa(registro)
}

async function criar(companyId: string, dados: DadosOrcamento) {
  const gerado = !dados.numero.trim()
  let numero = dados.numero.trim()
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (!numero) numero = await numeroParaGravar(companyId, '')
    try {
      const registro = await repositorioDeOrcamentos.criar(
        companyId,
        dados,
        numero,
        dados.status
      )
      return semNomeEmpresa(registro)
    } catch (erro) {
      if (!ehUnicidadeNumero(erro)) throw erro
      if (!gerado) {
        throw new ErroDaAplicacao('Já existe orçamento com este número nesta empresa', 409)
      }
      numero = ''
    }
  }
  throw new ErroDaAplicacao('Não foi possível gerar o número do orçamento', 409)
}

async function atualizar(companyId: string, id: string, dados: DadosOrcamento) {
  const existente = await repositorioDeOrcamentos.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Orçamento não encontrado', 404)

  const status = statusAoGravar(existente.status, dados.status)
  const numero = dados.numero.trim() || existente.numero
  try {
    const registro = await repositorioDeOrcamentos.atualizar(companyId, id, dados, numero, status)
    if (!registro) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
    return semNomeEmpresa(registro)
  } catch (erro) {
    if (ehUnicidadeNumero(erro)) {
      throw new ErroDaAplicacao('Já existe orçamento com este número nesta empresa', 409)
    }
    throw erro
  }
}

async function finalizar(companyId: string, id: string) {
  const existente = await repositorioDeOrcamentos.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  const registro = await repositorioDeOrcamentos.atualizarStatus(companyId, id, 'enviado')
  if (!registro) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  return semNomeEmpresa(registro)
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function htmlDoEmail(orcamento: OrcamentoPersistido): string {
  const linhas = orcamento.itens
    .map(
      (item) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escaparHtml(item.codigo)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${escaparHtml(item.descricao)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${escaparHtml(String(item.quantidade))}</td></tr>`
    )
    .join('')

  const corpoHtml = `
    ${montarParagrafo(`Olá${orcamento.contato ? `, ${escaparHtml(orcamento.contato)}` : ''}. Segue a proposta ${escaparHtml(orcamento.numero)}.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;">
      <tr><td style="padding:6px 8px;font-weight:bold;">Código</td><td style="padding:6px 8px;font-weight:bold;">Descrição</td><td style="padding:6px 8px;font-weight:bold;text-align:right;">Qtd.</td></tr>
      ${linhas}
    </table>
    ${montarParagrafo(`Total: ${escaparHtml(formatarMoeda(orcamento.total))}`)}
    ${orcamento.mensagem ? montarParagrafo(escaparHtml(orcamento.mensagem).replace(/\n/g, '<br>')) : ''}
  `.trim()

  return montarLayoutEmailCorporativo({
    titulo: `Orçamento ${escaparHtml(orcamento.numero)}`,
    nomeEmpresa: escaparHtml(orcamento.nomeEmpresa || 'Orçamento'),
    preheader: `Proposta ${escaparHtml(orcamento.numero)} para ${escaparHtml(orcamento.clienteNome)}`,
    corpoHtml,
  })
}

function mensagemSemSegredo(mensagem: string, apiKey: string): string {
  if (!apiKey) return mensagem
  return mensagem.split(apiKey).join('***')
}

async function enviarEmail(companyId: string, id: string) {
  const orcamento = await repositorioDeOrcamentos.buscarPorId(companyId, id)
  if (!orcamento) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  if (!orcamento.email.trim()) {
    throw new ErroDaAplicacao('Informe o e-mail do cliente', 400)
  }

  const config = obterConfigNotificacoesEmail()
  const html = htmlDoEmail(orcamento)
  const resultado = await enviarEmailResend({
    apiKey: config.apiKey,
    de: config.remetente,
    para: [orcamento.email.trim()],
    assunto: `Orçamento ${orcamento.numero}`,
    html,
  })

  if (!resultado.sucesso) {
    throw new ErroDaAplicacao(mensagemSemSegredo(resultado.mensagem, config.apiKey), 502)
  }

  return { enviado: true }
}

export const servicoDeOrcamentos = {
  listar,
  obter,
  criar,
  atualizar,
  finalizar,
  enviarEmail,
  preenchimentoNovo,
}
