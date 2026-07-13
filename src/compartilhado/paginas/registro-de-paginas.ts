/**
 * Registro central de páginas do frontend.
 * Ao criar nova rota no Next.js, adicionar em PAGINAS_VINCULAVEIS.
 */

export type PaginaDoSistema = {
  chave: string
  caminho: string
  rotulo: string
  modulo?: string
}

/** Páginas que o admin pode vincular a usuários comuns. */
export const PAGINAS_VINCULAVEIS: readonly PaginaDoSistema[] = [
  {
    chave: 'cadastros',
    caminho: '/cadastros',
    rotulo: 'Cadastros',
    modulo: 'cadastros',
  },
  {
    chave: 'clientes',
    caminho: '/clientes',
    rotulo: 'Clientes',
    modulo: 'clientes',
  },
  {
    chave: 'fornecedores',
    caminho: '/fornecedores',
    rotulo: 'Fornecedores',
    modulo: 'fornecedores',
  },
  {
    chave: 'transportadoras',
    caminho: '/transportadoras',
    rotulo: 'Transportadoras',
    modulo: 'transportadoras',
  },
  {
    chave: 'produtos',
    caminho: '/produtos',
    rotulo: 'Produtos',
    modulo: 'produtos',
  },
  {
    chave: 'pedidos-compra',
    caminho: '/pedidos-compra',
    rotulo: 'Pedidos de Compra',
    modulo: 'compras',
  },
  {
    chave: 'pedidos-venda',
    caminho: '/pedidos-venda',
    rotulo: 'Pedidos de Venda',
    modulo: 'vendas',
  },
  {
    chave: 'planos-financeiros',
    caminho: '/planos-financeiros',
    rotulo: 'Planos Financeiros',
    modulo: 'financeiro',
  },
  {
    chave: 'cfops',
    caminho: '/cfops',
    rotulo: 'CFOP',
    modulo: 'financeiro',
  },
]

/** Páginas exclusivas do administrador (não aparecem no formulário de vínculo). */
export const PAGINAS_SOMENTE_ADMIN: readonly PaginaDoSistema[] = [
  { chave: 'usuarios', caminho: '/users', rotulo: 'Usuários' },
  { chave: 'papeis', caminho: '/papeis', rotulo: 'Papéis' },
  { chave: 'auditoria', caminho: '/auditoria', rotulo: 'Auditoria' },
  { chave: 'clientes-aprovacao', caminho: '/clientes/aprovacao', rotulo: 'Aprovação de clientes' },
  { chave: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações' },
  { chave: 'assinatura-digital', caminho: '/configuracoes/assinatura', rotulo: 'Assinatura Digital' },
]

/** Rota de fallback para usuários sem páginas liberadas. */
export const CAMINHO_INICIO = '/inicio'

export function listarPaginasVinculaveis(): PaginaDoSistema[] {
  return [...PAGINAS_VINCULAVEIS]
}

export function paginaVinculavelExiste(chave: string): boolean {
  return PAGINAS_VINCULAVEIS.some((pagina) => pagina.chave === chave)
}

export function resolverPaginaPorChave(
  chave: string
): PaginaDoSistema | undefined {
  return [...PAGINAS_VINCULAVEIS, ...PAGINAS_SOMENTE_ADMIN].find(
    (pagina) => pagina.chave === chave
  )
}

export function usuarioEhAdmin(
  papeis: { role: { name: string } }[]
): boolean {
  return papeis.some((item) => item.role.name === 'admin')
}

function paginaLiberadaPorPermissaoView(
  pagina: PaginaDoSistema,
  permissoesEfetivas: string[]
): boolean {
  if (!pagina.modulo) return false
  return permissoesEfetivas.includes(`${pagina.modulo}:view`)
}

export function montarPaginasPermitidasParaUsuario(
  ehAdmin: boolean,
  chavesDoUsuario: string[],
  permissoesEfetivas: string[] = []
): PaginaDoSistema[] {
  if (ehAdmin) {
    return [...PAGINAS_SOMENTE_ADMIN, ...PAGINAS_VINCULAVEIS]
  }

  const paginasPorChave = new Map<string, PaginaDoSistema>()

  for (const chave of chavesDoUsuario) {
    const pagina = resolverPaginaPorChave(chave)
    if (pagina) paginasPorChave.set(pagina.chave, pagina)
  }

  for (const pagina of PAGINAS_VINCULAVEIS) {
    if (paginaLiberadaPorPermissaoView(pagina, permissoesEfetivas)) {
      paginasPorChave.set(pagina.chave, pagina)
    }
  }

  return [...paginasPorChave.values()]
}
