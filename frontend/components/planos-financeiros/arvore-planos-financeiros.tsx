'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Power } from 'lucide-react'
import { MenuAcoesLinha } from '@/components/compartilhado/menu-acoes-linha'
import { BadgeStatus } from '@/components/ui/badge-status'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarArvore } from '@/lib/ordenacao-lista'
import { compararCodigoPlano, ordenarArvorePlanosPorCodigo } from '@/lib/plano-financeiro'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { cn } from '@/lib/utils'
import { criarRestrictToContainer } from './modifier-restrict-container'
import { LinhaOverlayDrag } from './linha-overlay-drag'
import { LinhaPlaceholderDrag } from './linha-placeholder-drag'
import {
  calcularPosicaoDrop,
  calcularPreviewInsercao,
  resolverDropPlano,
  descricaoPreviewDrop,
  montarLinhasComPreview,
  type DicaDrop,
  type ItemListaRender,
  type PosicaoMoverPlano,
} from './logica-preview-drag'
import {
  classesLinhaPorNivel,
  classesNomePorNivel,
} from './estilos-hierarquia-plano'
import { COLUNAS_FLAGS_PLANO, textoFlagSim, type ChaveFlagPlano } from './flags-plano-financeiro'
import { NIVEL_MAXIMO_PLANO } from './util-arvore-planos'

export type PlanoFinanceiroNo = {
  id: string
  codigo: string
  nome: string
  tipo: string
  classificacao: string | null
  mostrarNaDre: boolean
  permiteLancamentoManual?: boolean
  exigeAnexoLancamento?: boolean
  permiteUsoConsumo?: boolean
  ativo: boolean
  parentId: string | null
  filhos?: PlanoFinanceiroNo[]
}

export type { PosicaoMoverPlano }

type ColunaPlano = 'nome' | ChaveFlagPlano | 'situacao'

type LinhaPlana = PlanoFinanceiroNo & { nivel: number; temFilhos: boolean }

function temFilhosAtivos(plano: PlanoFinanceiroNo): boolean {
  return (plano.filhos ?? []).some((filho) => filho.ativo)
}

function achatarArvore(
  nos: PlanoFinanceiroNo[],
  expandidos: Set<string>,
  nivel = 0
): LinhaPlana[] {
  const linhas: LinhaPlana[] = []
  for (const no of nos) {
    const filhos = no.filhos ?? []
    const podeExpandir = nivel < NIVEL_MAXIMO_PLANO && filhos.length > 0
    linhas.push({ ...no, nivel, temFilhos: podeExpandir })
    if (podeExpandir && expandidos.has(no.id)) {
      linhas.push(...achatarArvore(filhos, expandidos, nivel + 1))
    }
  }
  return linhas
}

type Props = {
  arvore: PlanoFinanceiroNo[]
  busca: string
  filtroSituacao: 'todos' | 'ativos' | 'inativos'
  podeEditar: boolean
  podeDesativar: boolean
  podeCriar?: boolean
  movendoId?: string | null
  idsParaExpandir?: string[]
  aoEditar: (plano: PlanoFinanceiroNo) => void
  aoAlternarAtivo: (plano: PlanoFinanceiroNo) => void
  aoAviso?: (mensagem: string) => void
  aoAdicionarSubgrupo?: (plano: PlanoFinanceiroNo) => void
  aoMover?: (planoId: string, alvoId: string, posicao: PosicaoMoverPlano) => Promise<void>
}

type LinhaProps = {
  linha: LinhaPlana
  expandidos: Set<string>
  arrastarHabilitado: boolean
  movendoId?: string | null
  dicaDrop: DicaDrop | null
  arrastandoId: string | null
  podeEditar: boolean
  podeDesativar: boolean
  podeCriar: boolean
  aoEditar: (plano: PlanoFinanceiroNo) => void
  aoAlternarAtivo: (plano: PlanoFinanceiroNo) => void
  aoAviso?: (mensagem: string) => void
  aoAdicionarSubgrupo?: (plano: PlanoFinanceiroNo) => void
  aoAlternarExpansao: (id: string) => void
}

