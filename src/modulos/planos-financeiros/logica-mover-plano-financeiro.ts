import {
  codigoCompativelComTipo,
  codigoFilhoPorIndice,
  codigoRaizPorIndice,
  coletarDescendentes,
  substituirPrefixoCodigo,
  type TipoPlanoFinanceiro,
} from './codigo-plano-financeiro.js'

export type EstadoPlanoMover = {
  id: string
  codigo: string
  parentId: string | null
}

export type PosicaoMover = 'antes' | 'depois' | 'dentro'

export type ResultadoMovimento = {
  estado: Map<string, EstadoPlanoMover>
  updates: { id: string; codigo: string; parentId?: string | null }[]
}

export class ErroMovimentoPlano extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroMovimentoPlano'
  }
}

function filhosOrdenadosPorCodigo(
  parentId: string | null,
  estado: Map<string, EstadoPlanoMover>
): string[] {
  const filhos: EstadoPlanoMover[] = []
  for (const plano of estado.values()) {
    if (plano.parentId === parentId) filhos.push(plano)
  }
  return filhos
    .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
    .map((p) => p.id)
}

function atualizarCodigoSubarvore(
  rootId: string,
  prefixoAntigo: string,
  prefixoNovo: string,
  estado: Map<string, EstadoPlanoMover>
) {
  function visitar(id: string) {
    const plano = estado.get(id)!
    plano.codigo = substituirPrefixoCodigo(plano.codigo, prefixoAntigo, prefixoNovo)
    for (const filho of estado.values()) {
      if (filho.parentId === id) visitar(filho.id)
    }
  }
  visitar(rootId)
}

export function renumerarListaFilhos(
  parentId: string | null,
  filhosIds: string[],
  estado: Map<string, EstadoPlanoMover>,
  tipo: TipoPlanoFinanceiro
) {
  const codigoPai = parentId ? estado.get(parentId)!.codigo : null

  for (let i = 0; i < filhosIds.length; i++) {
    const filhoId = filhosIds[i]
    const novoCodigo =
      parentId === null
        ? codigoRaizPorIndice(tipo, i + 1)
        : codigoFilhoPorIndice(codigoPai!, i + 1)

    const plano = estado.get(filhoId)!
    const codigoAntigo = plano.codigo
    if (codigoAntigo !== novoCodigo) {
      atualizarCodigoSubarvore(filhoId, codigoAntigo, novoCodigo, estado)
    }
  }
}

export function executarMovimentoEmMemoria(
  estadoInicial: EstadoPlanoMover[],
  tipo: TipoPlanoFinanceiro,
  planoId: string,
  alvoId: string,
  posicao: PosicaoMover
): ResultadoMovimento {
  const original = new Map(
    estadoInicial.map((p) => [p.id, { codigo: p.codigo, parentId: p.parentId }] as const)
  )

  const estado = new Map<string, EstadoPlanoMover>()
  for (const reg of estadoInicial) {
    estado.set(reg.id, { ...reg })
  }

  const plano = estado.get(planoId)
  const alvo = estado.get(alvoId)
  if (!plano) throw new ErroMovimentoPlano('Plano não encontrado')
  if (!alvo) throw new ErroMovimentoPlano('Plano alvo não encontrado')

  if (alvoId === planoId) {
    throw new ErroMovimentoPlano('Não é possível mover um plano para ele mesmo')
  }

  const planosParaArvore = estadoInicial.map((p) => ({ id: p.id, parentId: p.parentId }))
  const descendentes = coletarDescendentes(planoId, planosParaArvore)
  const idsSubarvore = new Set([planoId, ...descendentes])

  if (idsSubarvore.has(alvoId)) {
    throw new ErroMovimentoPlano('Não é possível mover um plano para dentro de sua subárvore')
  }

  const movido = estado.get(planoId)!
  const parentIdAntigo = movido.parentId

  const irmaosSemSubarvore = (parentId: string | null) =>
    filhosOrdenadosPorCodigo(parentId, estado).filter((id) => !idsSubarvore.has(id))

  let novoParentId: string | null
  let indiceInsercao: number

  if (posicao === 'dentro') {
    novoParentId = alvoId
    indiceInsercao = irmaosSemSubarvore(novoParentId).length
  } else {
    novoParentId = alvo.parentId
    const irmaos = irmaosSemSubarvore(novoParentId)
    const idxAlvo = irmaos.indexOf(alvoId)
    if (idxAlvo === -1) throw new ErroMovimentoPlano('Posição de destino inválida')
    indiceInsercao = posicao === 'antes' ? idxAlvo : idxAlvo + 1
  }

  movido.parentId = novoParentId

  const listaDestino = irmaosSemSubarvore(novoParentId)
  listaDestino.splice(indiceInsercao, 0, planoId)

  if (parentIdAntigo !== novoParentId) {
    renumerarListaFilhos(parentIdAntigo, irmaosSemSubarvore(parentIdAntigo), estado, tipo)
  }

  renumerarListaFilhos(novoParentId, listaDestino, estado, tipo)

  const updates: { id: string; codigo: string; parentId?: string | null }[] = []
  for (const [id, atual] of estado) {
    const orig = original.get(id)!
    if (atual.codigo !== orig.codigo || atual.parentId !== orig.parentId) {
      if (!codigoCompativelComTipo(atual.codigo, tipo)) {
        throw new ErroMovimentoPlano('Código resultante incompatível com o tipo do plano')
      }
      updates.push({
        id,
        codigo: atual.codigo,
        ...(atual.parentId !== orig.parentId ? { parentId: atual.parentId } : {}),
      })
    }
  }

  return { estado, updates }
}
