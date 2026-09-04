/**
 * Padrão oficial do endereço WMS (§7.25):
 * LOCAL(1) + ÁREA(2 letras) + TIPO(2 letras) + RUA(2 dígitos) + ANDAR(1) + POSIÇÃO(2)
 * Código canônico com hífen: A-RC-CH-20-2-05
 * Área, tipo, rua e andar vêm do catálogo Estrutura WMS (§6.17j); Local e Posição não.
 */

export const LOCAIS_WMS = ['A', 'B'] as const
export type LocalWms = (typeof LOCAIS_WMS)[number]

export const ROTULOS_LOCAL_WMS: Record<LocalWms, string> = {
  A: 'Prédio principal da fábrica',
  B: 'Prédio secundário / Anexo II',
}

/** Valores iniciais sugeridos na Estrutura WMS (empresa nova). */
export const PADRAO_AREAS_WMS = [
  { codigo: 'RC', nome: 'Recebimento' },
  { codigo: 'EX', nome: 'Expedição' },
  { codigo: 'CQ', nome: 'Controle de Qualidade' },
] as const

export const PADRAO_TIPOS_WMS = [
  { codigo: 'PP', nome: 'Porta-Pallet' },
  { codigo: 'CX', nome: 'Caixa' },
  { codigo: 'CH', nome: 'Chão' },
  { codigo: 'BC', nome: 'Bancada' },
] as const

export const AREAS_WMS = PADRAO_AREAS_WMS.map((a) => a.codigo)
export const TIPOS_WMS = PADRAO_TIPOS_WMS.map((t) => t.codigo)

export type AreaWms = (typeof PADRAO_AREAS_WMS)[number]['codigo']
export type TipoWms = (typeof PADRAO_TIPOS_WMS)[number]['codigo']

export const ROTULOS_AREA_WMS: Record<string, string> = Object.fromEntries(
  PADRAO_AREAS_WMS.map((a) => [a.codigo, a.nome])
)
export const ROTULOS_TIPO_WMS: Record<string, string> = Object.fromEntries(
  PADRAO_TIPOS_WMS.map((t) => [t.codigo, t.nome])
)

export type ComponentesEnderecoWms = {
  local: string
  area: string
  tipo: string
  rua: string
  andar: string
  posicao: string
}

export type ComponentesEnderecoWmsValidos = {
  local: LocalWms
  area: string
  tipo: string
  rua: string
  andar: string
  posicao: string
}

const REGEX_AREA_TIPO = /^[A-Z]{2}$/
const REGEX_RUA = /^\d{2}$/
const REGEX_ANDAR = /^\d$/
const REGEX_POSICAO = /^\d{2}$/
const REGEX_CODIGO = /^([AB])-([A-Z]{2})-([A-Z]{2})-(\d{2})-(\d)-(\d{2})$/

function soDigitos(valor: string, max: number): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, max)
}

function soLetras(valor: string, max: number): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, max)
}

function pad2(valor: string): string {
  const d = soDigitos(valor, 2)
  if (d.length === 0) return ''
  return d.padStart(2, '0')
}

export function ehLocalWms(valor: string): valor is LocalWms {
  return (LOCAIS_WMS as readonly string[]).includes(valor)
}

export function normalizarCodigoNivelEstruturaWms(nivel: string, bruto: string): string {
  if (nivel === 'area' || nivel === 'tipo') return soLetras(bruto, 2)
  if (nivel === 'rua') return pad2(bruto)
  if (nivel === 'andar') return soDigitos(bruto, 1)
  return String(bruto ?? '').trim()
}

export function validarCodigoNivelEstruturaWms(nivel: string, bruto: string): string {
  const codigo = normalizarCodigoNivelEstruturaWms(nivel, bruto)
  if (nivel === 'area') {
    if (!REGEX_AREA_TIPO.test(codigo)) throw new Error('Área deve ter 2 letras')
    return codigo
  }
  if (nivel === 'tipo') {
    if (!REGEX_AREA_TIPO.test(codigo)) throw new Error('Tipo de endereço deve ter 2 letras')
    return codigo
  }
  if (nivel === 'rua') {
    if (!REGEX_RUA.test(codigo)) throw new Error('Rua deve ter 2 números (00 a 99)')
    return codigo
  }
  if (nivel === 'andar') {
    if (!REGEX_ANDAR.test(codigo)) throw new Error('Andar deve ter 1 número (0 a 9)')
    return codigo
  }
  throw new Error('Nível da estrutura inválido')
}

