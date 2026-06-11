import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  outputFileTracingRoot: diretorioAtual,
}

export default nextConfig
