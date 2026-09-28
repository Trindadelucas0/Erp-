'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ComboboxProduto, type ProdutoOpcao } from '@/components/pedidos-compra/combobox-produto'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { classesCampoCompacto } from '@/components/ui/classes-campo'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { filtrarCadastroPessoa } from '@/lib/normalizar-busca'
import {
  RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO,
  TEXTO_CARD_DESENVOLVIMENTO,
  TITULO_CARD_DESENVOLVIMENTO,
} from '@/lib/receber-pagamento-desenvolvimento'
import { clienteHttp } from '@/services/api'
import { CHAVE_AVISO } from '../page'

const LIMITE_CLIENTES = 80
const MSG_INCOMPLETO = 'Informe o cliente e ao menos um produto com quantidade.'

type ClienteLista = {
  id: string
  nome: string
  nomeFantasia?: string | null
  cpf?: string | null
  cnpj?: string | null
}

type Linha = {
  chave: string
  produtoId: string
  quantidade: string
}

type ModoCliente = 'digitar' | 'buscar'

function linhaVazia(): Linha {
  return { chave: crypto.randomUUID(), produtoId: '', quantidade: '' }
}

function quantidadeValida(valor: string) {
  const numero = Number(valor.replace(',', '.'))
  return Number.isFinite(numero) && numero > 0
}

function fraseSeparacoes(numeros: number[]) {
  if (numeros.length === 0) return 'Pagamento confirmado.'
  if (numeros.length === 1) {
    return `Pagamento confirmado. Separação ${numeros[0]} está em Separação de pedidos.`
  }
  const ultimo = numeros[numeros.length - 1]
  const inicio = numeros.slice(0, -1).join(', ')
  return `Pagamento confirmado. Separações ${inicio} e ${ultimo} estão em Separação de pedidos.`
}

function LinhaItem({
  linha,
  gravando,
  podeTirar,
  aoMudar,
  aoTirar,
}: {
  linha: Linha
  gravando: boolean
  podeTirar: boolean
  aoMudar: (parcial: Partial<Linha>) => void
  aoTirar: () => void
}) {
  const travado = gravando || RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO
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

function ConteudoNovaVenda() {
  const roteador = useRouter()
  const podeCriar = usePermissao('vendas:create')
  const [modoCliente, setModoCliente] = useState<ModoCliente>('digitar')
  const [clienteNome, setClienteNome] = useState('')
  const [clientes, setClientes] = useState<ClienteLista[]>([])
  const [clientesConsultados, setClientesConsultados] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [buscaClienteAberta, setBuscaClienteAberta] = useState(false)
  const [erroClientes, setErroClientes] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>(() => [linhaVazia()])
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)

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
    setClienteNome(cliente.nome)
    setBuscaCliente('')
    setBuscaClienteAberta(false)
  }

  async function confirmar() {
    if (RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO) return
    const itens = linhas
      .filter((linha) => linha.produtoId && quantidadeValida(linha.quantidade))
      .map((linha) => ({
        produtoId: linha.produtoId,
        quantidade: Number(linha.quantidade.replace(',', '.')),
      }))
    if (!clienteNome.trim() || itens.length === 0) {
      setErro(MSG_INCOMPLETO)
      return
    }
    setGravando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post<{ venda: { separacoes: number[] } }>(
        '/receber-pagamento',
        { clienteNome: clienteNome.trim(), itens }
      )
      sessionStorage.setItem(CHAVE_AVISO, fraseSeparacoes(data.venda.separacoes ?? []))
      roteador.push('/receber-pagamento')
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível confirmar o pagamento.'))
      setGravando(false)
    }
  }

  const travado = gravando || RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO

  const cardDesenvolvimento = RECEBER_PAGAMENTO_EM_DESENVOLVIMENTO ? (
    <CardPadrao titulo={TITULO_CARD_DESENVOLVIMENTO}>
      {TEXTO_CARD_DESENVOLVIMENTO.map((linha) => (
        <p key={linha} className="text-sm text-foreground">
          {linha}
        </p>
      ))}
    </CardPadrao>
  ) : null

  if (!podeCriar) {
    return (
      <div className="space-y-4">
        <TituloPagina caminho={<Link href="/receber-pagamento">Receber pagamento</Link>}>
          Nova venda
        </TituloPagina>
        {cardDesenvolvimento}
        <p className="text-sm text-muted-foreground">Sem permissão para confirmar o pagamento.</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina caminho={<Link href="/receber-pagamento">Receber pagamento</Link>}>
        Nova venda
      </TituloPagina>

      {cardDesenvolvimento}

      <CardPadrao titulo="Cliente">
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
          <div className="mb-3 space-y-1.5">
            <Label htmlFor="busca-cliente-pagamento">Buscar cliente</Label>
            <input
              id="busca-cliente-pagamento"
              name="busca-cliente"
              className={classesCampoCompacto}
              placeholder="Nome, nome fantasia ou documento"
              value={buscaCliente}
              autoComplete="off"
              disabled={travado}
              onFocus={() => setBuscaClienteAberta(true)}
              onBlur={() => setBuscaClienteAberta(false)}
              onChange={(evento) => {
                setBuscaCliente(evento.target.value)
                setBuscaClienteAberta(true)
              }}
            />
            {erroClientes ? <p className="text-sm text-destructive">{erroClientes}</p> : null}
            {buscaClienteAberta && !erroClientes ? (
              <ul className="max-h-60 overflow-auto rounded-md border bg-popover text-sm">
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
          onChange={(evento) => setClienteNome(evento.target.value)}
        />
      </CardPadrao>

      <CardPadrao titulo="Itens">
        <div className="space-y-4">
          {linhas.map((linha) => (
            <LinhaItem
              key={linha.chave}
              linha={linha}
              gravando={gravando}
              podeTirar={linhas.length > 1}
              aoMudar={(parcial) =>
                setLinhas((atual) =>
                  atual.map((item) => (item.chave === linha.chave ? { ...item, ...parcial } : item))
                )
              }
              aoTirar={() => setLinhas((atual) => atual.filter((item) => item.chave !== linha.chave))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={travado}
            onClick={() => setLinhas((atual) => [...atual, linhaVazia()])}
          >
            + Item
          </Button>
        </div>
      </CardPadrao>

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <BotaoPrimario type="button" disabled={travado} onClick={() => void confirmar()}>
        {gravando ? 'Confirmando…' : 'Confirmar pagamento'}
      </BotaoPrimario>
    </div>
  )
}

export default function PaginaNovaVenda() {
  return (
    <ProtegerRota chaveDaPagina="receber-pagamento">
      <ConteudoNovaVenda />
    </ProtegerRota>
  )
}
