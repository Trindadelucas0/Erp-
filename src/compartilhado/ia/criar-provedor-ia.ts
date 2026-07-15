/**
 * Factory que escolhe o adapter de IA ativo com base no .env (IA_PROVIDER).
 * Trocar de provedor não exige mudança no matcher, no relatório nem na UI.
 */
import { obterConfigIa, type ConfigIa } from './config-ia.js'
import { criarProvedorAnthropic } from './provedores/anthropic-claude.js'
import { criarProvedorOpenAiCompativel } from './provedores/openai-compativel.js'
import { criarProvedorGemini } from './provedores/gemini.js'
import { criarProvedorResiliente } from './provedor-resiliente.js'
import { ErroDaAplicacao } from '../erros/ErroDaAplicacao.js'
import type { ProvedorIa } from './tipos-ia.js'

function instanciarProvedor(config: ConfigIa, modelo: string): ProvedorIa {
  switch (config.provider) {
    case 'anthropic':
      return criarProvedorAnthropic(config.apiKey, config.baseUrl, modelo, config.timeoutMs)
    case 'openai':
      return criarProvedorOpenAiCompativel(config.apiKey, config.baseUrl, modelo, config.timeoutMs)
    case 'gemini':
      return criarProvedorGemini(config.apiKey, config.baseUrl, modelo, config.timeoutMs)
    default:
      throw new ErroDaAplicacao(`IA_PROVIDER inválido: ${config.provider}`, 503)
  }
}

export function criarProvedorIa(): ProvedorIa {
  const config = obterConfigIa()
  const principal = instanciarProvedor(config, config.modelo)
  const fallback = config.modeloFallback ? instanciarProvedor(config, config.modeloFallback) : null

  return criarProvedorResiliente(principal, fallback)
}
