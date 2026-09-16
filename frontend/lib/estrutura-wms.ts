export const NIVEIS_ESTRUTURA_WMS = ['local', 'area', 'rua', 'bloco', 'andar'] as const
export type NivelEstruturaWms = (typeof NIVEIS_ESTRUTURA_WMS)[number]

export type ItemEstruturaWms = {
  id: string
  nivel: NivelEstruturaWms | string
  codigo: string
  nome: string
  parentId?: string | null
  sequencia?: number
  status?: string
  ativo: boolean
  qtdApartamentos?: number
  filhos?: ItemEstruturaWms[]
}

export const ROTULOS_NIVEL_ESTRUTURA_WMS: Record<NivelEstruturaWms, string> = {
  local: 'Local',
  area: 'Área',
  rua: 'Rua',
  bloco: 'Bloco',
  andar: 'Andar',
}

export const FILHO_NIVEL: Record<NivelEstruturaWms, NivelEstruturaWms | 'apartamento' | null> = {
  local: 'area',
  area: 'rua',
  rua: 'bloco',
  bloco: 'andar',
  andar: 'apartamento',
}

export const ROTULO_NOVO_FILHO: Record<string, string> = {
  local: 'Nova área',
  area: 'Nova rua',
  rua: 'Novo bloco',
  bloco: 'Novo andar',
  andar: 'Novo apartamento',
}

export type ModoCadastroWms = 'um' | 'varios'

export type FormGerarWms = {
  modo: ModoCadastroWms
  novoLocal: boolean
  novaArea: boolean
  localId: string
  localCodigo: string
  localNome: string
  areaId: string
  areaCodigo: string
  areaNome: string
  ruaId: string
  ruaInicio: string
  ruaFim: string
  blocoInicio: string
  blocoFim: string
  andarInicio: string
  andarFim: string
  apartamentoInicio: string
  apartamentoFim: string
  tipoPadrao: string
}

export const FORM_GERAR_WMS_VAZIO: FormGerarWms = {
  modo: 'um',
  novoLocal: false,
  novaArea: false,
  localId: '',
  localCodigo: '',
  localNome: '',
  areaId: '',
  areaCodigo: '',
  areaNome: '',
  ruaId: '',
  ruaInicio: '01',
  ruaFim: '01',
  blocoInicio: '01',
  blocoFim: '01',
  andarInicio: '1',
  andarFim: '1',
  apartamentoInicio: '01',
  apartamentoFim: '01',
  tipoPadrao: 'CH',
}

function faixaModo(modo: ModoCadastroWms, inicio: string, fim: string) {
  return modo === 'um' ? { inicio, fim: inicio } : { inicio, fim }
}

export function corpoGerarEstruturaWms(form: FormGerarWms) {
  const rua = faixaModo(form.modo, form.ruaInicio, form.ruaFim)
  const bloco = faixaModo(form.modo, form.blocoInicio, form.blocoFim)
  const andar = faixaModo(form.modo, form.andarInicio, form.andarFim)
  const ap = faixaModo(form.modo, form.apartamentoInicio, form.apartamentoFim)
  return {
    localId: form.novoLocal ? undefined : form.localId || undefined,
    localCodigo: form.novoLocal ? form.localCodigo || undefined : undefined,
    localNome: form.novoLocal ? form.localNome || undefined : undefined,
    areaId: form.novaArea ? undefined : form.areaId || undefined,
    areaCodigo: form.novaArea ? form.areaCodigo || undefined : undefined,
    areaNome: form.novaArea ? form.areaNome || undefined : undefined,
    ruaId: form.ruaId || undefined,
    ruaInicio: form.ruaId ? undefined : rua.inicio,
    ruaFim: form.ruaId ? undefined : rua.fim,
    blocoInicio: bloco.inicio,
    blocoFim: bloco.fim,
    andarInicio: andar.inicio,
    andarFim: andar.fim,
    apartamentoInicio: ap.inicio,
    apartamentoFim: ap.fim,
    tipoPadrao: form.tipoPadrao,
  }
}

export function cadastroWmsProntoParaPreview(form: FormGerarWms) {
  const temLocal = form.novoLocal ? Boolean(form.localCodigo.trim()) : Boolean(form.localId)
  const temArea = form.novaArea ? Boolean(form.areaCodigo.trim()) : Boolean(form.areaId)
  if (!temLocal || !temArea) return false
  if (form.ruaId) return true
  return Boolean(form.ruaInicio.trim() && form.blocoInicio.trim() && form.andarInicio.trim() && form.apartamentoInicio.trim())
}

export function mascaraCodigoNivelWms(nivel: string, valor: string): string {
  if (nivel === 'local' || nivel === 'area') {
    return String(valor ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6)
  }
  if (nivel === 'rua' || nivel === 'bloco' || nivel === 'apartamento') {
    return String(valor ?? '').replace(/\D/g, '').slice(0, 4)
  }
  return String(valor ?? '').replace(/\D/g, '').slice(0, 2)
}

export function completarCodigoNivelWms(nivel: string, valor: string): string {
  const mascara = mascaraCodigoNivelWms(nivel, valor)
  if ((nivel === 'rua' || nivel === 'bloco' || nivel === 'apartamento') && mascara.length > 0) {
    return mascara.length === 1 ? mascara.padStart(2, '0') : mascara
  }
  return mascara
}

export function achatarArvoreWms(
  nos: ItemEstruturaWms[],
  expandidos: Set<string>,
  nivel = 0
): (ItemEstruturaWms & { profundidade: number; temFilhos: boolean })[] {
  const linhas: (ItemEstruturaWms & { profundidade: number; temFilhos: boolean })[] = []
  for (const no of nos) {
    const filhos = no.filhos ?? []
    const temFilhos = filhos.length > 0 || no.nivel === 'andar'
    linhas.push({ ...no, profundidade: nivel, temFilhos })
    if (temFilhos && expandidos.has(no.id)) {
      linhas.push(...achatarArvoreWms(filhos, expandidos, nivel + 1))
    }
  }
  return linhas
}

export function coletarIdsCaminho(nos: ItemEstruturaWms[], alvoId: string, prefixo: string[] = []): string[] | null {
  for (const no of nos) {
    const caminho = [...prefixo, no.id]
    if (no.id === alvoId) return caminho
    const filhos = no.filhos ?? []
    if (filhos.length) {
      const achou = coletarIdsCaminho(filhos, alvoId, caminho)
      if (achou) return achou
    }
  }
  return null
}
