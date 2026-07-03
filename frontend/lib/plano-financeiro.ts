export const MSG_PLANO_SOMENTE_DESPESA = 'Só é permitido plano da aba Despesas'
export const MSG_PLANO_SOMENTE_SUBGRUPO =
  'Só é permitido subgrupo de Despesas (ex.: 2.1.1)'

export const SUFIXO_CODIGO_MIN = 0
export const SUFIXO_CODIGO_MAX = 99
export const MSG_SUFIXO_INVALIDO = 'Informe um número de 0 a 99'
export const MSG_GRUPO_PAI_INCOERENTE =
  'O número do grupo não corresponde ao grupo pai selecionado'

export type TipoPlanoFinanceiro = 'receita' | 'despesa' | 'resultado'

export type PlanoCatalogo = {
  codigo: string
  tipo?: string
}

function raizDoTipo(tipo: TipoPlanoFinanceiro): string {
  if (tipo === 'receita') return '1'
  if (tipo === 'despesa') return '2'
  return '3'
}

export function raizDoTipoPlano(tipo: TipoPlanoFinanceiro): string {
  return raizDoTipo(tipo)
}

export function raizCodigoPlano(codigo: string): string | null {
  const match = codigo.trim().match(/^(\d)/)
  return match ? match[1] : null
}

export function prefixoParaNovoPlano(
  tipo: TipoPlanoFinanceiro,
  codigoPai?: string | null
): string {
  if (codigoPai) return `${codigoPai}.`
  return `${raizDoTipo(tipo)}.`
}

export function montarCodigoComSufixo(prefixo: string, sufixo: number): string {
  const base = prefixo.endsWith('.') ? prefixo.slice(0, -1) : prefixo
  return `${base}.${sufixo}`
}

export function montarCodigoPorSegmentos(
  tipo: TipoPlanoFinanceiro,
  segmentoGrupo: number,
  segmentoSubgrupo?: number | null
): string {
  const raiz = raizDoTipo(tipo)
  if (segmentoSubgrupo === undefined || segmentoSubgrupo === null) {
    return `${raiz}.${segmentoGrupo}`
  }
  return `${raiz}.${segmentoGrupo}.${segmentoSubgrupo}`
}

export function segmentoGrupoDeCodigoPai(codigoPai: string): number {
  const partes = codigoPai.split('.')
  return parseInt(partes[partes.length - 1], 10)
}

export function sufixoCodigoValido(sufixo: number): boolean {
  return (
    Number.isInteger(sufixo) &&
    sufixo >= SUFIXO_CODIGO_MIN &&
    sufixo <= SUFIXO_CODIGO_MAX
  )
}

export function validarSufixoInformado(valor: string): string | null {
  return validarSegmentoInformado(valor)
}

export function validarSegmentoInformado(valor: string): string | null {
  const texto = valor.trim()
  if (!texto) return MSG_SUFIXO_INVALIDO

  const numero = Number(texto)
  if (!sufixoCodigoValido(numero)) return MSG_SUFIXO_INVALIDO

  return null
}

type ValidarSegmentosCodigoParams = {
  tipo: TipoPlanoFinanceiro
  segmentoGrupo: string
  segmentoSubgrupo: string
  temPai: boolean
  codigoPai?: string | null
  planosParaValidacao: PlanoCodigoNome[]
  nomeEmpresa?: string
}

export function validarSegmentosCodigo({
  tipo,
  segmentoGrupo,
  segmentoSubgrupo,
  temPai,
  codigoPai,
  planosParaValidacao,
  nomeEmpresa,
}: ValidarSegmentosCodigoParams): string {
  const erroGrupo = validarSegmentoInformado(segmentoGrupo)
  if (erroGrupo) return erroGrupo

  if (temPai) {
    const erroSubgrupo = validarSegmentoInformado(segmentoSubgrupo)
    if (erroSubgrupo) return erroSubgrupo

    if (codigoPai) {
      const grupoEsperado = segmentoGrupoDeCodigoPai(codigoPai)
      if (Number(segmentoGrupo) !== grupoEsperado) {
        return MSG_GRUPO_PAI_INCOERENTE
      }
    }

    const codigo = montarCodigoPorSegmentos(
      tipo,
      Number(segmentoGrupo),
      Number(segmentoSubgrupo)
    )
    if (codigoPlanoJaExiste(codigo, planosParaValidacao)) {
      const planoExistente = buscarPlanoPorCodigo(codigo, planosParaValidacao)
      return mensagemCodigoDuplicado(
        codigo,
        planoExistente?.nome ?? codigo,
        nomeEmpresa
      )
    }
    return ''
  }

  const codigo = montarCodigoPorSegmentos(tipo, Number(segmentoGrupo))
  if (codigoPlanoJaExiste(codigo, planosParaValidacao)) {
    const planoExistente = buscarPlanoPorCodigo(codigo, planosParaValidacao)
    return mensagemCodigoDuplicado(
      codigo,
      planoExistente?.nome ?? codigo,
      nomeEmpresa
    )
  }
  return ''
}

const LIMITE_NOME_EXIBICAO = 60

function truncarNomeExibicao(nome: string): string {
  const texto = nome.trim()
  if (texto.length <= LIMITE_NOME_EXIBICAO) return texto
  return `${texto.slice(0, LIMITE_NOME_EXIBICAO)}…`
}

export type PlanoCodigoNome = { codigo: string; nome: string }

export function buscarPlanoPorCodigo(
  codigo: string,
  planos: PlanoCodigoNome[]
): PlanoCodigoNome | undefined {
  return planos.find((p) => p.codigo === codigo)
}

export function codigoPlanoJaExiste(codigo: string, planos: PlanoCodigoNome[]): boolean {
  return planos.some((p) => p.codigo === codigo)
}

export function mensagemCodigoDuplicado(
  codigo: string,
  nomeContaExistente: string,
  nomeEmpresa?: string
): string {
  const conta = truncarNomeExibicao(nomeContaExistente)
  const empresa = nomeEmpresa?.trim() ? truncarNomeExibicao(nomeEmpresa) : ''

  if (empresa) {
    return `Na empresa ${empresa}, o código ${codigo} já pertence à conta «${conta}». Escolha outro número.`
  }

  return `O código ${codigo} já pertence à conta «${conta}». Escolha outro número.`
}

export function planoEhSubgrupo(plano: PlanoCatalogo): boolean {
  return plano.codigo.trim().split('.').length >= 3
}

/** Plano da aba Despesas: tipo despesa ou código iniciando em 2. */
export function planoEhDespesa(plano: PlanoCatalogo): boolean {
  if (plano.tipo) return plano.tipo === 'despesa'
  return raizCodigoPlano(plano.codigo) === '2'
}
