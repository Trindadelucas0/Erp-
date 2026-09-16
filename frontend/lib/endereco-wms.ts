export type ComponentesEnderecoWms = {
  local: string
  area: string
  rua: string
  bloco: string
  andar: string
  posicao: string
}

function soDigitos(valor: string, max: number): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, max)
}

function soAlfanumerico(valor: string, max: number): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, max)
}

function pad2(valor: string): string {
  const d = soDigitos(valor, 4)
  if (d.length === 0) return ''
  if (d.length === 1) return d.padStart(2, '0')
  return d
}

export function mascaraRuaOuPosicao(valor: string): string {
  return soDigitos(valor, 4)
}

export function completarDoisDigitos(valor: string): string {
  return pad2(valor)
}

export function montarCodigoEnderecoWms(c: ComponentesEnderecoWms): string | null {
  const local = soAlfanumerico(c.local, 6)
  const area = soAlfanumerico(c.area, 6)
  const rua = pad2(c.rua)
  const bloco = pad2(c.bloco)
  const andar = soDigitos(c.andar, 2)
  const posicao = pad2(c.posicao)
  if (!local || !area || !rua || !bloco || !andar || !posicao) return null
  return `${local}-${area}-${rua}-${bloco}-${andar}-${posicao}`
}

export function rotuloNivelWms(codigo: string, nomes?: Record<string, string>): string {
  return nomes?.[codigo] ?? codigo
}

export const ROTULOS_LOCAL_WMS: Record<string, string> = {
  A: 'Prédio principal da fábrica',
  B: 'Prédio secundário / Anexo II',
}

export const ROTULOS_AREA_WMS: Record<string, string> = {
  RC: 'Recebimento',
  EX: 'Expedição',
  CQ: 'Controle de Qualidade',
}

export const TIPOS_ENDERECO_WMS = [
  { value: 'PP', label: 'PP — Porta-Pallet' },
  { value: 'CX', label: 'CX — Caixa' },
  { value: 'CH', label: 'CH — Chão' },
  { value: 'BC', label: 'BC — Bancada' },
]

export function segmentosCodigoEnderecoWms(codigo: string): ComponentesEnderecoWms | null {
  const partes = codigo.trim().toUpperCase().split('-')
  if (partes.length !== 6) return null
  const [local, area, rua, bloco, andar, posicao] = partes
  if (!local || !area || !rua || !bloco || !andar || !posicao) return null
  return { local, area, rua, bloco, andar, posicao }
}

export type DadosDetalheEnderecoWms = {
  codigoCompleto?: string
  local?: string
  area?: string
  rua?: string
  bloco?: string
  andar?: string
  posicao?: string
  tipoEndereco?: string
}

export type DetalheEnderecoWms = {
  codigo: string
  local: string
  area: string
  caminho: string
  tipo: string
}

function comNome(codigo: string, rotulos: Record<string, string>) {
  const nome = rotulos[codigo]
  return nome ? `${codigo} — ${nome}` : codigo
}

export function rotuloTipoEnderecoWms(tipo?: string) {
  const t = String(tipo ?? '').trim().toUpperCase()
  if (!t) return ''
  return TIPOS_ENDERECO_WMS.find((o) => o.value === t)?.label ?? t
}

export function montarDetalheEnderecoWms(dados: DadosDetalheEnderecoWms): DetalheEnderecoWms | null {
  const doCodigo = dados.codigoCompleto ? segmentosCodigoEnderecoWms(dados.codigoCompleto) : null
  const local = (dados.local || doCodigo?.local || '').trim().toUpperCase()
  const area = (dados.area || doCodigo?.area || '').trim().toUpperCase()
  const rua = (dados.rua || doCodigo?.rua || '').trim()
  const bloco = (dados.bloco || doCodigo?.bloco || '').trim()
  const andar = (dados.andar || doCodigo?.andar || '').trim()
  const posicao = (dados.posicao || doCodigo?.posicao || '').trim()
  const codigo =
    dados.codigoCompleto?.trim() ||
    (local && area && rua && bloco && andar && posicao
      ? `${local}-${area}-${rua}-${bloco}-${andar}-${posicao}`
      : '')
  if (!codigo) return null
  const tipo = rotuloTipoEnderecoWms(dados.tipoEndereco)
  return {
    codigo,
    local: local ? `Local ${comNome(local, ROTULOS_LOCAL_WMS)}` : '',
    area: area ? `Área ${comNome(area, ROTULOS_AREA_WMS)}` : '',
    caminho: [rua && `Rua ${rua}`, bloco && `Bloco ${bloco}`, andar && `Andar ${andar}`, posicao && `Apartamento ${posicao}`]
      .filter(Boolean)
      .join(' · '),
    tipo,
  }
}
