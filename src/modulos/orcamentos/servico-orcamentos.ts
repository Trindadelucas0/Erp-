import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { enviarEmailResend } from '../notificacoes-email/cliente-resend.js'
import { obterConfigNotificacoesEmail } from '../notificacoes-email/config-notificacoes-email.js'
import {
  escaparHtml,
  montarLayoutEmailCorporativo,
  montarParagrafo,
} from '../notificacoes-email/template-email-corporativo.js'
import type { DadosOrcamento } from './esquema-orcamentos.js'
import { fretePersistido } from './esquema-orcamentos.js'
import { opcoesPagamentoOrcamento, validarPagamentoOrcamento } from './pagamento-orcamento.js'
import { totalDoOrcamento } from './repositorio-orcamentos.js'
import { repositorioParametrizacaoCustos } from '../configuracoes/repositorio-parametrizacao-custos.js'
import {
  ehUnicidadeNumero,
  repositorioDeOrcamentos,
  type OrcamentoPersistido,
} from './repositorio-orcamentos.js'
import {
  caminhoAbsolutoAnexoOrcamento,
  removerAnexoOrcamento,
  salvarAnexoOrcamento,
} from './armazenamento-anexo-orcamento.js'

const VALIDADE_ORCAMENTO_DIAS_PADRAO = 14

function semNomeEmpresa<T extends { nomeEmpresa: string }>(registro: T) {
  const { nomeEmpresa: _nomeEmpresa, ...publico } = registro
  return publico
}

function statusAoGravar(statusAtual: string, statusPedido: string): string {
  if (statusAtual !== 'em_aberto') return statusAtual
  return statusPedido === 'em_aberto' ? statusPedido : statusAtual
}

function hojeCivil(): string {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
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
  await repositorioDeOrcamentos.expirarVencidos(companyId, hojeCivil())
  return repositorioDeOrcamentos.listar(companyId)
}

async function obter(companyId: string, id: string) {
  await repositorioDeOrcamentos.expirarVencidos(companyId, hojeCivil())
  const registro = await repositorioDeOrcamentos.buscarPorId(companyId, id)
  if (!registro) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  return semNomeEmpresa(registro)
}

async function validarMultiplos(companyId: string, dados: DadosOrcamento) {
  const itensComProduto = dados.itens.filter((item) => item.produtoId)
  if (itensComProduto.length === 0) return
  const produtos = await repositorioDeOrcamentos.buscarProdutosParaValidacao(
    companyId,
    itensComProduto.map((item) => item.produtoId!)
  )
  const mapa = new Map(produtos.map((produto) => [produto.id, produto]))
  for (const item of itensComProduto) {
    const produto = mapa.get(item.produtoId!)
    if (!produto) throw new ErroDaAplicacao('Produto não encontrado', 400)
    if (produto.permiteVendaFracionada) continue
    const multiplo = Number(produto.multiploVenda)
    if (multiplo <= 0) continue
    const quociente = item.quantidade / multiplo
    if (Math.abs(quociente - Math.round(quociente)) > 0.000001) {
      throw new ErroDaAplicacao(`Quantidade deve ser múltipla de ${multiplo}`, 400)
    }
  }
}

