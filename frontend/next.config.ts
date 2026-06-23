import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'
import { loadEnvConfig } from '@next/env'

const diretorioFrontend = path.dirname(fileURLToPath(import.meta.url))
const diretorioRaiz = path.resolve(diretorioFrontend, '..')
const caminhoEnv = path.join(diretorioRaiz, '.env')

dotenvConfig({ path: caminhoEnv })
const { combinedEnv } = loadEnvConfig(diretorioRaiz, false)

const urlPublicaDaApi =
  combinedEnv.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  ''

const destinoApiInterno =
  combinedEnv.API_PROXY_DESTINO?.trim() ||
  process.env.API_PROXY_DESTINO?.trim() ||
  'http://127.0.0.1:8885'

const buildDeProducao = process.env.NODE_ENV === 'production'

if (
  buildDeProducao &&
  (!urlPublicaDaApi ||
    urlPublicaDaApi.includes('localhost') ||
    urlPublicaDaApi.includes('127.0.0.1'))
) {
  throw new Error(
    `Build de produção bloqueado: NEXT_PUBLIC_API_URL="${urlPublicaDaApi || '(vazia)'}" em ${caminhoEnv}. ` +
      'Use a URL pública com /api (ex.: https://erp.avadesk.com.br/api).'
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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${destinoApiInterno}/:path*`,
      },
    ]
  },
}

export default nextConfig
