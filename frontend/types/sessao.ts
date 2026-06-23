export type PaginaDoSistema = {
  chave: string
  caminho: string
  rotulo: string
}

export type PapelDaSessao = {
  role: { name: string }
}

export type EmpresaDaSessao = {
  company: {
    id: string
    name: string
    cnpj: string
    active: boolean
  }
}

export type UsuarioDaSessao = {
  id: string
  name: string
  email: string
  active: boolean
  tema?: 'claro' | 'escuro'
  roles?: PapelDaSessao[]
}

export type PerfilDoUsuario = {
  usuario: UsuarioDaSessao
  ehAdmin: boolean
  paginasPermitidas: PaginaDoSistema[]
  permissoesEfetivas: string[]
  empresas: EmpresaDaSessao[]
}
