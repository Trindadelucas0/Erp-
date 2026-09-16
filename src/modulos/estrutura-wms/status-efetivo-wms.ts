export const STATUS_ENDERECO_WMS = ['ativo', 'bloqueado', 'inativo'] as const
export type StatusEnderecoWms = (typeof STATUS_ENDERECO_WMS)[number]

export function statusParaAtivo(status: string): boolean {
  return status !== 'inativo'
}

export function ativoParaStatus(ativo: boolean): StatusEnderecoWms {
  return ativo ? 'ativo' : 'inativo'
}

export function rotuloStatusAncestral(nivel: string): string {
  const mapa: Record<string, string> = {
    local: 'Local',
    area: 'Área',
    rua: 'Rua',
    bloco: 'Bloco',
    andar: 'Andar',
  }
  return mapa[nivel] ?? 'nível superior'
}

export function mensagemIndisponivelPorAncestral(nivelPai: string): string {
  return `Este endereço está indisponível porque seu ${rotuloStatusAncestral(nivelPai)} está bloqueado.`
}
