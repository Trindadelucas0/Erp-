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
import { ChevronDown, ChevronRight, GripVertical, MoreVertical } from 'lucide-react'
import { BadgeStatus } from '@/components/ui/badge-status'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { criarRestrictToContainer } from './modifier-restrict-container'
import { LinhaOverlayDrag } from './linha-overlay-drag'
import { LinhaPlaceholderDrag } from './linha-placeholder-drag'
import {
  calcularPosicaoDrop,
  calcularPreviewInsercao,
  descricaoPreviewDrop,
  montarLinhasComPreview,
  type DicaDrop,
  type ItemListaRender,
  type PosicaoMoverPlano,
} from './logica-preview-drag'
import {
  classesBadgeTipoNivel,
  classesLinhaPorNivel,
  classesNomePorNivel,
  rotuloTipoNivel,
} from './estilos-hierarquia-plano'

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

type LinhaPlana = PlanoFinanceiroNo & { nivel: number; temFilhos: boolean }

function achatarArvore(
  nos: PlanoFinanceiroNo[],
  expandidos: Set<string>,
  nivel = 0
): LinhaPlana[] {
  const linhas: LinhaPlana[] = []
  for (const no of nos) {
    const filhos = no.filhos ?? []
    const temFilhos = filhos.length > 0
    linhas.push({ ...no, nivel, temFilhos })
    if (temFilhos && expandidos.has(no.id)) {
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
  aoAdicionarSubgrupo?: (plano: PlanoFinanceiroNo) => void
  aoMover?: (planoId: string, alvoId: string, posicao: PosicaoMoverPlano) => Promise<void>
}

type LinhaProps = {
  linha: LinhaPlana
  expandidos: Set<string>
  menuAberto: string | null
  refMenu: React.RefObject<HTMLDivElement | null>
  arrastarHabilitado: boolean
  movendoId?: string | null
  dicaDrop: DicaDrop | null
  arrastandoId: string | null
  podeEditar: boolean
  podeDesativar: boolean
  podeCriar: boolean
  aoEditar: (plano: PlanoFinanceiroNo) => void
  aoAlternarAtivo: (plano: PlanoFinanceiroNo) => void
  aoAdicionarSubgrupo?: (plano: PlanoFinanceiroNo) => void
  aoAlternarExpansao: (id: string) => void
  aoAbrirMenu: (id: string | null) => void
}

function LinhaPlanoFinanceiro({
  linha,
  expandidos,
  menuAberto,
  refMenu,
  arrastarHabilitado,
  movendoId,
  dicaDrop,
  arrastandoId,
  podeEditar,
  podeDesativar,
  podeCriar,
  aoEditar,
  aoAlternarAtivo,
  aoAdicionarSubgrupo,
  aoAlternarExpansao,
  aoAbrirMenu,
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
  const rotuloTipo = rotuloTipoNivel(linha.nivel)

  if (arrastandoId === linha.id) {
    return (
      <tr ref={setDropRef} className="h-0 border-0 opacity-0">
        <td className="h-0 p-0">
          <button ref={setDragRef} type="button" className="sr-only" {...listeners} {...attributes} />
        </td>
        <td colSpan={5} className="h-0 p-0" />
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
            {rotuloTipo && (
              <span className={classesBadgeTipoNivel(linha.nivel)}>{rotuloTipo}</span>
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
      <td className="max-w-0 px-4 py-3 text-muted-foreground">
        <span className="block truncate" title={linha.classificacao ?? undefined}>
          {linha.classificacao || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{linha.mostrarNaDre ? 'Sim' : ''}</td>
      <td className="px-4 py-3">
        <BadgeStatus variante={linha.ativo ? 'ativo' : 'reprovado'}>
          {linha.ativo ? 'Habilitado' : 'Desabilitado'}
        </BadgeStatus>
      </td>
      <td className="relative overflow-visible px-2 py-3">
        {(podeEditar || podeDesativar || podeCriar) && (
          <div ref={menuAberto === linha.id ? refMenu : undefined} className="relative inline-block">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => aoAbrirMenu(menuAberto === linha.id ? null : linha.id)}
            >
              <MoreVertical className="size-4" />
            </Button>
            {menuAberto === linha.id && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-card py-1 shadow-lg">
                {podeCriar && aoAdicionarSubgrupo && (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      aoAbrirMenu(null)
                      aoAdicionarSubgrupo(linha)
                    }}
                  >
                    Adicionar subgrupo
                  </button>
                )}
                {podeEditar && (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      aoAbrirMenu(null)
                      aoEditar(linha)
                    }}
                  >
                    Editar
                  </button>
                )}
                {podeDesativar && (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      aoAbrirMenu(null)
                      aoAlternarAtivo(linha)
                    }}
                  >
                    {linha.ativo ? 'Desabilitar' : 'Habilitar'}
                  </button>
                )}
              </div>
            )}
          </div>
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
        colSpan={6}
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
  aoAdicionarSubgrupo,
  aoMover,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [dicaDrop, setDicaDrop] = useState<DicaDrop | null>(null)
  const [larguraTabela, setLarguraTabela] = useState(0)
  const refMenu = useRef<HTMLDivElement>(null)
  const refAreaDrag = useRef<HTMLDivElement>(null)
  const refTabela = useRef<HTMLTableElement>(null)

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
    if (!menuAberto) return

    function aoClicarFora(evento: MouseEvent) {
      if (refMenu.current && !refMenu.current.contains(evento.target as Node)) {
        setMenuAberto(null)
      }
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [menuAberto])

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

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const achatado = achatarArvore(arvore, expandidos)

    return achatado.filter((linha) => {
      const matchBusca =
        !termo ||
        linha.codigo.toLowerCase().includes(termo) ||
        linha.nome.toLowerCase().includes(termo)
      const matchSituacao =
        filtroSituacao === 'todos' ||
        (filtroSituacao === 'ativos' && linha.ativo) ||
        (filtroSituacao === 'inativos' && !linha.ativo)
      return matchBusca && matchSituacao
    })
  }, [arvore, expandidos, busca, filtroSituacao])

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

    const posicao = calcularPosicaoDrop(evento)

    setDicaDrop({ alvoId, posicao })

    if (posicao === 'dentro') {
      setExpandidos((prev) => {
        if (prev.has(alvoId)) return prev
        const prox = new Set(prev)
        prox.add(alvoId)
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

    const posicao = calcularPosicaoDrop(evento)
    await aoMover(planoId, alvoId, posicao)

    if (posicao === 'dentro') {
      setExpandidos((prev) => new Set(prev).add(alvoId))
    }
  }

  function aoDragCancel() {
    setArrastandoId(null)
    setDicaDrop(null)
  }

  const propsLinha: Omit<LinhaProps, 'linha'> = {
    expandidos,
    menuAberto,
    refMenu,
    arrastarHabilitado,
    movendoId,
    dicaDrop,
    arrastandoId,
    podeEditar,
    podeDesativar,
    podeCriar,
    aoEditar,
    aoAlternarAtivo,
    aoAdicionarSubgrupo,
    aoAlternarExpansao: alternarExpansao,
    aoAbrirMenu: setMenuAberto,
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
      <col className="w-[34%]" />
      <col className="w-[22%]" />
      <col className="w-[14%]" />
      <col className="w-[18%]" />
      <col className="w-[8%]" />
    </>
  ) : (
    <>
      <col className="w-[38%]" />
      <col className="w-[22%]" />
      <col className="w-[14%]" />
      <col className="w-[18%]" />
      <col className="w-[8%]" />
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
    <table ref={refTabela} className="w-full table-fixed text-sm">
      <colgroup>{colunas}</colgroup>
      <thead>
        <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
          {arrastarHabilitado && <th className="px-1 py-3" />}
          <th className="px-4 py-3 font-medium">Nome</th>
          <th className="px-4 py-3 font-medium">Classificação</th>
          <th className="px-4 py-3 font-medium">Mostrar no DRE</th>
          <th className="px-4 py-3 font-medium">Situação</th>
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
      <div className="overflow-visible rounded-lg border border-border bg-card">{tabela}</div>
    )
  }

  return (
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
        className="relative overflow-hidden rounded-lg border border-border bg-card select-none"
      >
        {arrastandoId && dicaDrop && previewDescricao && (
          <div className="border-b border-primary/30 bg-primary/5 px-4 py-2 text-sm">
            <span className="font-semibold">{previewDescricao.titulo}</span>
            <span className="text-muted-foreground"> — {previewDescricao.detalhe}</span>
          </div>
        )}
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
  )
}
