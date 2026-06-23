import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnvConfig } from '@next/env'

const diretorioFrontend = path.dirname(fileURLToPath(import.meta.url))
const diretorioRaiz = path.join(diretorioFrontend, '..')

// Carrega o .env único na raiz do projeto (API + frontend)
loadEnvConfig(diretorioRaiz)

const nextConfig: NextConfig = {
  outputFileTracingRoot: diretorioFrontend,
}

export default nextConfig
