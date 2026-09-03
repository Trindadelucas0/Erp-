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

function soDigitos(valor: string, max: number): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, max)
}

export function mascaraRuaOuPosicao(valor: string): string {
  return soDigitos(valor, 2)
}

export function mascaraAndar(valor: string): string {
  return soDigitos(valor, 1)
}

export function completarDoisDigitos(valor: string): string {
  const d = soDigitos(valor, 2)
  if (d.length === 0) return ''
  return d.padStart(2, '0')
}

export function montarCodigoEnderecoWms(c: ComponentesEnderecoWms): string | null {
  const local = c.local.trim().toUpperCase()
  const area = c.area.trim().toUpperCase()
  const tipo = c.tipo.trim().toUpperCase()
  const rua = completarDoisDigitos(c.rua)
  const andar = mascaraAndar(c.andar)
  const posicao = completarDoisDigitos(c.posicao)
  if (
    !LOCAIS_WMS.includes(local as LocalWms) ||
    !AREAS_WMS.includes(area as AreaWms) ||
    !TIPOS_WMS.includes(tipo as TipoWms) ||
    rua.length !== 2 ||
    andar.length !== 1 ||
    posicao.length !== 2
  ) {
    return null
  }
  return `${local}-${area}-${tipo}-${rua}-${andar}-${posicao}`
}

export function rotuloLocalWms(codigo: string): string {
  return ROTULOS_LOCAL_WMS[codigo as LocalWms] ?? codigo
}

export function rotuloAreaWms(codigo: string): string {
  return ROTULOS_AREA_WMS[codigo as AreaWms] ?? codigo
}

export function rotuloTipoWms(codigo: string): string {
  return ROTULOS_TIPO_WMS[codigo as TipoWms] ?? codigo
}
