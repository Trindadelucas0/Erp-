/**
 * Chama o provedor de IA ativo (Anthropic/OpenAI-compatível/Gemini, conforme .env)
 * para extrair cabeçalho + itens do texto do documento do fornecedor.
 */
import { criarProvedorIa } from '../../../compartilhado/ia/criar-provedor-ia.js'
import { esquemaRespostaExtracaoArquivo, type RespostaExtracaoArquivo } from './tipos-conferencia.js'
import { PROMPT_EXTRACAO_ARQUIVO } from './prompt-extracao-arquivo.js'

export type ResultadoExtracaoIa =
  | { sucesso: true; dados: RespostaExtracaoArquivo; provider: string; modelo: string }
  | { sucesso: false; mensagem: string; codigoHttp?: number }

function extrairJsonDoTexto(texto: string): unknown {
  const limpo = texto.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  return JSON.parse(limpo)
}

export async function extrairItensComIa(textoDocumento: string): Promise<ResultadoExtracaoIa> {
  let provedor
  try {
    provedor = criarProvedorIa()
  } catch (erro) {
    const err = erro as Error
    return { sucesso: false, mensagem: err.message }
  }

  const resposta = await provedor.extrairTextoJson([
    { papel: 'system', conteudo: PROMPT_EXTRACAO_ARQUIVO },
    { papel: 'user', conteudo: `Texto extraído do documento do fornecedor:\n\n${textoDocumento}` },
  ])

  if (!resposta.sucesso) {
    return { sucesso: false, mensagem: resposta.mensagem, codigoHttp: resposta.codigoHttp }
  }

  let json: unknown
  try {
    json = extrairJsonDoTexto(resposta.texto)
  } catch {
    return { sucesso: false, mensagem: 'A IA retornou uma resposta que não é um JSON válido.' }
  }

  const validado = esquemaRespostaExtracaoArquivo.safeParse(json)
  if (!validado.success) {
    return {
      sucesso: false,
      mensagem: `A IA retornou um formato inesperado: ${validado.error.issues[0]?.message ?? 'schema inválido'}.`,
    }
  }

  return { sucesso: true, dados: validado.data, provider: provedor.nome, modelo: provedor.modelo }
}
