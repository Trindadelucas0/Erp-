'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, RefreshCw } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
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

  const [de, setDe] = useState(inicioDoMesIso)
  const [ate, setAte] = useState(hojeIso)
  const [tipoEstoque, setTipoEstoque] = useState<TipoEstoqueVisao>('fisico')
  const [produto, setProduto] = useState<ProdutoBuscaEstoque | null>(null)
  const [kardex, setKardex] = useState<RespostaKardex | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modalInventario, setModalInventario] = useState(false)

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

  const produtoRotulo = produto
    ? produto.sku
      ? `${produto.sku} — ${produto.nomeVenda}`
      : produto.nomeVenda
    : ''

  const unidade =
    kardex?.produto.unidade ?? produto?.unidade ?? 'Unidades'

  return (
    <div className="space-y-4">
      <CardPadrao
        titulo="Kardex de Estoque"
        descricao="Extrato de movimentos por produto e tipo de estoque"
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
            <BuscaProdutoEstoque valor={produto} aoSelecionar={setProduto} />
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
        {!produto ? (
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
    </div>
  )
}
