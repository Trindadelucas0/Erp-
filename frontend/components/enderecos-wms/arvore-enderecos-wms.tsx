'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Power } from 'lucide-react'
import { MenuAcoesLinha } from '@/components/compartilhado/menu-acoes-linha'
import { BadgeStatus } from '@/components/ui/badge-status'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { cn } from '@/lib/utils'
import {
  FILHO_NIVEL,
  ROTULO_NOVO_FILHO,
  achatarArvoreWms,
  type ItemEstruturaWms,
  type NivelEstruturaWms,
} from '@/lib/estrutura-wms'

export type ApartamentoWms = {
  id: string
  andarId: string
  codigo: string
  codigoCompleto: string
  tipoEndereco: string
  status: string
  ativo: boolean
}

export type PosicaoMoverWms = 'antes' | 'depois' | 'dentro'

type Linha =
  | { tipo: 'no'; no: ItemEstruturaWms; profundidade: number; temFilhos: boolean }
  | { tipo: 'ap'; ap: ApartamentoWms; profundidade: number }

type Props = {
  arvore: ItemEstruturaWms[]
  apartamentosPorAndar: Record<string, ApartamentoWms[]>
  busca: string
  filtroStatus: 'todos' | 'ativo' | 'bloqueado' | 'inativo'
  podeEditar: boolean
  podeCriar: boolean
  expandidos: Set<string>
  aoAlternarExpansao: (id: string) => void
  aoEditarNo: (no: ItemEstruturaWms) => void
  aoEditarAp: (ap: ApartamentoWms) => void
  aoNovoFilho: (no: ItemEstruturaWms) => void
  aoStatusNo: (no: ItemEstruturaWms, status: string) => void
  aoStatusAp: (ap: ApartamentoWms, status: string) => void
  aoMoverNo?: (id: string, alvoId: string, posicao: PosicaoMoverWms) => void
  aoMoverAp?: (id: string, alvoId: string, posicao: 'antes' | 'depois') => void
}

function varianteStatus(status: string, ativo: boolean) {
  if (status === 'bloqueado') return 'pendente' as const
  if (status === 'inativo' || !ativo) return 'inativo' as const
  return 'ativo' as const
}

function rotuloStatus(status: string, ativo: boolean) {
  if (status === 'bloqueado') return 'Bloqueado'
  if (status === 'inativo' || !ativo) return 'Inativo'
  return 'Ativo'
}

function LinhaNo({
  no,
  profundidade,
  temFilhos,
  expandido,
  arrastar,
  podeEditar,
  podeCriar,
  aoExpandir,
  aoEditar,
  aoNovoFilho,
  aoStatus,
}: {
  no: ItemEstruturaWms
  profundidade: number
  temFilhos: boolean
  expandido: boolean
  arrastar: boolean
  podeEditar: boolean
  podeCriar: boolean
  aoExpandir: () => void
  aoEditar: () => void
  aoNovoFilho: () => void
  aoStatus: (status: string) => void
}) {
  const { attributes, listeners, setNodeRef: setDrag } = useDraggable({
    id: `no-${no.id}`,
    disabled: !arrastar,
  })
  const { setNodeRef: setDrop, isOver } = useDroppable({ id: `no-${no.id}` })
  const filho = FILHO_NIVEL[no.nivel as NivelEstruturaWms]
  const status = no.status ?? (no.ativo ? 'ativo' : 'inativo')

  return (
    <tr ref={setDrop} className={cn('border-b border-border/60', isOver && 'bg-primary/10')}>
      <td className="hidden px-1 py-2 sm:table-cell">
        {arrastar && (
          <button
            ref={setDrag}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-grab"
            title="Arrastar"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </td>
      <td className="max-w-0 px-4 py-2">
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: `${profundidade * 16}px` }}>
          {temFilhos ? (
            <button type="button" className="shrink-0 rounded p-0.5 hover:bg-muted" onClick={aoExpandir}>
              {expandido ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="inline-block w-5" />
          )}
          <span className="truncate font-medium" title={`${no.codigo} — ${no.nome}`}>
            {no.codigo}
            {no.nome && no.nome !== no.codigo ? ` — ${no.nome}` : ''}
            {typeof no.qtdApartamentos === 'number' && no.qtdApartamentos > 0 ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({no.qtdApartamentos} AP)
              </span>
            ) : null}
          </span>
        </div>
      </td>
      <td className="px-2 py-2 text-muted-foreground">—</td>
      <td className="px-2 py-2">
        <BadgeStatus variante={varianteStatus(status, no.ativo)}>{rotuloStatus(status, no.ativo)}</BadgeStatus>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center justify-end gap-1">
          {podeCriar && filho ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title={ROTULO_NOVO_FILHO[no.nivel] ?? 'Novo'}
              onClick={aoNovoFilho}
            >
              <Plus className="size-4" />
            </button>
          ) : null}
          <MenuAcoesLinha
            ariaLabel={`Ações de ${no.codigo}`}
            itens={[
              { rotulo: 'Editar', icone: Pencil, onClick: aoEditar, oculto: !podeEditar },
              {
                rotulo: status === 'inativo' ? 'Ativar' : 'Inativar',
                icone: Power,
                onClick: () => aoStatus(status === 'inativo' ? 'ativo' : 'inativo'),
                oculto: !podeEditar,
              },
            ]}
          />
        </div>
      </td>
    </tr>
  )
}

