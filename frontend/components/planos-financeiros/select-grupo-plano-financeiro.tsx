'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { classesSelect } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { PlanoComNivel } from './util-arvore-planos'

type Props = {
  rotulo: string
  valor: string
  aoMudar: (id: string) => void
  planos: PlanoComNivel[]
  disabled?: boolean
  textoAjuda?: string
}

const TEXTO_AJUDA_PADRAO =
  'Escolha o grupo pai. O código da nova conta é gerado automaticamente.'

function textoTrigger(valor: string, planos: PlanoComNivel[]): string {
  if (!valor) return 'Nenhum — grupo de 1º nível'
  const plano = planos.find((p) => p.id === valor)
  return plano ? `${plano.codigo} - ${plano.nome}` : 'Selecione o grupo pai'
}

type PosicaoDropdown = {
  top: number
  left: number
  width: number
}

export function SelectGrupoPlanoFinanceiro({
  rotulo,
  valor,
  aoMudar,
  planos,
  disabled,
  textoAjuda = TEXTO_AJUDA_PADRAO,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<PosicaoDropdown | null>(null)
  const [montado, setMontado] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const idCampo = useId()

  useEffect(() => {
    setMontado(true)
  }, [])

  const atualizarPosicao = useCallback(() => {
    const botao = botaoRef.current
    if (!botao) return

    const rect = botao.getBoundingClientRect()
    setPosicao({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!aberto) return

    atualizarPosicao()

    function aoScrollOuResize() {
      atualizarPosicao()
    }

    window.addEventListener('scroll', aoScrollOuResize, true)
    window.addEventListener('resize', aoScrollOuResize)
    return () => {
      window.removeEventListener('scroll', aoScrollOuResize, true)
      window.removeEventListener('resize', aoScrollOuResize)
    }
  }, [aberto, atualizarPosicao])

  useEffect(() => {
    if (!aberto) return

    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node
      if (
        containerRef.current?.contains(alvo) ||
        listaRef.current?.contains(alvo)
      ) {
        return
      }
      setAberto(false)
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function selecionar(id: string) {
    aoMudar(id)
    setAberto(false)
  }

  function alternarAberto() {
    if (disabled) return
    setAberto((v) => !v)
  }

  const listaDropdown = aberto && posicao && montado && (
    <div
      ref={listaRef}
      role="listbox"
      className="fixed z-[60] max-h-60 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
      style={{
        top: posicao.top,
        left: posicao.left,
        width: posicao.width,
      }}
    >
      <button
        type="button"
        role="option"
        aria-selected={valor === ''}
        className={cn(
          'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/60',
          valor === '' && 'bg-muted'
        )}
        onClick={() => selecionar('')}
      >
        <span className="font-medium">Nenhum — grupo de 1º nível</span>
        <span className="text-xs text-muted-foreground">Cria na raiz da aba (ex: 1.4, 2.3)</span>
      </button>

      {planos.map((plano) => (
        <button
          key={plano.id}
          type="button"
          role="option"
          aria-selected={valor === plano.id}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60',
            valor === plano.id && 'bg-muted'
          )}
          style={{ paddingLeft: `${12 + plano.nivel * 20}px` }}
          onClick={() => selecionar(plano.id)}
          title={`${plano.codigo} - ${plano.nome}`}
        >
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              plano.nivel === 0
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {plano.nivel === 0 ? 'Grupo' : 'Subgrupo'}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span
              className={cn(
                'text-muted-foreground',
                plano.nivel === 0 && 'font-semibold text-foreground'
              )}
            >
              {plano.codigo}
            </span>
            <span className={cn(plano.nivel === 0 ? 'font-semibold' : '')}> — {plano.nome}</span>
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor={idCampo}>{rotulo}</Label>
      <div className="relative">
        <button
          id={idCampo}
          ref={botaoRef}
          type="button"
          disabled={disabled}
          aria-expanded={aberto}
          aria-haspopup="listbox"
          onClick={alternarAberto}
          className={cn(
            classesSelect,
            'flex w-full items-center justify-between text-left',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <span className="truncate">{textoTrigger(valor, planos)}</span>
          <ChevronDown
            className={cn(
              'ml-2 size-4 shrink-0 text-muted-foreground transition-transform',
              aberto && 'rotate-180'
            )}
          />
        </button>
      </div>

      {montado && listaDropdown ? createPortal(listaDropdown, document.body) : null}

      <p className="text-xs text-muted-foreground">{textoAjuda}</p>
    </div>
  )
}