async function criar(companyId: string, dados: DadosOrcamento, usuarioId?: string) {
  await validarPagamento(companyId, dados)
  await validarMultiplos(companyId, dados)
  const gerado = !dados.numero.trim()
  let numero = dados.numero.trim()
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (!numero) numero = await numeroParaGravar(companyId, '')
    try {
      const registro = await repositorioDeOrcamentos.criar(
        companyId,
        dados,
        numero,
        'em_aberto'
      )
      await repositorioDeOrcamentos.registrarHistorico(
        registro.id,
        usuarioId,
        'criacao',
        'Orçamento criado'
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

async function atualizar(companyId: string, id: string, dados: DadosOrcamento, usuarioId?: string) {
  const existente = await repositorioDeOrcamentos.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  if (existente.status !== 'em_aberto') {
    throw new ErroDaAplicacao('Orçamento expirado ou convertido não pode ser editado', 409)
  }
  await validarPagamento(companyId, dados)
  await validarMultiplos(companyId, dados)

  const status = statusAoGravar(existente.status, dados.status)
  const numero = dados.numero.trim() || existente.numero
  try {
    const registro = await repositorioDeOrcamentos.atualizar(companyId, id, dados, numero, status)
    if (!registro) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
    await repositorioDeOrcamentos.registrarHistorico(
      id,
      usuarioId,
      'alteracao',
      'Orçamento alterado'
    )
    return semNomeEmpresa(registro)
  } catch (erro) {
    if (ehUnicidadeNumero(erro)) {
      throw new ErroDaAplicacao('Já existe orçamento com este número nesta empresa', 409)
    }
    throw erro
  }
}

async function validarPagamento(companyId: string, dados: DadosOrcamento) {
  const frete = fretePersistido(dados.prazoEntrega, dados.frete, dados.valorFrete)
  validarPagamentoOrcamento(dados, totalDoOrcamento({ ...dados, valorFrete: frete.valorFrete }),
    await opcoesPagamentoOrcamento(companyId))
}

async function finalizar(companyId: string, id: string, usuarioId?: string) {
  await repositorioDeOrcamentos.expirarVencidos(companyId, hojeCivil())
  const resultado = await repositorioDeOrcamentos.finalizar(companyId, id, usuarioId)
  if (!resultado) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  if ('incompleto' in resultado) {
    throw new ErroDaAplicacao('Informe o cliente e ao menos um produto com quantidade', 400)
  }
  if ('duplicado' in resultado) {
    throw new ErroDaAplicacao('Este orçamento já foi convertido', 409)
  }
  if ('bloqueado' in resultado) {
    throw new ErroDaAplicacao('Este orçamento já foi convertido ou está expirado', 409)
  }
  if (!usuarioId) {
    return semNomeEmpresa(resultado)
  }
  await registrarAuditoria({
    usuarioId,
    acao: resultado.status === 'convertido' ? 'CONVERTER' : 'FINALIZAR',
    entidade: 'Orcamento',
    entidadeId: id,
    valoresDepois: { status: resultado.status },
  })
  return semNomeEmpresa(resultado)
}

async function aplicarDesconto(
  companyId: string,
  id: string,
  percentual: number,
  itemIds: string[] | null,
  usuarioId?: string
) {
  const resultado = await repositorioDeOrcamentos.aplicarDesconto(
    companyId,
    id,
    percentual,
    itemIds,
    usuarioId
  )
  if (!resultado) throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  if ('bloqueado' in resultado) {
    throw new ErroDaAplicacao('Só é possível aplicar desconto no orçamento em aberto', 409)
  }
  if (usuarioId) {
    await registrarAuditoria({
      usuarioId,
      acao: 'DESCONTO',
      entidade: 'Orcamento',
      entidadeId: id,
      valoresDepois: { percentual },
    })
  }
  return semNomeEmpresa(resultado)
}

async function copiarPedido(
  companyId: string,
  id: string,
  pedidoVendaId: string,
  usuarioId?: string
) {
  const resultado = await repositorioDeOrcamentos.copiarItensPedido(
    companyId,
    id,
    pedidoVendaId,
    usuarioId
  )
  if (!resultado) throw new ErroDaAplicacao('Orçamento ou pedido de venda não encontrado', 404)
  if ('bloqueado' in resultado) {
    throw new ErroDaAplicacao('Só é possível copiar com o orçamento em aberto', 409)
  }
  return semNomeEmpresa(resultado)
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

async function listarAnexos(companyId: string, id: string) {
  return repositorioDeOrcamentos.listarAnexos(companyId, id)
}

async function enviarAnexo(
  companyId: string,
  id: string,
  usuarioId: string,
  dados: { nomeArquivo: string; mimeType: string; base64Arquivo: string }
) {
  const arquivo = await salvarAnexoOrcamento(id, dados.mimeType, dados.base64Arquivo)
  const anexo = await repositorioDeOrcamentos.criarAnexo(companyId, id, usuarioId, {
    nomeArquivo: dados.nomeArquivo,
    mimeType: dados.mimeType,
    ...arquivo,
  })
  if (!anexo) {
    await removerAnexoOrcamento(arquivo.caminhoArquivo)
    throw new ErroDaAplicacao('Orçamento não encontrado', 404)
  }
  return anexo
}

async function baixarAnexo(companyId: string, id: string, anexoId: string) {
  const anexo = await repositorioDeOrcamentos.buscarAnexo(companyId, id, anexoId)
  if (!anexo) throw new ErroDaAplicacao('Anexo não encontrado', 404)
  return { ...anexo, caminhoAbsoluto: caminhoAbsolutoAnexoOrcamento(anexo.caminhoArquivo) }
}

async function excluirAnexo(companyId: string, id: string, anexoId: string) {
  const anexo = await repositorioDeOrcamentos.excluirAnexo(companyId, id, anexoId)
  if (!anexo) throw new ErroDaAplicacao('Anexo não encontrado', 404)
  await removerAnexoOrcamento(anexo.caminhoArquivo)
  return { removido: true }
}

export const servicoDeOrcamentos = {
  listar,
  obter,
  criar,
  atualizar,
  finalizar,
  aplicarDesconto,
  copiarPedido,
  enviarEmail,
  listarAnexos,
  enviarAnexo,
  baixarAnexo,
  excluirAnexo,
  preenchimentoNovo,
}
