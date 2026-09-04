/**
 * Registro central de páginas do frontend.
 * Ao criar nova rota no Next.js, adicionar em PAGINAS_VINCULAVEIS.
 */

export type PaginaDoSistema = {
  chave: string
  caminho: string
  rotulo: string
  modulo?: string
  /** Se false, não aparece no menu lateral (acesso via outra tela). Default true. */
  exibirNoMenu?: boolean
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
    chave: 'entrada-notas',
    caminho: '/entrada-notas',
    rotulo: 'Entrada de Notas',
    modulo: 'compras',
  },
  {
    chave: 'contagens',
    caminho: '/contagens',
    rotulo: 'Contagens de entrada',
    modulo: 'compras',
  },
  {
    chave: 'auditoria-entradas',
    caminho: '/auditoria-entradas',
    rotulo: 'Auditoria de entradas',
    modulo: 'compras',
  },
  {
    chave: 'estoque',
    caminho: '/estoque',
    rotulo: 'Estoque',
    modulo: 'estoque',
  },
  {
    chave: 'enderecos-wms',
    caminho: '/enderecos-wms',
    rotulo: 'Endereços WMS',
    modulo: 'estoque',
  },
  {
    chave: 'estrutura-wms',
    caminho: '/estrutura-wms',
    rotulo: 'Estrutura WMS',
    modulo: 'estoque',
  },
  {
    chave: 'contas-a-pagar',
    caminho: '/contas-a-pagar',
    rotulo: 'Contas a Pagar',
    modulo: 'financeiro',
  },
  {
    chave: 'contas-a-receber',
    caminho: '/contas-a-receber',
    rotulo: 'Contas a Receber',
    modulo: 'financeiro',
  },
  {
    chave: 'pendencias',
    caminho: '/pendencias',
    rotulo: 'Pendências',
  },
  {
    chave: 'configuracoes',
    caminho: '/configuracoes',
    rotulo: 'Configurações',
    modulo: 'configuracoes',
  },
  /** Parâmetros — acesso via Configurações; mantidos para permissão/vínculo legado. */
  {
    chave: 'planos-financeiros',
    caminho: '/configuracoes?aba=financeiro',
    rotulo: 'Planos Financeiros',
    modulo: 'financeiro',
    exibirNoMenu: false,
  },
  {
    chave: 'cfops',
    caminho: '/configuracoes?aba=fiscal&secao=cfop',
    rotulo: 'CFOP',
    modulo: 'financeiro',
    exibirNoMenu: false,
  },
]

/** Páginas exclusivas do administrador (não aparecem no formulário de vínculo). */
export const PAGINAS_SOMENTE_ADMIN: readonly PaginaDoSistema[] = [
  { chave: 'usuarios', caminho: '/users', rotulo: 'Usuários' },
  { chave: 'papeis', caminho: '/papeis', rotulo: 'Papéis' },
  { chave: 'auditoria', caminho: '/auditoria', rotulo: 'Auditoria' },
  { chave: 'clientes-aprovacao', caminho: '/clientes/aprovacao', rotulo: 'Aprovação de clientes' },
  { chave: 'configuracoes', caminho: '/configuracoes', rotulo: 'Configurações' },
]

/** Rota de fallback para usuários sem páginas liberadas. */
export const CAMINHO_INICIO = '/inicio'

export function listarPaginasVinculaveis(): PaginaDoSistema[] {
  return PAGINAS_VINCULAVEIS.filter((pagina) => pagina.exibirNoMenu !== false)
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

function filtrarParaMenu(paginas: PaginaDoSistema[]): PaginaDoSistema[] {
  const vistas = new Map<string, PaginaDoSistema>()
  for (const pagina of paginas) {
    if (pagina.exibirNoMenu === false) continue
    if (!vistas.has(pagina.chave)) {
      vistas.set(pagina.chave, pagina)
    }
  }
  return [...vistas.values()]
}

export function montarPaginasPermitidasParaUsuario(
  ehAdmin: boolean,
  chavesDoUsuario: string[],
  permissoesEfetivas: string[] = []
): PaginaDoSistema[] {
  if (ehAdmin) {
    return filtrarParaMenu([...PAGINAS_SOMENTE_ADMIN, ...PAGINAS_VINCULAVEIS])
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

  const temParametroFinanceiro =
    paginasPorChave.has('cfops') ||
    paginasPorChave.has('planos-financeiros') ||
    permissoesEfetivas.includes('financeiro:view')
  const temParametroLogistica = permissoesEfetivas.includes('produtos:view')
  if (
    (temParametroFinanceiro || temParametroLogistica) &&
    !paginasPorChave.has('configuracoes')
  ) {
    const config = resolverPaginaPorChave('configuracoes')
    if (config) paginasPorChave.set('configuracoes', config)
  }

  const temPendencias =
    permissoesEfetivas.includes('financeiro:view') ||
    permissoesEfetivas.includes('compras:view') ||
    permissoesEfetivas.includes('estoque:view') ||
    permissoesEfetivas.includes('clientes:view')
  if (temPendencias && !paginasPorChave.has('pendencias')) {
    const pendencias = resolverPaginaPorChave('pendencias')
    if (pendencias) paginasPorChave.set('pendencias', pendencias)
  }

  return filtrarParaMenu([...paginasPorChave.values()])
}
