import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnvConfig } from '@next/env'

const diretorioFrontend = path.dirname(fileURLToPath(import.meta.url))
const diretorioRaiz = path.join(diretorioFrontend, '..')

// Carrega o .env único na raiz do projeto (API + frontend)
loadEnvConfig(diretorioRaiz)

const urlPublicaDaApi = process.env.NEXT_PUBLIC_API_URL ?? ''

if (
  process.env.NODE_ENV === 'production' &&
  (!urlPublicaDaApi ||
    urlPublicaDaApi.includes('localhost') ||
    urlPublicaDaApi.includes('127.0.0.1'))
) {
  throw new Error(
    'Build de produção bloqueado: no .env da VPS, defina NEXT_PUBLIC_API_URL com a URL pública da API (ex.: https://api.erp.avadesk.com.br) antes de rodar npm run build.'
  )
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: diretorioFrontend,
}

export default nextConfig
