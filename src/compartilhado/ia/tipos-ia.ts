/**
 * Contratos comuns a qualquer provedor de IA plugável (Anthropic, OpenAI-compatível, Gemini).
 * Trocar de provedor não deve exigir mudança nestes tipos nem no matcher/relatório.
 */
export type PapelMensagemIa = 'system' | 'user'

export type MensagemIa = {
  papel: PapelMensagemIa
  conteudo: string
}

export type RespostaProvedorIa =
  | { sucesso: true; texto: string }
  | { sucesso: false; mensagem: string; codigoHttp?: number }

export interface ProvedorIa {
  nome: string
  modelo: string
  extrairTextoJson(mensagens: MensagemIa[]): Promise<RespostaProvedorIa>
}
