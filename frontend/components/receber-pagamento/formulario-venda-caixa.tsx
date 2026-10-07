'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ComboboxProduto, type ProdutoOpcao } from '@/components/pedidos-compra/combobox-produto'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { classesCampoCompacto } from '@/components/ui/classes-campo'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'
import { filtrarCadastroPessoa } from '@/lib/normalizar-busca'
import { clienteHttp } from '@/services/api'

const LIMITE_CLIENTES = 80

export type ClienteLista = {
  id: string
  nome: string
  nomeFantasia?: string | null
  cpf?: string | null
  cnpj?: string | null
}

export type LinhaVendaCaixa = {
  chave: string
  produtoId: string
  quantidade: string
}

type ModoCliente = 'digitar' | 'buscar'

export function linhaVendaVazia(): LinhaVendaCaixa {
  return { chave: crypto.randomUUID(), produtoId: '', quantidade: '' }
}

export function quantidadeValida(valor: string) {
  const numero = Number(valor.replace(',', '.'))
  return Number.isFinite(numero) && numero > 0
}

export function itensProntos(linhas: LinhaVendaCaixa[]) {
  return linhas
    .filter((linha) => linha.produtoId && quantidadeValida(linha.quantidade))
    .map((linha) => ({
      produtoId: linha.produtoId,
      quantidade: Number(linha.quantidade.replace(',', '.')),
    }))
}

function LinhaItem({
  linha,
  travado,
  podeTirar,
  aoMudar,
  aoTirar,
}: {
  linha: LinhaVendaCaixa
  travado: boolean
  podeTirar: boolean
  aoMudar: (parcial: Partial<LinhaVendaCaixa>) => void
  aoTirar: () => void
}) {
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)

  async function buscarProdutos(termo: string) {
    setCarregandoProdutos(true)
    try {
      const { data } = await clienteHttp.get('/produtos', {
        params: { q: termo, resumo: 'true', limite: 40, pagina: 1 },
      })
      const lista = (data.produtos ?? data.itens ?? []) as Array<{
        id: string
        nomeVenda: string
        sku: string | null
        unidade?: string
      }>
      setProdutos(
        lista.map((produto) => ({
          id: produto.id,
          nomeVenda: produto.nomeVenda,
          sku: produto.sku,
          unidade: produto.unidade ?? 'UN',
        }))
      )
    } catch {
      setProdutos([])
    } finally {
      setCarregandoProdutos(false)
    }
  }

  return (
    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
      <ComboboxProduto
        rotulo="Produto"
        produtos={produtos}
        valor={linha.produtoId}
        aoMudar={(produtoId) => aoMudar({ produtoId })}
        aoBuscar={buscarProdutos}
        carregandoBusca={carregandoProdutos}
        disabled={travado}
      />
      <InputPadrao
        rotulo="Quantidade"
        name={`quantidade-${linha.chave}`}
        value={linha.quantidade}
        inputMode="decimal"
        disabled={travado}
        onChange={(evento) => aoMudar({ quantidade: evento.target.value })}
      />
      <Button type="button" variant="outline" disabled={travado || !podeTirar} onClick={aoTirar}>
        tirar
      </Button>
    </div>
  )
}

type Props = {
  travado: boolean
  clienteNome: string
  aoMudarClienteNome: (valor: string) => void
  linhas: LinhaVendaCaixa[]
  aoMudarLinhas: (linhas: LinhaVendaCaixa[]) => void
  tituloCliente?: string
  tituloItens?: string
}

