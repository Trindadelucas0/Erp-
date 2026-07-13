/**
 * Registro central de módulos, ações e permissões padrão por papel.
 *  módulo novo, rodar comando: npm run db:sync-permissoes
 */

/** Módulos do sistema com nome legível em português. */
export const MODULOS_DO_SISTEMA = {
  cadastros: 'Cadastros',
  clientes: 'Clientes',
  fornecedores: 'Fornecedores',
  transportadoras: 'Transportadoras',
  produtos: 'Produtos',
  compras: 'Compras',
  estoque: 'Estoque',
  financeiro: 'Financeiro',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
} as const

export type ChaveDoModulo = keyof typeof MODULOS_DO_SISTEMA

/** Ações possíveis em cada módulo. */
export const ACOES_DO_SISTEMA = {
  view: 'Ver',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  approve: 'Aprovar',
} as const

export type ChaveDaAcao = keyof typeof ACOES_DO_SISTEMA

/** Papéis fixos do sistema. */
export const PAPEIS_DO_SISTEMA = [
  'admin',
  'vendedor',
  'financeiro',
  'estoque',
] as const

export type NomeDoPapel = (typeof PAPEIS_DO_SISTEMA)[number]

/**
 * Permissões padrão de cada papel.
 * admin usa '*' = todas as permissões do sistema.
 */
export const PERMISSOES_PADRAO_POR_PAPEL: Record<NomeDoPapel, string[]> = {
  admin: ['*'],
  vendedor: [
    'cadastros:view',
    'clientes:view',
    'clientes:create',
    'clientes:edit',
    'fornecedores:view',
    'produtos:view',
    'estoque:view',
  ],
  financeiro: [
    'cadastros:view',
    'clientes:view',
    'fornecedores:view',
    'fornecedores:create',
    'fornecedores:edit',
    'transportadoras:view',
    'produtos:view',
    'compras:view',
    'compras:create',
    'compras:edit',
    'compras:delete',
    'financeiro:view',
    'financeiro:create',
    'financeiro:edit',
    'relatorios:view',
  ],
  estoque: [
    'cadastros:view',
    'clientes:view',
    'fornecedores:view',
    'fornecedores:create',
    'fornecedores:edit',
    'transportadoras:view',
    'transportadoras:create',
    'transportadoras:edit',
    'produtos:view',
    'produtos:create',
    'produtos:edit',
    'compras:view',
    'compras:create',
    'compras:edit',
    'compras:delete',
    'estoque:view',
    'estoque:create',
    'estoque:edit',
  ],
}

/** Gera todas as chaves de permissão (modulo:acao). */
export function gerarTodasAsChavesDePermissao(): string[] {
  const chaves: string[] = []

  for (const modulo of Object.keys(MODULOS_DO_SISTEMA) as ChaveDoModulo[]) {
    for (const acao of Object.keys(ACOES_DO_SISTEMA) as ChaveDaAcao[]) {
      chaves.push(`${modulo}:${acao}`)
    }
  }

  return chaves
}

/** Resolve as chaves de um papel (expande '*' para todas). */
export function resolverChavesDoPapel(
  nomeDoPapel: NomeDoPapel,
  todasAsChaves: string[]
): string[] {
  const configuracao = PERMISSOES_PADRAO_POR_PAPEL[nomeDoPapel]

  if (configuracao.includes('*')) {
    return todasAsChaves
  }

  return configuracao
}
