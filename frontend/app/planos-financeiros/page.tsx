'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, DollarSign, Filter, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Abas } from '@/components/ui/abas'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import {
  ArvorePlanosFinanceiros,
  type PlanoFinanceiroNo,
  type PosicaoMoverPlano,
} from '@/components/planos-financeiros/arvore-planos-financeiros'
import {
  ModalPlanoFinanceiro,
  type TipoPlanoAba,
} from '@/components/planos-financeiros/modal-plano-financeiro'
import { achatarPlanosComNivel } from '@/components/planos-financeiros/util-arvore-planos'
import { useFecharAoSairComMouse } from '@/lib/dropdown-catalogo'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'

type AbaId = 'receitas' | 'despesas' | 'resultado'

const TITULO_POR_ABA: Record<AbaId, string> = {
  receitas: 'Receitas',
  despesas: 'Despesas',
  resultado: 'Resultado',
}

const TIPO_POR_ABA: Record<AbaId, TipoPlanoAba> = {
  receitas: 'receita',
  despesas: 'despesa',
  resultado: 'resultado',
}

function ConteudoDaPagina() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [abaAtiva, setAbaAtiva] = useState<AbaId>('receitas')
  const [arvoreReceitas, setArvoreReceitas] = useState<PlanoFinanceiroNo[]>([])
  const [arvoreDespesas, setArvoreDespesas] = useState<PlanoFinanceiroNo[]>([])
  const [arvoreResultado, setArvoreResultado] = useState<PlanoFinanceiroNo[]>([])
  const [busca, setBusca] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const refFiltros = useRef<HTMLDivElement>(null)
  const zonaHoverFiltros = useFecharAoSairComMouse(() => setFiltrosAbertos(false))
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [planoEmEdicao, setPlanoEmEdicao] = useState<PlanoFinanceiroNo | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [movendoId, setMovendoId] = useState<string | null>(null)
  const [paiPreSelecionadoId, setPaiPreSelecionadoId] = useState<string | null>(null)
  const [idsParaExpandir, setIdsParaExpandir] = useState<string[]>([])

  const tipoAtual = TIPO_POR_ABA[abaAtiva]
  const arvoreAtual =
    abaAtiva === 'despesas'
      ? arvoreDespesas
      : abaAtiva === 'resultado'
        ? arvoreResultado
        : arvoreReceitas

  const carregarPlanos = useCallback(async () => {
    try {
      const [resReceitas, resDespesas, resResultado] = await Promise.all([
        clienteHttp.get('/planos-financeiros?incluirInativos=true&tipo=receita'),
        clienteHttp.get('/planos-financeiros?incluirInativos=true&tipo=despesa'),
        clienteHttp.get('/planos-financeiros?incluirInativos=true&tipo=resultado'),
      ])
      setArvoreReceitas(resReceitas.data.arvore ?? [])
      setArvoreDespesas(resDespesas.data.arvore ?? [])
      setArvoreResultado(resResultado.data.arvore ?? [])
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { mensagem?: string } } })?.response?.data?.mensagem ||
        'Erro ao carregar planos financeiros.'
      setErro(msg)
    }
  }, [])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarPlanos()
  }, [carregandoSessao, estaAutenticado, carregarPlanos])

  useEffect(() => {
    if (!filtrosAbertos) return

    function aoClicarFora(evento: MouseEvent) {
      if (refFiltros.current && !refFiltros.current.contains(evento.target as Node)) {
        setFiltrosAbertos(false)
      }
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [filtrosAbertos])

  const planosAchatados = useMemo(() => achatarPlanosComNivel(arvoreAtual), [arvoreAtual])

  const planosParaPai = useMemo(
    () => planosAchatados.filter((p) => p.nivel === 0),
    [planosAchatados]
  )

  const planosParaValidacao = useMemo(
    () => planosAchatados.map((p) => ({ codigo: p.codigo, nome: p.nome })),
    [planosAchatados]
  )

  function abrirNovo() {
    setModoEdicao(false)
    setPlanoEmEdicao(null)
    setPaiPreSelecionadoId(null)
    setModalAberto(true)
  }

  function abrirSubgrupo(plano: PlanoFinanceiroNo) {
    setModoEdicao(false)
    setPlanoEmEdicao(null)
    setPaiPreSelecionadoId(plano.id)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setPaiPreSelecionadoId(null)
  }

  function abrirEdicao(plano: PlanoFinanceiroNo) {
    setModoEdicao(true)
    setPlanoEmEdicao(plano)
    setModalAberto(true)
  }

  async function alternarAtivo(plano: PlanoFinanceiroNo) {
    setErro('')
    setMensagem('')
    try {
      await clienteHttp.patch(`/planos-financeiros/${plano.id}/ativo`, {
        ativo: !plano.ativo,
      })
      setMensagem(plano.ativo ? 'Plano desabilitado.' : 'Plano habilitado.')
      await carregarPlanos()
    } catch (e: unknown) {
      setErro(extrairMensagemApi(e, 'Erro ao alterar situação'))
    }
  }

  async function moverPlano(planoId: string, alvoId: string, posicao: PosicaoMoverPlano) {
    setErro('')
    setMensagem('')
    setMovendoId(planoId)
    try {
      await clienteHttp.patch(`/planos-financeiros/${planoId}/mover`, {
        alvoId,
        posicao,
      })
      setMensagem('Plano movido com sucesso.')
      await carregarPlanos()
    } catch (e: unknown) {
      setErro(extrairMensagemApi(e, 'Erro ao mover plano'))
    } finally {
      setMovendoId(null)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <DollarSign className="size-3.5 shrink-0" />
          Financeiro &gt; Planos Financeiros
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Planos Financeiros</h1>
      </div>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <Abas
        abas={[
          { id: 'receitas', rotulo: 'Receitas' },
          { id: 'despesas', rotulo: 'Despesas' },
          { id: 'resultado', rotulo: 'Resultado' },
        ]}
        abaAtiva={abaAtiva}
        aoMudar={(id) => setAbaAtiva(id as AbaId)}
      />

      <CardPadrao
        titulo={TITULO_POR_ABA[abaAtiva]}
        descricao="Estrutura hierárquica de contas com flags visíveis no grid."
        permitirOverflow
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={refFiltros} {...zonaHoverFiltros}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFiltrosAbertos((v) => !v)}
              >
                <Filter className="mr-1 size-4" />
                Filtros
                <ChevronDown className="ml-1 size-4" />
              </Button>
              {filtrosAbertos && (
                <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-card p-3 shadow-lg">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Buscar</p>
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Código ou nome..."
                  />
                  <Separator className="my-3" />
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Situação</p>
                  <div className="space-y-0.5">
                    {(['todos', 'ativos', 'inativos'] as const).map((op) => (
                      <button
                        key={op}
                        type="button"
                        className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                          filtroSituacao === op ? 'bg-muted font-medium' : ''
                        }`}
                        onClick={() => setFiltroSituacao(op)}
                      >
                        {op === 'todos' ? 'Todos' : op === 'ativos' ? 'Habilitados' : 'Desabilitados'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {podeCriar && (
              <BotaoPrimario type="button" onClick={abrirNovo}>
                <Plus className="mr-1 size-4 inline" />
                Adicionar plano
              </BotaoPrimario>
            )}
          </div>
        }
      >
        <ArvorePlanosFinanceiros
          arvore={arvoreAtual}
          busca={busca}
          filtroSituacao={filtroSituacao}
          podeEditar={podeEditar}
          podeDesativar={podeEditar}
          podeCriar={podeCriar}
          movendoId={movendoId}
          idsParaExpandir={idsParaExpandir}
          aoEditar={abrirEdicao}
          aoAlternarAtivo={alternarAtivo}
          aoAviso={(mensagem) => {
            setMensagem('')
            setErro(mensagem)
          }}
          aoAdicionarSubgrupo={podeCriar ? abrirSubgrupo : undefined}
          aoMover={podeEditar ? moverPlano : undefined}
        />
      </CardPadrao>

      <ModalPlanoFinanceiro
        aberto={modalAberto}
        tipo={tipoAtual}
        modoEdicao={modoEdicao}
        planoEmEdicao={planoEmEdicao}
        planosDisponiveis={planosParaPai}
        planosParaValidacao={planosParaValidacao}
        paiPreSelecionadoId={paiPreSelecionadoId}
        aoFechar={fecharModal}
        aoSalvo={async (parentIdCriado) => {
          setMensagem(modoEdicao ? 'Plano atualizado.' : 'Plano criado.')
          if (parentIdCriado) {
            setIdsParaExpandir([parentIdCriado])
          }
          await carregarPlanos()
        }}
      />
    </div>
  )
}

export default function PaginaPlanosFinanceiros() {
  return (
    <ProtegerRota chaveDaPagina="planos-financeiros">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
