/**
 * Lê e valida a configuração da conferência por IA a partir do .env.
 * Trocar de provedor = editar estas variáveis e reiniciar a API — sem tocar em código.
 */
import { ErroDaAplicacao } from '../erros/ErroDaAplicacao.js'

export type ProviderIa = 'anthropic' | 'openai' | 'gemini' | 'none'

export type ConfigIa = {
  provider: Exclude<ProviderIa, 'none'>
  apiKey: string
  baseUrl: string
  modelo: string
  modeloFallback: string | null
  timeoutMs: number
  maxItens: number
  limiarNome: number
  toleranciaPreco: number
}

const BASE_URL_PADRAO: Record<Exclude<ProviderIa, 'none'>, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
}

const MODELO_PADRAO: Record<Exclude<ProviderIa, 'none'>, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-3.5-flash',
}

// Usado quando o modelo principal recusa a chamada por sobrecarga temporária
// ("high demand"/503). Só o Gemini tem um modelo mais leve conhecido por padrão;
// para os demais provedores, o fallback só existe se configurado via IA_MODEL_FALLBACK.
const MODELO_FALLBACK_PADRAO: Record<Exclude<ProviderIa, 'none'>, string | null> = {
  anthropic: null,
  openai: null,
  gemini: 'gemini-3.1-flash-lite',
}

function providerAtivo(): ProviderIa {
  const valor = (process.env.IA_PROVIDER ?? 'none').trim().toLowerCase()
  if (valor === 'anthropic' || valor === 'openai' || valor === 'gemini' || valor === 'none') {
    return valor
  }
  return 'none'
}

export function iaConfigurada(): boolean {
  return providerAtivo() !== 'none' && Boolean(process.env.IA_API_KEY)
}

export function obterConfigIa(): ConfigIa {
  const provider = providerAtivo()

  if (provider === 'none') {
    throw new ErroDaAplicacao(
      'Conferência por IA não configurada. Defina IA_PROVIDER e IA_API_KEY no .env.',
      503
    )
  }

  const apiKey = process.env.IA_API_KEY
  if (!apiKey) {
    throw new ErroDaAplicacao('Conferência por IA não configurada (IA_API_KEY ausente).', 503)
  }

  const modelo = process.env.IA_MODEL || MODELO_PADRAO[provider]
  const modeloFallback = process.env.IA_MODEL_FALLBACK || MODELO_FALLBACK_PADRAO[provider]

  return {
    provider,
    apiKey,
    baseUrl: (process.env.IA_BASE_URL || BASE_URL_PADRAO[provider]).replace(/\/+$/, ''),
    modelo,
    modeloFallback: modeloFallback && modeloFallback !== modelo ? modeloFallback : null,
    timeoutMs: Number(process.env.IA_TIMEOUT_MS) || 60_000,
    maxItens: Number(process.env.IA_MAX_ITENS) || 200,
    limiarNome: Number(process.env.IA_LIMIAR_NOME) || 0.82,
    toleranciaPreco: Number(process.env.IA_TOLERANCIA_PRECO) || 0.01,
  }
}
