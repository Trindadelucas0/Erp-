

/**
 * Monta a string de conexão postgresql://...
 * @returns 
 */
export function montarUrlDoBancoDeDados(): string {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env

  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
    throw new Error(
      'Configure DB_HOST, DB_PORT, DB_NAME e DB_USER no arquivo .env'
    )
  }

  const senhaCodificada = encodeURIComponent(DB_PASSWORD ?? '')

  return `postgresql://${DB_USER}:${senhaCodificada}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
}

/**
 * Define DATABASE_URL no process.env para o Prisma usar.
 * @returns void
 */
export function definirUrlDoBancoNoAmbiente(): void {
  process.env.DATABASE_URL = montarUrlDoBancoDeDados()
}