function LinhaAp({
  ap,
  profundidade,
  arrastar,
  podeEditar,
  aoEditar,
  aoStatus,
}: {
  ap: ApartamentoWms
  profundidade: number
  arrastar: boolean
  podeEditar: boolean
  aoEditar: () => void
  aoStatus: (status: string) => void
}) {
  const { attributes, listeners, setNodeRef: setDrag } = useDraggable({
    id: `ap-${ap.id}`,
    disabled: !arrastar,
  })
  const { setNodeRef: setDrop, isOver } = useDroppable({ id: `ap-${ap.id}` })
  return (
    <tr ref={setDrop} className={cn('border-b border-border/60', isOver && 'bg-primary/10')}>
      <td className="hidden px-1 py-2 sm:table-cell">
        {arrastar && (
          <button
            ref={setDrag}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-grab"
            title="Arrastar"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </td>
      <td className="max-w-0 px-4 py-2">
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: `${profundidade * 16 + 20}px` }}>
          <span className="truncate font-mono" title={ap.codigoCompleto}>
            {ap.codigo}
            <span className="ml-2 text-xs text-muted-foreground">{ap.codigoCompleto}</span>
          </span>
        </div>
      </td>
      <td className="px-2 py-2 font-mono text-xs">{ap.tipoEndereco}</td>
      <td className="px-2 py-2">
        <BadgeStatus variante={varianteStatus(ap.status, ap.ativo)}>
          {rotuloStatus(ap.status, ap.ativo)}
        </BadgeStatus>
      </td>
      <td className="px-2 py-2">
        <MenuAcoesLinha
          ariaLabel={`Ações do apartamento ${ap.codigo}`}
          itens={[
            { rotulo: 'Editar', icone: Pencil, onClick: aoEditar, oculto: !podeEditar },
            {
              rotulo: ap.status === 'inativo' ? 'Ativar' : 'Inativar',
              icone: Power,
              onClick: () => aoStatus(ap.status === 'inativo' ? 'ativo' : 'inativo'),
              oculto: !podeEditar,
            },
          ]}
        />
      </td>
    </tr>
  )
}