export function normalizarComponentesEnderecoWms(
  bruto: ComponentesEnderecoWms
): ComponentesEnderecoWms {
  return {
    local: String(bruto.local ?? '').trim().toUpperCase(),
    area: soLetras(bruto.area, 2),
    tipo: soLetras(bruto.tipo, 2),
    rua: pad2(bruto.rua),
    andar: soDigitos(bruto.andar, 1),
    posicao: pad2(bruto.posicao),
  }
}

export function validarComponentesEnderecoWms(
  bruto: ComponentesEnderecoWms
): ComponentesEnderecoWmsValidos {
  const n = normalizarComponentesEnderecoWms(bruto)

  if (!ehLocalWms(n.local)) {
    throw new Error('Local deve ser A ou B')
  }
  if (!REGEX_AREA_TIPO.test(n.area)) {
    throw new Error('Área deve ter 2 letras')
  }
  if (!REGEX_AREA_TIPO.test(n.tipo)) {
    throw new Error('Tipo de endereço deve ter 2 letras')
  }
  if (!REGEX_RUA.test(n.rua)) {
    throw new Error('Rua deve ter 2 números (00 a 99)')
  }
  if (!REGEX_ANDAR.test(n.andar)) {
    throw new Error('Andar deve ter 1 número (0 a 9)')
  }
  if (!REGEX_POSICAO.test(n.posicao)) {
    throw new Error('Posição deve ter 2 números (00 a 99)')
  }

  return {
    local: n.local,
    area: n.area,
    tipo: n.tipo,
    rua: n.rua,
    andar: n.andar,
    posicao: n.posicao,
  }
}

export function montarCodigoEnderecoWms(
  componentes: ComponentesEnderecoWmsValidos
): string {
  return `${componentes.local}-${componentes.area}-${componentes.tipo}-${componentes.rua}-${componentes.andar}-${componentes.posicao}`
}

export function parsearCodigoEnderecoWms(
  codigo: string
): ComponentesEnderecoWmsValidos | null {
  const m = String(codigo ?? '').trim().toUpperCase().match(REGEX_CODIGO)
  if (!m) return null
  return {
    local: m[1] as LocalWms,
    area: m[2]!,
    tipo: m[3]!,
    rua: m[4]!,
    andar: m[5]!,
    posicao: m[6]!,
  }
}

export function rotuloCompletoEnderecoWms(
  componentes: ComponentesEnderecoWmsValidos
): string {
  return [
    componentes.local,
    ROTULOS_LOCAL_WMS[componentes.local],
    componentes.area,
    ROTULOS_AREA_WMS[componentes.area] ?? componentes.area,
    componentes.tipo,
    ROTULOS_TIPO_WMS[componentes.tipo] ?? componentes.tipo,
    `Rua ${componentes.rua}`,
    `Andar ${componentes.andar}`,
    `Posição ${componentes.posicao}`,
  ].join(' ')
}

function normalizarTextoBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export type ExtrasBuscaEnderecoWms = {
  locais: LocalWms[]
  areas: string[]
  tipos: string[]
}

function casarRotulo(tokenNorm: string, codigo: string, rotulo: string): boolean {
  const codigoNorm = codigo.toLowerCase()
  if (tokenNorm === codigoNorm) return true
  if (tokenNorm.length < 3) return false
  return normalizarTextoBusca(rotulo).includes(tokenNorm)
}

/** Expande um token de busca para códigos de nomenclatura (ex.: "recebimento" → RC). */
export function extrasBuscaEnderecoWms(token: string): ExtrasBuscaEnderecoWms {
  const tokenNorm = normalizarTextoBusca(token.trim())
  const vazios: ExtrasBuscaEnderecoWms = { locais: [], areas: [], tipos: [] }
  if (!tokenNorm) return vazios

  const locais = LOCAIS_WMS.filter((c) =>
    casarRotulo(tokenNorm, c, ROTULOS_LOCAL_WMS[c])
  )
  const areas = PADRAO_AREAS_WMS.filter((a) =>
    casarRotulo(tokenNorm, a.codigo, a.nome)
  ).map((a) => a.codigo)
  const tipos = PADRAO_TIPOS_WMS.filter((t) =>
    casarRotulo(tokenNorm, t.codigo, t.nome)
  ).map((t) => t.codigo)

  return { locais, areas, tipos }
}