export function FormularioVendaCaixa({
  travado,
  clienteNome,
  aoMudarClienteNome,
  linhas,
  aoMudarLinhas,
  tituloCliente = 'Cliente',
  tituloItens = 'Itens',
}: Props) {
  const [modoCliente, setModoCliente] = useState<ModoCliente>('digitar')
  const [clientes, setClientes] = useState<ClienteLista[]>([])
  const [clientesConsultados, setClientesConsultados] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [buscaClienteAberta, setBuscaClienteAberta] = useState(false)
  const [erroClientes, setErroClientes] = useState('')
  const instanciaId = useInstanciaDropdownCatalogo()
  const fecharBusca = useCallback(() => setBuscaClienteAberta(false), [])
  const zonaHover = useFecharAoSairComMouse(fecharBusca)
  useOuvirFechamentoDropdownCatalogo(instanciaId, fecharBusca)

  const clientesFiltrados = useMemo(
    () => filtrarCadastroPessoa(clientes, buscaCliente).slice(0, LIMITE_CLIENTES),
    [clientes, buscaCliente]
  )

  useEffect(() => {
    if (modoCliente !== 'buscar' || clientesConsultados) return
    let cancelado = false
    setErroClientes('')
    clienteHttp
      .get<{ clientes: ClienteLista[] }>('/clientes')
      .then(({ data }) => {
        if (cancelado) return
        setClientes(data.clientes ?? [])
        setClientesConsultados(true)
      })
      .catch((falha: unknown) => {
        if (cancelado) return
        const status = (falha as { response?: { status?: number } }).response?.status
        setErroClientes(
          status === 403
            ? 'Sem permissão para consultar clientes'
            : 'Não foi possível buscar os clientes'
        )
        setClientesConsultados(true)
      })
    return () => {
      cancelado = true
    }
  }, [modoCliente, clientesConsultados])

  function escolherCliente(cliente: ClienteLista) {
    aoMudarClienteNome(cliente.nome)
    setBuscaCliente('')
    setBuscaClienteAberta(false)
  }

  function abrirBusca() {
    notificarAberturaDropdownCatalogo(instanciaId)
    setBuscaClienteAberta(true)
  }

  return (
    <>
      <CardPadrao titulo={tituloCliente}>
        <div className="mb-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={modoCliente === 'digitar' ? 'default' : 'outline'}
            onClick={() => setModoCliente('digitar')}
            disabled={travado}
          >
            Digitar
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modoCliente === 'buscar' ? 'default' : 'outline'}
            onClick={() => setModoCliente('buscar')}
            disabled={travado}
          >
            Buscar cliente
          </Button>
        </div>
        {modoCliente === 'buscar' ? (
          <div className="relative mb-3 space-y-1.5" {...zonaHover}>
            <Label htmlFor="busca-cliente-pagamento">Buscar cliente</Label>
            <input
              id="busca-cliente-pagamento"
              name="busca-cliente"
              className={classesCampoCompacto}
              placeholder="Nome, nome fantasia ou documento"
              value={buscaCliente}
              autoComplete="off"
              disabled={travado}
              onFocus={abrirBusca}
              onChange={(evento) => {
                setBuscaCliente(evento.target.value)
                abrirBusca()
              }}
            />
            {erroClientes ? <p className="text-sm text-destructive">{erroClientes}</p> : null}
            {buscaClienteAberta && !erroClientes ? (
              <ul className="absolute z-20 max-h-60 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md">
                {!clientesConsultados ? (
                  <li className="px-3 py-2 text-muted-foreground">Buscando clientes…</li>
                ) : clientesFiltrados.length === 0 ? (
                  <li className="px-3 py-2 text-muted-foreground">Nenhum cliente</li>
                ) : (
                  clientesFiltrados.map((cliente) => (
                    <li key={cliente.id}>
                      <button
                        type="button"
                        className="flex w-full px-3 py-2 text-left hover:bg-accent"
                        onMouseDown={(evento) => evento.preventDefault()}
                        onClick={() => escolherCliente(cliente)}
                      >
                        {cliente.nome}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        ) : null}
        <InputPadrao
          rotulo="Cliente"
          name="cliente-nome"
          obrigatorio
          value={clienteNome}
          disabled={travado}
          onChange={(evento) => aoMudarClienteNome(evento.target.value)}
        />
      </CardPadrao>

      <CardPadrao titulo={tituloItens}>
        <div className="space-y-4">
          {linhas.map((linha) => (
            <LinhaItem
              key={linha.chave}
              linha={linha}
              travado={travado}
              podeTirar={linhas.length > 1}
              aoMudar={(parcial) =>
                aoMudarLinhas(
                  linhas.map((item) => (item.chave === linha.chave ? { ...item, ...parcial } : item))
                )
              }
              aoTirar={() => aoMudarLinhas(linhas.filter((item) => item.chave !== linha.chave))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={travado}
            onClick={() => aoMudarLinhas([...linhas, linhaVendaVazia()])}
          >
            + Item
          </Button>
        </div>
      </CardPadrao>
    </>
  )
}
