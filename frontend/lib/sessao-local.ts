/** Salva o token JWT no localStorage e no cookie usado pelo middleware do Next.js. */
export function salvarTokenNaSessao(token: string) {
  localStorage.setItem('token', token)
  document.cookie = `erp_token=${encodeURIComponent(token)}; path=/; max-age=${8 * 3600}; SameSite=Strict`
}

/** Remove token e empresa ativa do armazenamento local. */
export function limparSessaoLocal() {
  localStorage.removeItem('token')
  localStorage.removeItem('empresaAtivaId')
  document.cookie = 'erp_token=; Max-Age=0; path=/'
}
