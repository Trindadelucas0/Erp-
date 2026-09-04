export const NIVEIS_ESTRUTURA_WMS = ['area', 'tipo', 'rua', 'andar'] as const
export type NivelEstruturaWms = (typeof NIVEIS_ESTRUTURA_WMS)[number]

export type ItemEstruturaWms = {
  id: string
  nivel: NivelEstruturaWms | string
  codigo: string
  nome: string
  paiCodigo?: string | null
  ativo: boolean
}

export const ROTULOS_NIVEL_ESTRUTURA_WMS: Record<NivelEstruturaWms, string> = {
  area: 'Área',
  tipo: 'Tipo de endereço',
  rua: 'Rua',
  andar: 'Andar',
}

export function mascaraCodigoNivelWms(nivel: NivelEstruturaWms, valor: string): string {
  if (nivel === 'area' || nivel === 'tipo') {
    return String(valor ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2)
  }
  if (nivel === 'rua') {
    return String(valor ?? '').replace(/\D/g, '').slice(0, 2)
  }
  return String(valor ?? '').replace(/\D/g, '').slice(0, 1)
}

export function completarCodigoNivelWms(nivel: NivelEstruturaWms, valor: string): string {
  const mascara = mascaraCodigoNivelWms(nivel, valor)
  if (nivel === 'rua' && mascara.length > 0) {
    return mascara.padStart(2, '0')
  }
  return mascara
}

export function opcoesSelectNivel(
  itens: ItemEstruturaWms[],
  nivel: NivelEstruturaWms,
  extras: { incluirInativos?: boolean; codigoAtual?: string; paiCodigo?: string } = {}
) {
  return itens
    .filter((item) => item.nivel === nivel)
    .filter(
      (item) =>
        extras.incluirInativos ||
        item.ativo ||
        (extras.codigoAtual != null && extras.codigoAtual === item.codigo)
    )
    .filter((item) => {
      if (!extras.paiCodigo) return true
      return (
        item.paiCodigo === extras.paiCodigo ||
        (extras.codigoAtual != null && extras.codigoAtual === item.codigo)
      )
    })
    .map((item) => ({
      value: item.codigo,
      label: item.nome && item.nome !== item.codigo ? `${item.codigo} — ${item.nome}` : item.codigo,
    }))
}

export function mapaNomesNivel(itens: ItemEstruturaWms[], nivel: NivelEstruturaWms): Record<string, string> {
  const mapa: Record<string, string> = {}
  for (const item of itens) {
    if (item.nivel === nivel) mapa[item.codigo] = item.nome
  }
  return mapa
}