function LinhaPlanoFinanceiro({
  linha,
  expandidos,
  arrastarHabilitado,
  movendoId,
  dicaDrop,
  arrastandoId,
  podeEditar,
  podeDesativar,
  podeCriar,
  aoEditar,
  aoAlternarAtivo,
  aoAviso,
  aoAdicionarSubgrupo,
  aoAlternarExpansao,
}: LinhaProps) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: linha.id,
    disabled: !arrastarHabilitado,
  })

  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop-${linha.id}`,
    disabled: !arrastarHabilitado || arrastandoId === linha.id,
  })

  const mostraAntes = dicaDrop?.alvoId === linha.id && dicaDrop.posicao === 'antes'
  const mostraDepois = dicaDrop?.alvoId === linha.id && dicaDrop.posicao === 'depois'
  const mostraDentro = dicaDrop?.alvoId === linha.id && dicaDrop.posicao === 'dentro'

  function clicarAlternarAtivo() {
    if (linha.ativo && temFilhosAtivos(linha)) {
      aoAviso?.('Este grupo tem subplanos habilitados. Desabilite os subplanos primeiro.')
      return
    }
    aoAlternarAtivo(linha)
  }

  if (arrastandoId === linha.id) {
    return (
      <tr ref={setDropRef} className="h-0 border-0 opacity-0">
        <td className="h-0 p-0">
          <button ref={setDragRef} type="button" className="sr-only" {...listeners} {...attributes} />
        </td>
        <td colSpan={7} className="h-0 p-0" />
      </tr>
    )
  }

  return (
    <tr
      ref={setDropRef}
      className={cn(
        'border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-muted/20',
        classesLinhaPorNivel(linha.nivel),
        movendoId === linha.id && 'opacity-60',
        mostraAntes && 'border-t-[3px] border-t-primary',
        mostraDepois && 'border-b-[3px] border-b-primary',
        mostraDentro && 'bg-primary/10 ring-2 ring-inset ring-primary/40'
      )}
    >
      {arrastarHabilitado && (
        <td className="px-1 py-3">
          <button
            ref={setDragRef}
            type="button"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted',
              'cursor-grab active:cursor-grabbing'
            )}
            title="Arrastar para reordenar ou aninhar"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" />
          </button>
        </td>
      )}

      <td className="max-w-0 px-4 py-3">
        <div
          className="flex min-w-0 flex-col gap-1"
          style={{ paddingLeft: `${linha.nivel * 20}px` }}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {linha.temFilhos ? (
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
                onClick={() => aoAlternarExpansao(linha.id)}
              >
                {expandidos.has(linha.id) ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <span className="inline-block w-5 shrink-0" />
            )}
            <span
              className={cn('truncate', classesNomePorNivel(linha.nivel, linha.temFilhos))}
              title={`${linha.codigo} - ${linha.nome}`}
            >
              {linha.codigo} - {linha.nome}
            </span>
          </div>
          {mostraAntes && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
              ↑ inserir acima
            </span>
          )}
          {mostraDepois && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
              ↓ inserir abaixo
            </span>
          )}
          {mostraDentro && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
              Soltar como filho
            </span>
          )}
        </div>
      </td>
      {COLUNAS_FLAGS_PLANO.map((coluna) => (
        <td key={coluna.chave} className="px-2 py-3 text-center text-muted-foreground">
          {textoFlagSim(linha[coluna.chave])}
        </td>
      ))}
      <td className="px-4 py-3">
        <BadgeStatus variante={linha.ativo ? 'ativo' : 'reprovado'}>
          {linha.ativo ? 'Habilitado' : 'Desabilitado'}
        </BadgeStatus>
      </td>
      <td className="px-2 py-3">
        {(podeEditar || podeDesativar || podeCriar) && (
          <MenuAcoesLinha
            ariaLabel={`Ações do plano ${linha.nome}`}
            itens={[
              {
                rotulo: 'Adicionar subgrupo',
                icone: Plus,
                onClick: () => aoAdicionarSubgrupo?.(linha),
                oculto: !podeCriar || !aoAdicionarSubgrupo || linha.nivel !== 0,
              },
              {
                rotulo: 'Editar',
                icone: Pencil,
                onClick: () => aoEditar(linha),
                oculto: !podeEditar,
              },
              {
                rotulo: linha.ativo ? 'Desabilitar' : 'Habilitar',
                icone: Power,
                onClick: clicarAlternarAtivo,
                oculto: !podeDesativar,
              },
            ]}
          />
        )}
      </td>
    </tr>
  )
}

function renderizarItemLista(
  item: ItemListaRender,
  indice: number,
  props: Omit<LinhaProps, 'linha'>,
  previewMeta?: {
    posicao: PosicaoMoverPlano
    linhaArrastada: { codigo: string; nome: string }
    titulo: string
    detalhe: string
  }
) {
  if (item.tipo === 'placeholder' && previewMeta) {
    return (
      <LinhaPlaceholderDrag
        key={`placeholder-${indice}`}
        nivel={item.nivel}
        posicao={previewMeta.posicao}
        linhaArrastada={previewMeta.linhaArrastada}
        titulo={previewMeta.titulo}
        detalhe={previewMeta.detalhe}
        colSpan={8}
      />
    )
  }

  if (item.tipo === 'placeholder') {
    return null
  }

  return (
    <LinhaPlanoFinanceiro key={item.linha.id} linha={item.linha as LinhaPlana} {...props} />
  )
}

export function ArvorePlanosFinanceiros({
  arvore,
  busca,
  filtroSituacao,
  podeEditar,
  podeDesativar,
  podeCriar = false,
  movendoId,
  idsParaExpandir,
  aoEditar,
  aoAlternarAtivo,
  aoAviso,
  aoAdicionarSubgrupo,
  aoMover,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [dicaDrop, setDicaDrop] = useState<DicaDrop | null>(null)
  const [larguraTabela, setLarguraTabela] = useState(0)
  const refAreaDrag = useRef<HTMLDivElement>(null)
  const refTabela = useRef<HTMLTableElement>(null)
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<ColunaPlano>()

  const arrastarHabilitado =
    Boolean(podeEditar && aoMover) && !busca.trim() && filtroSituacao === 'todos'

  const restrictToArea = useMemo(
    () => criarRestrictToContainer(() => refAreaDrag.current),
    []
  )

  const sensores = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const atualizarLarguraTabela = useCallback(() => {
    if (refTabela.current) {
      setLarguraTabela(refTabela.current.offsetWidth)
    }
  }, [])

  useEffect(() => {
    if (!idsParaExpandir?.length) return
    setExpandidos((prev) => {
      const prox = new Set(prev)
      for (const id of idsParaExpandir) prox.add(id)
      return prox
    })
  }, [idsParaExpandir])

  useEffect(() => {
    if (!arrastandoId) return

    document.body.classList.add('cursor-grabbing', 'select-none')
    return () => {
      document.body.classList.remove('cursor-grabbing', 'select-none')
    }
  }, [arrastandoId])

  useEffect(() => {
    if (!arrastarHabilitado) return

    atualizarLarguraTabela()
    window.addEventListener('resize', atualizarLarguraTabela)
    return () => window.removeEventListener('resize', atualizarLarguraTabela)
  }, [arrastarHabilitado, atualizarLarguraTabela])

  const arvorePorCodigo = useMemo(() => ordenarArvorePlanosPorCodigo(arvore), [arvore])

  const arvoreOrdenada = useMemo(() => {
    if (!ordenacao || ordenacao.coluna === 'nome') {
      const fator = ordenacao?.direcao === 'desc' ? -1 : 1
      const ordenarNivel = (nos: PlanoFinanceiroNo[]): PlanoFinanceiroNo[] =>
        [...nos]
          .sort((a, b) => compararCodigoPlano(a.codigo, b.codigo) * fator)
          .map((no) => ({
            ...no,
            filhos: no.filhos?.length ? ordenarNivel(no.filhos) : no.filhos,
          }))
      return ordenarNivel(arvorePorCodigo)
    }

    return ordenarArvore(arvorePorCodigo, ordenacao, (no, coluna) => {
      if (coluna === 'situacao') return no.ativo ? 'Ativo' : 'Inativo'
      return no[coluna] ? 1 : 0
    })
  }, [arvorePorCodigo, ordenacao])

  const linhas = useMemo(() => {
    const termo = busca.trim()
    const achatado = achatarArvore(arvoreOrdenada, expandidos)

    return achatado.filter((linha) => {
      const matchBusca =
        !termo || textosContemTodosTermos([linha.codigo, linha.nome], termo)
      const matchSituacao =
        filtroSituacao === 'todos' ||
        (filtroSituacao === 'ativos' && linha.ativo) ||
        (filtroSituacao === 'inativos' && !linha.ativo)
      return matchBusca && matchSituacao
    })
  }, [arvoreOrdenada, expandidos, busca, filtroSituacao])

  const linhaPorId = useMemo(() => new Map(linhas.map((l) => [l.id, l])), [linhas])

  const preview = useMemo(
    () => calcularPreviewInsercao(linhas, arrastandoId, dicaDrop),
    [linhas, arrastandoId, dicaDrop]
  )

  const itensRender = useMemo(
    () => montarLinhasComPreview(linhas, arrastandoId, preview),
    [linhas, arrastandoId, preview]
  )

  function alternarExpansao(id: string) {
    setExpandidos((prev) => {
      const prox = new Set(prev)
      if (prox.has(id)) prox.delete(id)
      else prox.add(id)
      return prox
    })
  }

  function aoDragStart(evento: DragStartEvent) {
    setArrastandoId(String(evento.active.id))
    atualizarLarguraTabela()
  }

  function aoDragOver(evento: DragOverEvent) {
    const overId = evento.over?.id
    if (!overId || typeof overId !== 'string' || !overId.startsWith('drop-')) {
      setDicaDrop(null)
      return
    }

    const alvoId = overId.replace('drop-', '')
    if (alvoId === evento.active.id) {
      setDicaDrop(null)
      return
    }

    const alvo = linhaPorId.get(alvoId)
    const arrastando = linhaPorId.get(String(evento.active.id))
    if (!alvo || !arrastando) {
      setDicaDrop(null)
      return
    }

    const resolvido = resolverDropPlano(calcularPosicaoDrop(evento), alvo, arrastando)
    if (!resolvido) {
      setDicaDrop(null)
      return
    }

    setDicaDrop(resolvido)

    if (resolvido.posicao === 'dentro') {
      setExpandidos((prev) => {
        if (prev.has(resolvido.alvoId)) return prev
        const prox = new Set(prev)
        prox.add(resolvido.alvoId)
        return prox
      })
    }
  }

  async function aoDragEnd(evento: DragEndEvent) {
    const planoId = String(evento.active.id)
    setArrastandoId(null)
    setDicaDrop(null)

    const overId = evento.over?.id
    if (!overId || typeof overId !== 'string' || !overId.startsWith('drop-') || !aoMover) return

    const alvoId = overId.replace('drop-', '')
    if (alvoId === planoId) return

    const alvo = linhaPorId.get(alvoId)
    const arrastando = linhaPorId.get(planoId)
    if (!alvo || !arrastando) return

    const resolvido = resolverDropPlano(calcularPosicaoDrop(evento), alvo, arrastando)
    if (!resolvido) return

    await aoMover(planoId, resolvido.alvoId, resolvido.posicao)

    if (resolvido.posicao === 'dentro') {
      setExpandidos((prev) => new Set(prev).add(resolvido.alvoId))
    }
  }

  function aoDragCancel() {
    setArrastandoId(null)
    setDicaDrop(null)
  }

  const propsLinha: Omit<LinhaProps, 'linha'> = {
    expandidos,
    arrastarHabilitado,
    movendoId,
    dicaDrop,
    arrastandoId,
    podeEditar,
    podeDesativar,
    podeCriar,
    aoEditar,
    aoAlternarAtivo,
    aoAviso,
    aoAdicionarSubgrupo,
    aoAlternarExpansao: alternarExpansao,
  }

  if (linhas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum plano financeiro encontrado.
        </p>
      </div>
    )
  }

  const colunas = arrastarHabilitado ? (
    <>
      <col className="w-[4%]" />
      <col className="w-[26%]" />
      <col className="w-[6%]" />
      <col className="w-[10%]" />
      <col className="w-[10%]" />
      <col className="w-[16%]" />
      <col className="w-[16%]" />
      <col className="w-[12%]" />
    </>
  ) : (
    <>
      <col className="w-[30%]" />
      <col className="w-[6%]" />
      <col className="w-[10%]" />
      <col className="w-[10%]" />
      <col className="w-[16%]" />
      <col className="w-[16%]" />
      <col className="w-[12%]" />
    </>
  )

  const linhaArrastada = arrastandoId ? linhaPorId.get(arrastandoId) : undefined

  const previewDescricao =
    preview && linhaArrastada
      ? descricaoPreviewDrop(preview, linhaArrastada, linhas)
      : null

  const previewMeta =
    preview && linhaArrastada && previewDescricao
      ? {
          posicao: preview.posicao,
          linhaArrastada: { codigo: linhaArrastada.codigo, nome: linhaArrastada.nome },
          titulo: previewDescricao.titulo,
          detalhe: previewDescricao.detalhe,
        }
      : undefined

  const tabela = (
    <table ref={refTabela} className="w-full min-w-[1100px] table-fixed text-sm">
      <colgroup>{colunas}</colgroup>
      <thead>
        <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
          {arrastarHabilitado && <th className="px-1 py-3" />}
          <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Nome" coluna="nome" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
          {COLUNAS_FLAGS_PLANO.map((coluna) => (
            <CabecalhoColunaOrdenavel
              key={coluna.chave}
              className="px-2 py-3 text-xs"
              rotulo={coluna.rotulo}
              coluna={coluna.chave}
              ordenacao={ordenacao}
              onOrdenar={alternarOrdenacao}
              alinhamento="center"
              quebrarTexto
            />
          ))}
          <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Situação" coluna="situacao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
          <th className="px-2 py-3" />
        </tr>
      </thead>
      <tbody>
        {arrastarHabilitado
          ? itensRender.map((item, indice) =>
              renderizarItemLista(item, indice, propsLinha, previewMeta)
            )
          : linhas.map((linha) => (
              <LinhaPlanoFinanceiro key={linha.id} linha={linha} {...propsLinha} />
            ))}
      </tbody>
    </table>
  )

  if (!arrastarHabilitado) {
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-lg border border-border bg-card">{tabela}</div>
        {ordenacao && (
          <p className="text-xs text-muted-foreground">Ordenação visual apenas.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
    <DndContext
      sensors={sensores}
      modifiers={[restrictToVerticalAxis, restrictToArea]}
      autoScroll={{ threshold: { x: 0.1, y: 0.15 }, acceleration: 8 }}
      onDragStart={aoDragStart}
      onDragOver={aoDragOver}
      onDragEnd={aoDragEnd}
      onDragCancel={aoDragCancel}
    >
      <div
        ref={refAreaDrag}
        className="relative overflow-x-auto rounded-lg border border-border bg-card select-none"
      >
        {tabela}
      </div>
      <DragOverlay
        dropAnimation={{
          duration: 180,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1)',
        }}
      >
        {linhaArrastada && larguraTabela > 0 ? (
          <LinhaOverlayDrag
            linha={linhaArrastada}
            largura={larguraTabela}
            expandidos={expandidos}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
    {ordenacao && (
      <p className="text-xs text-muted-foreground">Ordenação visual apenas.</p>
    )}
    </div>
  )
}
