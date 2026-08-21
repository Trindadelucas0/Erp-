'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Package, RefreshCw } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { ModalCiencia } from '@/components/compartilhado/modal-ciencia'
import { usePermissao } from '@/hooks/use-permissao'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Label } from '@/components/ui/label'
import {
  formatarQtdEstoque,
  hojeIso,
  inicioDoMesIso,
  ROTULO_TIPO_ESTOQUE,
  tipoEstoqueVisaoValido,
  type BloqueioAtivoKardex,
  type RespostaKardex,
  type TipoEstoqueVisao,
} from '@/lib/estoque'
import {
  BuscaProdutoEstoque,
  type ProdutoBuscaEstoque,
} from '@/components/estoque/busca-produto-estoque'
import { CardsSaldosEstoque } from '@/components/estoque/cards-saldos-estoque'
import { GradeKardex } from '@/components/estoque/grade-kardex'
import { PainelProdutoKardex } from '@/components/estoque/painel-produto-kardex'
import { ResumoPorTipoKardex } from '@/components/estoque/resumo-por-tipo-kardex'
import { ModalAjusteInventario } from '@/components/estoque/modal-ajuste-inventario'
import { cn } from '@/lib/utils'

const TIPOS: { valor: TipoEstoqueVisao; rotulo: string }[] = [
  { valor: 'disponivel', rotulo: 'Disponível' },
  { valor: 'fisico', rotulo: 'Físico' },
  { valor: 'fiscal', rotulo: 'Fiscal' },
]

