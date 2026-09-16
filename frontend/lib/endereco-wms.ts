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

export const TIPOS_ENDERECO_WMS = [
  { value: 'PP', label: 'PP — Porta-Pallet' },
  { value: 'CX', label: 'CX — Caixa' },
  { value: 'CH', label: 'CH — Chão' },
  { value: 'BC', label: 'BC — Bancada' },
]
