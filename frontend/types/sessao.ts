export type PaginaDoSistema = {
  chave: string
  caminho: string
  rotulo: string
}

export type PapelDaSessao = {
  role: { name: string }
}

export type UsuarioDaSessao = {
  id: string
  name: string
  email: string
  active: boolean
  roles?: PapelDaSessao[]
}

export type PerfilDoUsuario = {
  usuario: UsuarioDaSessao
  ehAdmin: boolean
  paginasPermitidas: PaginaDoSistema[]
  permissoesEfetivas: string[]
}
