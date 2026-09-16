/**
 * Padrão oficial do endereço WMS (§7.25):
 * LOCAL-ÁREA-RUA-BLOCO-ANDAR-AP (ex.: A-RC-20-01-2-05)
 * Tipo de estrutura (PP/CX/CH/BC) é atributo do apartamento, não segmento do código.
 */

export const PADRAO_LOCAIS_WMS = [
  { codigo: 'A', nome: 'Prédio principal da fábrica' },
  { codigo: 'B', nome: 'Prédio secundário / Anexo II' },
] as const

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

export const LOCAIS_WMS = PADRAO_LOCAIS_WMS.map((l) => l.codigo)
export const AREAS_WMS = PADRAO_AREAS_WMS.map((a) => a.codigo)
export const TIPOS_WMS = PADRAO_TIPOS_WMS.map((t) => t.codigo)

export const ROTULOS_LOCAL_WMS: Record<string, string> = Object.fromEntries(
  PADRAO_LOCAIS_WMS.map((l) => [l.codigo, l.nome])
)
export const ROTULOS_AREA_WMS: Record<string, string> = Object.fromEntries(
  PADRAO_AREAS_WMS.map((a) => [a.codigo, a.nome])
)
export const ROTULOS_TIPO_WMS: Record<string, string> = Object.fromEntries(
  PADRAO_TIPOS_WMS.map((t) => [t.codigo, t.nome])
)

export const NIVEIS_HIERARQUIA_WMS = ['local', 'area', 'rua', 'bloco', 'andar'] as const
export type NivelHierarquiaWms = (typeof NIVEIS_HIERARQUIA_WMS)[number]

export const FILHO_DO_NIVEL: Record<NivelHierarquiaWms, NivelHierarquiaWms | null> = {
  local: 'area',
  area: 'rua',
  rua: 'bloco',
  bloco: 'andar',
  andar: null,
}

export const PAI_DO_NIVEL: Record<NivelHierarquiaWms, NivelHierarquiaWms | null> = {
  local: null,
  area: 'local',
  rua: 'area',
  bloco: 'rua',
  andar: 'bloco',
}

export type ComponentesEnderecoWms = {
  local: string
  area: string
  rua: string
  bloco: string
  andar: string
  posicao: string
}

export type ComponentesEnderecoWmsValidos = ComponentesEnderecoWms

const REGEX_SEGMENTO = /^[A-Z0-9]{1,6}$/
const REGEX_NUMERICO = /^\d{1,4}$/
const REGEX_ANDAR = /^\d{1,2}$/
const REGEX_CODIGO =
  /^([A-Z0-9]{1,6})-([A-Z0-9]{1,6})-(\d{1,4})-(\d{1,4})-(\d{1,2})-(\d{1,4})$/
const REGEX_CODIGO_LEGADO =
  /^([A-Z])-([A-Z]{2})-([A-Z]{2})-(\d{2})-(\d)-(\d{2})$/

function soAlfanumerico(valor: string, max: number): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, max)
}

function soDigitos(valor: string, max: number): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, max)
}

function pad2(valor: string): string {
  const d = soDigitos(valor, 4)
  if (d.length === 0) return ''
  if (d.length === 1) return d.padStart(2, '0')
  return d
}

export function ehTipoEnderecoWms(valor: string): boolean {
  return TIPOS_WMS.includes(valor as (typeof TIPOS_WMS)[number]) || /^[A-Z]{2}$/.test(valor)
}

export function normalizarCodigoNivelEstruturaWms(nivel: string, bruto: string): string {
  if (nivel === 'local' || nivel === 'area') return soAlfanumerico(bruto, 6)
  if (nivel === 'rua' || nivel === 'bloco' || nivel === 'apartamento') return pad2(bruto)
  if (nivel === 'andar') return soDigitos(bruto, 2)
  return String(bruto ?? '').trim().toUpperCase()
}

export function validarCodigoNivelEstruturaWms(nivel: string, bruto: string): string {
  const codigo = normalizarCodigoNivelEstruturaWms(nivel, bruto)
  if (nivel === 'local') {
    if (!REGEX_SEGMENTO.test(codigo)) throw new Error('Local deve ter 1 a 6 letras ou números')
    return codigo
  }
  if (nivel === 'area') {
    if (!REGEX_SEGMENTO.test(codigo)) throw new Error('Área deve ter 1 a 6 letras ou números')
    return codigo
  }
  if (nivel === 'rua') {
    if (!REGEX_NUMERICO.test(codigo)) throw new Error('Rua deve ter números (ex.: 01)')
    return pad2(codigo)
  }
  if (nivel === 'bloco') {
    if (!REGEX_NUMERICO.test(codigo)) throw new Error('Bloco deve ter números (ex.: 01)')
    return pad2(codigo)
  }
  if (nivel === 'andar') {
    if (!REGEX_ANDAR.test(codigo)) throw new Error('Andar deve ter 1 ou 2 números')
    return codigo
  }
  if (nivel === 'apartamento') {
    if (!REGEX_NUMERICO.test(codigo)) throw new Error('Apartamento deve ter números (ex.: 05)')
    return pad2(codigo)
  }
  throw new Error('Nível da estrutura inválido')
}