export function TelaKardexEstoque() {
  const searchParams = useSearchParams()
  const { perfil } = useSessaoDoUsuario()
  const podeAjustar = usePermissao('estoque:edit')

  const nomeEmpresa = useMemo(() => {
    if (!perfil) return 'Empresa ativa'
    const id = localStorage.getItem('empresaAtivaId')
    return (
      perfil.empresas.find((e) => e.company.id === id)?.company.name ??
      perfil.empresas[0]?.company.name ??
      'Empresa ativa'
    )
  }, [perfil])

  const tipoQuery = searchParams.get('tipoEstoque')
  const produtoIdQuery = searchParams.get('produtoId')

  const [de, setDe] = useState(inicioDoMesIso)
  const [ate, setAte] = useState(hojeIso)
  const [tipoEstoque, setTipoEstoque] = useState<TipoEstoqueVisao>(() =>
    tipoEstoqueVisaoValido(tipoQuery) ? tipoQuery : 'fisico'
  )
  const [produto, setProduto] = useState<ProdutoBuscaEstoque | null>(null)
  const [kardex, setKardex] = useState<RespostaKardex | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modalInventario, setModalInventario] = useState(false)
  const [hidratandoDeepLink, setHidratandoDeepLink] = useState(Boolean(produtoIdQuery?.trim()))
  const [modalBloqueio, setModalBloqueio] = useState<{
    aberto: boolean
    bloqueio: BloqueioAtivoKardex | null
  }>({ aberto: false, bloqueio: null })
  const ultimoProdutoAvisoBloqueio = useRef<string | null>(null)

  function tentarAvisarBloqueio(produtoId: string, bloqueio: BloqueioAtivoKardex | null | undefined) {
    if (!bloqueio || bloqueio.qtdBloqueada <= 0) return
    if (ultimoProdutoAvisoBloqueio.current === produtoId) return
    ultimoProdutoAvisoBloqueio.current = produtoId
    setModalBloqueio({ aberto: true, bloqueio })
  }

  useEffect(() => {
    if (tipoEstoqueVisaoValido(tipoQuery)) {
      setTipoEstoque(tipoQuery)
    }
  }, [tipoQuery])

  useEffect(() => {
    const id = produtoIdQuery?.trim()
    if (!id) {
      setHidratandoDeepLink(false)
      return
    }
    let cancelado = false
    setHidratandoDeepLink(true)
    void (async () => {
      try {
        const { data } = await clienteHttp.get<{
          produto: {
            id: string
            sku: string | null
            nomeVenda: string
            unidade: string
          }
          bloqueioAtivo?: BloqueioAtivoKardex | null
        }>(`/estoque/${id}/saldos`)
        if (cancelado) return
        setProduto({
          id: data.produto.id,
          sku: data.produto.sku,
          nomeVenda: data.produto.nomeVenda,
          unidade: data.produto.unidade,
        })
        tentarAvisarBloqueio(data.produto.id, data.bloqueioAtivo)
      } catch (e) {
        if (!cancelado) {
          setErro(extrairMensagemApi(e, 'Não foi possível abrir o produto da URL'))
        }
      } finally {
        if (!cancelado) setHidratandoDeepLink(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [produtoIdQuery])

  const carregar = useCallback(async () => {
    if (!produto) {
      setKardex(null)
      return
    }
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<RespostaKardex>('/estoque/kardex', {
        params: {
          produtoId: produto.id,
          de,
          ate,
          tipoEstoque,
        },
      })
      setKardex(data)
      tentarAvisarBloqueio(produto.id, data.bloqueioAtivo)
    } catch (e) {
      setKardex(null)
      setErro(extrairMensagemApi(e, 'Não foi possível carregar o kardex'))
    } finally {
      setCarregando(false)
    }
  }, [produto, de, ate, tipoEstoque])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const produtoRotulo = produto?.nomeVenda ?? ''

  const unidade =
    kardex?.produto.unidade ?? produto?.unidade ?? 'Unidades'

  const bloqueio = modalBloqueio.bloqueio

  return (
    <div className="space-y-4">
      <CardPadrao
        titulo="Kardex de Estoque"
        descricao="Extrato de movimentos por produto e tipo de estoque"
        permitirOverflow
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void carregar()}
              disabled={!produto || carregando}
            >
              <RefreshCw className={cn('mr-1.5 size-3.5', carregando && 'animate-spin')} />
              Atualizar
            </Button>
            {podeAjustar && (
              <BotaoPrimario
                type="button"
                size="sm"
                disabled={!produto}
                onClick={() => {
                  setMensagem('')
                  setModalInventario(true)
                }}
              >
                Ajuste de inventário
              </BotaoPrimario>
            )}
          </div>
        }
      >
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="size-4 text-primary" />
          <span>
            Empresa: <span className="font-medium text-foreground">{nomeEmpresa}</span>
            <span className="ml-1 text-xs">(seletor do ERP)</span>
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <InputPadrao
            rotulo="Período — De"
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
          />
          <InputPadrao
            rotulo="Até"
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
          <div className="md:col-span-2">
            <BuscaProdutoEstoque
              valor={produto}
              aoSelecionar={(p) => {
                if (!p || p.id !== produto?.id) {
                  ultimoProdutoAvisoBloqueio.current = null
                }
                setProduto(p)
              }}
              disabled={hidratandoDeepLink}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Tipo de estoque</Label>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => {
              const ativo = tipoEstoque === t.valor
              return (
                <button
                  key={t.valor}
                  type="button"
                  onClick={() => setTipoEstoque(t.valor)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    ativo
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground hover:bg-muted',
                  )}
                  aria-pressed={ativo}
                >
                  {t.rotulo}
                </button>
              )
            })}
          </div>
        </div>
      </CardPadrao>

      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {mensagem && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          {mensagem}
        </div>
      )}

      {kardex && (
        <PainelProdutoKardex
          produto={kardex.produto}
          fornecedores={kardex.fornecedores}
        />
      )}

      <CardsSaldosEstoque
        saldos={kardex?.saldos ?? null}
        unidade={unidade}
        tipoAtivo={tipoEstoque}
      />

      <CardPadrao
        titulo={`Movimentos — ${ROTULO_TIPO_ESTOQUE[tipoEstoque]}`}
        compacto
      >
        {!produto && hidratandoDeepLink ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando produto…
          </p>
        ) : !produto ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Selecione um produto e período para ver o kardex.
          </p>
        ) : carregando && !kardex ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando movimentos…
          </p>
        ) : (
          <GradeKardex
            linhas={kardex?.linhas ?? []}
            saldoInicial={kardex?.saldoInicial ?? 0}
            totais={kardex?.totais ?? { entrada: 0, saida: 0 }}
            saldoFinal={kardex?.saldoFinal ?? 0}
            unidade={unidade}
          />
        )}
        {kardex && (
          <p className="mt-2 text-xs text-muted-foreground">
            Saldo inicial {formatarQtdEstoque(kardex.saldoInicial)} · Final{' '}
            {formatarQtdEstoque(kardex.saldoFinal)} · {kardex.linhas.length} movimento(s)
          </p>
        )}
      </CardPadrao>

      {kardex && kardex.resumoPorTipo.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Resumo por tipo de movimento</h3>
          <ResumoPorTipoKardex resumo={kardex.resumoPorTipo} />
        </div>
      )}

      {produto && (
        <ModalAjusteInventario
          aberto={modalInventario}
          produtoId={produto.id}
          produtoRotulo={produtoRotulo}
          fisicoAtual={kardex?.saldos.qtdFisica ?? 0}
          precoCustoAtual={kardex?.produto.precoCusto ?? null}
          fornecedores={kardex?.fornecedores ?? []}
          aoFechar={() => setModalInventario(false)}
          aoSalvar={(aviso) => {
            setMensagem(
              aviso ??
                'Ajuste de inventário gravado no kardex (físico/disponível; fiscal inalterado).',
            )
            void carregar()
          }}
        />
      )}

      <ModalCiencia
        aberto={modalBloqueio.aberto}
        titulo="Estoque bloqueado"
        textoConfirmar="Entendi"
        aoConfirmar={() => setModalBloqueio({ aberto: false, bloqueio: null })}
      >
        {bloqueio && (
          <div className="space-y-3">
            <p>
              Este produto tem{' '}
              <strong className="tabular-nums text-foreground">
                {formatarQtdEstoque(bloqueio.qtdBloqueada)}
              </strong>{' '}
              {unidade} bloqueada(s). Essa quantidade <strong>não circula no disponível</strong>{' '}
              até o desbloqueio na Entrada de Notas.
            </p>
            {bloqueio.itens.length === 0 ? (
              <p>Confira os movimentos de Bloqueio no extrato abaixo para o detalhe.</p>
            ) : (
              <ul className="space-y-3">
                {bloqueio.itens.map((item) => (
                  <li
                    key={item.nfeRecebidaId}
                    className="rounded-md border border-amber-300/60 bg-amber-50/50 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/20"
                  >
                    <p className="font-medium text-foreground">
                      {item.nomeEmitente || 'Fornecedor'} ·{' '}
                      <span className="tabular-nums">
                        {formatarQtdEstoque(item.quantidade)}
                      </span>{' '}
                      {unidade}
                    </p>
                    <p className="mt-1 text-xs">
                      Motivo: <span className="text-foreground">{item.motivo}</span>
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                      Chave: {item.chaveNfe}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <Link
                        href={`/entrada-notas/${item.nfeRecebidaId}`}
                        className="text-primary underline"
                        onClick={() => setModalBloqueio({ aberto: false, bloqueio: null })}
                      >
                        Abrir na Entrada de Notas
                      </Link>
                      <Link
                        href={`/auditoria-entradas/${item.nfeRecebidaId}`}
                        className="text-primary underline"
                        onClick={() => setModalBloqueio({ aberto: false, bloqueio: null })}
                      >
                        Auditoria de entradas
                      </Link>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </ModalCiencia>
    </div>
  )
}