export function ArvoreEnderecosWms(props: Props) {
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<'nome' | 'situacao'>()
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [arrastando, setArrastando] = useState<string | null>(null)

  const linhas: Linha[] = useMemo(() => {
    const achatado = achatarArvoreWms(props.arvore, props.expandidos)
    const saida: Linha[] = []
    for (const no of achatado) {
      const status = no.status ?? (no.ativo ? 'ativo' : 'inativo')
      const matchStatus =
        props.filtroStatus === 'todos' ||
        props.filtroStatus === status ||
        (props.filtroStatus === 'ativo' && no.ativo && status === 'ativo')
      const matchBusca =
        !props.busca.trim() ||
        textosContemTodosTermos([no.codigo, no.nome, ...(no.filhos ?? []).map((f) => f.codigo)], props.busca)
      if (matchStatus && matchBusca) {
        saida.push({ tipo: 'no', no, profundidade: no.profundidade, temFilhos: no.temFilhos })
      }
      if (no.nivel === 'andar' && props.expandidos.has(no.id)) {
        const aps = props.apartamentosPorAndar[no.id] ?? []
        for (const ap of aps) {
          const st = ap.status ?? (ap.ativo ? 'ativo' : 'inativo')
          const okSt = props.filtroStatus === 'todos' || props.filtroStatus === st
          const okQ =
            !props.busca.trim() ||
            textosContemTodosTermos([ap.codigo, ap.codigoCompleto, ap.tipoEndereco], props.busca)
          if (okSt && okQ) {
            saida.push({ tipo: 'ap', ap, profundidade: no.profundidade + 1 })
          }
        }
      }
    }
    if (ordenacao?.coluna === 'situacao') {
      const fator = ordenacao.direcao === 'desc' ? -1 : 1
      saida.sort((a, b) => {
        const sa = a.tipo === 'no' ? a.no.status ?? '' : a.ap.status
        const sb = b.tipo === 'no' ? b.no.status ?? '' : b.ap.status
        return sa.localeCompare(sb) * fator
      })
    }
    return saida
  }, [props.arvore, props.expandidos, props.apartamentosPorAndar, props.busca, props.filtroStatus, ordenacao])

  const arrastar = Boolean(props.podeEditar && (props.aoMoverNo || props.aoMoverAp) && !props.busca.trim())

  function aoDragEnd(evento: DragEndEvent) {
    setArrastando(null)
    const active = String(evento.active.id)
    const over = evento.over ? String(evento.over.id) : ''
    if (!over || active === over) return
    const [tipoA, idA] = active.split('-')
    const [tipoB, idB] = over.split('-')
    if (!idA || !idB) return
    if (tipoA === 'ap' && tipoB === 'ap' && props.aoMoverAp) {
      props.aoMoverAp(idA, idB, 'depois')
      return
    }
    if (tipoA === 'no' && tipoB === 'no' && props.aoMoverNo) {
      const origem = linhas.find((l) => l.tipo === 'no' && l.no.id === idA)
      const destino = linhas.find((l) => l.tipo === 'no' && l.no.id === idB)
      if (!origem || origem.tipo !== 'no' || !destino || destino.tipo !== 'no') return
      const filhoLegal = FILHO_NIVEL[destino.no.nivel as NivelEstruturaWms]
      if (filhoLegal && filhoLegal === origem.no.nivel) {
        props.aoMoverNo(idA, idB, 'dentro')
        return
      }
      props.aoMoverNo(idA, idB, 'depois')
    }
  }

  return (
    <DndContext
      sensors={sensores}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={(e) => setArrastando(String(e.active.id))}
      onDragEnd={aoDragEnd}
      onDragCancel={() => setArrastando(null)}
    >
      <div className={cn('overflow-x-auto', arrastando && 'select-none')}>
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="hidden w-10 sm:table-cell" />
              <CabecalhoColunaOrdenavel
                coluna="nome"
                rotulo="Nome"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <th className="px-2 py-2 font-medium">Tipo</th>
              <CabecalhoColunaOrdenavel
                coluna="situacao"
                rotulo="Situação"
                ordenacao={ordenacao}
                onOrdenar={alternarOrdenacao}
              />
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum endereço. Use Cadastrar endereços (local até o apartamento) ou Novo local.
                </td>
              </tr>
            ) : (
              linhas.map((linha) =>
                linha.tipo === 'no' ? (
                  <LinhaNo
                    key={linha.no.id}
                    no={linha.no}
                    profundidade={linha.profundidade}
                    temFilhos={linha.temFilhos}
                    expandido={props.expandidos.has(linha.no.id)}
                    arrastar={arrastar}
                    podeEditar={props.podeEditar}
                    podeCriar={props.podeCriar}
                    aoExpandir={() => props.aoAlternarExpansao(linha.no.id)}
                    aoEditar={() => props.aoEditarNo(linha.no)}
                    aoNovoFilho={() => props.aoNovoFilho(linha.no)}
                    aoStatus={(s) => props.aoStatusNo(linha.no, s)}
                  />
                ) : (
                  <LinhaAp
                    key={linha.ap.id}
                    ap={linha.ap}
                    profundidade={linha.profundidade}
                    arrastar={arrastar}
                    podeEditar={props.podeEditar}
                    aoEditar={() => props.aoEditarAp(linha.ap)}
                    aoStatus={(s) => props.aoStatusAp(linha.ap, s)}
                  />
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </DndContext>
  )
}
