/** Helper exportado só para teste do header Basic (sem chamar rede). */
export function montarAuthParaTeste(token: string): string {
  return `Basic ${Buffer.from(`${token}:`, 'utf8').toString('base64')}`
}