export function normalizarComponentesEnderecoWms(
  bruto: ComponentesEnderecoWms
): ComponentesEnderecoWms {
  return {
    local: soAlfanumerico(bruto.local, 6),
    area: soAlfanumerico(bruto.area, 6),
    rua: pad2(bruto.rua),
    bloco: pad2(bruto.bloco),
    andar: soDigitos(bruto.andar, 2),
    posicao: pad2(bruto.posicao),
  }
}

export function validarComponentesEnderecoWms(
  bruto: ComponentesEnderecoWms
): ComponentesEnderecoWmsValidos {
  const n = normalizarComponentesEnderecoWms(bruto)
  validarCodigoNivelEstruturaWms('local', n.local)
  validarCodigoNivelEstruturaWms('area', n.area)
  validarCodigoNivelEstruturaWms('rua', n.rua)
  validarCodigoNivelEstruturaWms('bloco', n.bloco)
  validarCodigoNivelEstruturaWms('andar', n.andar)
  validarCodigoNivelEstruturaWms('apartamento', n.posicao)
  return {
    local: n.local,
    area: n.area,
    rua: n.rua,
    bloco: n.bloco,
    andar: n.andar,
    posicao: n.posicao,
  }
}

export function montarCodigoEnderecoWms(componentes: ComponentesEnderecoWmsValidos): string {
  return `${componentes.local}-${componentes.area}-${componentes.rua}-${componentes.bloco}-${componentes.andar}-${componentes.posicao}`
}

export function parsearCodigoEnderecoWms(codigo: string): ComponentesEnderecoWmsValidos | null {
  const bruto = String(codigo ?? '').trim().toUpperCase()
  const m = bruto.match(REGEX_CODIGO)
  if (!m) return null
  try {
    return validarComponentesEnderecoWms({
      local: m[1]!,
      area: m[2]!,
      rua: m[3]!,
      bloco: m[4]!,
      andar: m[5]!,
      posicao: m[6]!,
    })
  } catch {
    return null
  }
}

/** Só para migração / testes de legado A-RC-CH-20-2-05. */
export function parsearCodigoLegadoComTipo(codigo: string): {
  componentes: ComponentesEnderecoWmsValidos
  tipoEndereco: string
} | null {
  const m = String(codigo ?? '').trim().toUpperCase().match(REGEX_CODIGO_LEGADO)
  if (!m) return null
  return {
    tipoEndereco: m[3]!,
    componentes: {
      local: m[1]!,
      area: m[2]!,
      rua: m[4]!,
      bloco: '01',
      andar: m[5]!,
      posicao: m[6]!,
    },
  }
}

export function faixaNumerica(inicio: string, fim: string, nivel: string): string[] {
  const a = Number(soDigitos(inicio, 4))
  const b = Number(soDigitos(fim, 4))
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) {
    throw new Error('Faixa inválida: inicial deve ser menor ou igual ao final')
  }
  const lista: string[] = []
  for (let i = a; i <= b; i++) {
    lista.push(validarCodigoNivelEstruturaWms(nivel, String(i)))
  }
  return lista
}

function normalizarTextoBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export type ExtrasBuscaEnderecoWms = {
  locais: string[]
  areas: string[]
  tipos: string[]
}

function casarRotulo(tokenNorm: string, codigo: string, rotulo: string): boolean {
  const codigoNorm = codigo.toLowerCase()
  if (tokenNorm === codigoNorm) return true
  if (tokenNorm.length < 3) return false
  return normalizarTextoBusca(rotulo).includes(tokenNorm)
}

export function extrasBuscaEnderecoWms(token: string): ExtrasBuscaEnderecoWms {
  const tokenNorm = normalizarTextoBusca(token.trim())
  const vazios: ExtrasBuscaEnderecoWms = { locais: [], areas: [], tipos: [] }
  if (!tokenNorm) return vazios

  const locais = PADRAO_LOCAIS_WMS.filter((l) =>
    casarRotulo(tokenNorm, l.codigo, l.nome)
  ).map((l) => l.codigo)
  const areas = PADRAO_AREAS_WMS.filter((a) =>
    casarRotulo(tokenNorm, a.codigo, a.nome)
  ).map((a) => a.codigo)
  const tipos = PADRAO_TIPOS_WMS.filter((t) =>
    casarRotulo(tokenNorm, t.codigo, t.nome)
  ).map((t) => t.codigo)

  return { locais, areas, tipos }
}

export const TETO_GERAR_ENDERECOS_WMS = 10_000
export const LIMITE_LISTAGEM_ENDERECO_WMS_BUSCA = 80
export const TETO_TAKE_LISTAGEM_ENDERECO_WMS = 200
export const MSG_DUPLICATA_AP = (codigo: string) =>
  `Já existe um apartamento ${codigo} neste andar.`

/** Teto só na busca textual sem andar (picker). Árvore por andarId não limita. */
export function resolverTakeListagemEnderecoWms(opcoes?: {
  q?: string
  andarId?: string
  take?: number
}): number | undefined {
  if (opcoes?.andarId?.trim()) return undefined
  if (!opcoes?.q?.trim()) return undefined
  const bruto = opcoes.take ?? LIMITE_LISTAGEM_ENDERECO_WMS_BUSCA
  if (!Number.isFinite(bruto)) return LIMITE_LISTAGEM_ENDERECO_WMS_BUSCA
  return Math.min(Math.max(1, Math.trunc(bruto)), TETO_TAKE_LISTAGEM_ENDERECO_WMS)
}
