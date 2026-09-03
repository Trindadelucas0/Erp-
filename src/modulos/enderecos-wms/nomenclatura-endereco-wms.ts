/**
 * Padrão oficial do endereço WMS (§7.25):
 * LOCAL(1) + ÁREA(2) + TIPO(2) + RUA(2 dígitos) + ANDAR(1) + POSIÇÃO(2)
 * Código canônico com hífen: A-RC-CH-20-2-05
 */

export const LOCAIS_WMS = ['A', 'B'] as const
export const AREAS_WMS = ['RC', 'EX', 'CQ'] as const
export const TIPOS_WMS = ['PP', 'CX', 'CH', 'BC'] as const

export type LocalWms = (typeof LOCAIS_WMS)[number]
export type AreaWms = (typeof AREAS_WMS)[number]
export type TipoWms = (typeof TIPOS_WMS)[number]

export const ROTULOS_LOCAL_WMS: Record<LocalWms, string> = {
  A: 'Prédio principal da fábrica',
  B: 'Prédio secundário / Anexo II',
}

export const ROTULOS_AREA_WMS: Record<AreaWms, string> = {
  RC: 'Recebimento',
  EX: 'Expedição',
  CQ: 'Controle de Qualidade',
}

export const ROTULOS_TIPO_WMS: Record<TipoWms, string> = {
  PP: 'Porta-Pallet',
  CX: 'Caixa',
  CH: 'Chão',
  BC: 'Bancada',
}

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
  area: AreaWms
  tipo: TipoWms
  rua: string
  andar: string
  posicao: string
}

const REGEX_RUA = /^\d{2}$/
const REGEX_ANDAR = /^\d$/
const REGEX_POSICAO = /^\d{2}$/
const REGEX_CODIGO =
  /^([AB])-(RC|EX|CQ)-(PP|CX|CH|BC)-(\d{2})-(\d)-(\d{2})$/

function soDigitos(valor: string, max: number): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, max)
}

function pad2(valor: string): string {
  const d = soDigitos(valor, 2)
  if (d.length === 0) return ''
  return d.padStart(2, '0')
}

export function ehLocalWms(valor: string): valor is LocalWms {
  return (LOCAIS_WMS as readonly string[]).includes(valor)
}

export function ehAreaWms(valor: string): valor is AreaWms {
  return (AREAS_WMS as readonly string[]).includes(valor)
}

export function ehTipoWms(valor: string): valor is TipoWms {
  return (TIPOS_WMS as readonly string[]).includes(valor)
}

export function normalizarComponentesEnderecoWms(
  bruto: ComponentesEnderecoWms
): ComponentesEnderecoWms {
  return {
    local: String(bruto.local ?? '').trim().toUpperCase(),
    area: String(bruto.area ?? '').trim().toUpperCase(),
    tipo: String(bruto.tipo ?? '').trim().toUpperCase(),
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
  if (!ehAreaWms(n.area)) {
    throw new Error('Área deve ser RC, EX ou CQ')
  }
  if (!ehTipoWms(n.tipo)) {
    throw new Error('Tipo de endereço deve ser PP, CX, CH ou BC')
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
    area: m[2] as AreaWms,
    tipo: m[3] as TipoWms,
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
    ROTULOS_AREA_WMS[componentes.area],
    componentes.tipo,
    ROTULOS_TIPO_WMS[componentes.tipo],
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
  areas: AreaWms[]
  tipos: TipoWms[]
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
  const areas = AREAS_WMS.filter((c) =>
    casarRotulo(tokenNorm, c, ROTULOS_AREA_WMS[c])
  )
  const tipos = TIPOS_WMS.filter((c) =>
    casarRotulo(tokenNorm, c, ROTULOS_TIPO_WMS[c])
  )

  return { locais, areas, tipos }
}
