import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'
import { loadEnvConfig } from '@next/env'

const diretorioFrontend = path.dirname(fileURLToPath(import.meta.url))
const diretorioRaiz = path.resolve(diretorioFrontend, '..')
const caminhoEnv = path.join(diretorioRaiz, '.env')

// .env na raiz (API + frontend) — dotenv garante leitura antes da validação
dotenvConfig({ path: caminhoEnv })
const { combinedEnv } = loadEnvConfig(diretorioRaiz, false)

const urlPublicaDaApi =
  combinedEnv.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  ''

const buildDeProducao = process.env.NODE_ENV === 'production'

if (
  buildDeProducao &&
  (!urlPublicaDaApi ||
    urlPublicaDaApi.includes('localhost') ||
    urlPublicaDaApi.includes('127.0.0.1'))
) {
  throw new Error(
    `Build de produção bloqueado: NEXT_PUBLIC_API_URL="${urlPublicaDaApi || '(vazia)'}" em ${caminhoEnv}. ` +
      'Use a URL pública da API (ex.: https://api.erp.avadesk.com.br).'
  )
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: diretorioFrontend,
  env: {
    NEXT_PUBLIC_API_URL: urlPublicaDaApi || process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL:
      combinedEnv.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL,
  },
}

export default nextConfig
