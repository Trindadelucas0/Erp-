'use client'

import { useMemo, useState } from 'react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import {
  FormularioVendaCaixa,
  itensProntos,
  linhaVendaVazia,
  type LinhaVendaCaixa,
} from '@/components/receber-pagamento/formulario-venda-caixa'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  FORMAS_TOTEM_UI,
  fraseSeparacoes,
  type FormaPagamentoUi,
} from '@/lib/receber-pagamento-desenvolvimento'
import { clienteHttp } from '@/services/api'

const MSG_INCOMPLETO = 'Informe o cliente e ao menos um produto com quantidade.'

function ConteudoTotem() {
  const { perfil, encerrarSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('vendas:create')
  const [clienteNome, setClienteNome] = useState('')
  const [linhas, setLinhas] = useState<LinhaVendaCaixa[]>(() => [linhaVendaVazia()])
  const [forma, setForma] = useState<FormaPagamentoUi | ''>('pix')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [gravando, setGravando] = useState(false)

  const empresaNome = useMemo(() => {
    const empresaId = typeof window !== 'undefined' ? localStorage.getItem('empresaAtivaId') : null
    const empresas = perfil?.empresas ?? []
    const ativa = empresas.find((e) => e.company.id === empresaId) ?? empresas[0]
    return ativa?.company.name ?? 'Autoatendimento'
  }, [perfil])

  const pronto = Boolean(clienteNome.trim() && itensProntos(linhas).length > 0 && forma)
  const travado = gravando

  function limpar() {
    setClienteNome('')
    setLinhas([linhaVendaVazia()])
    setForma('pix')
  }

  async function confirmar() {
    const itens = itensProntos(linhas)
    if (!clienteNome.trim() || itens.length === 0 || !forma) {
      setErro(MSG_INCOMPLETO)
      return
    }
    setGravando(true)
    setErro('')
    setAviso('')
    try {
      const { data } = await clienteHttp.post<{ venda: { separacoes: number[] } }>(
        '/receber-pagamento',
        {
          clienteNome: clienteNome.trim(),
          itens,
          formaPagamento: forma,
          origem: 'totem',
        }
      )
      setAviso(fraseSeparacoes(data.venda.separacoes ?? []))
      limpar()
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível confirmar o pagamento.'))
    } finally {
      setGravando(false)
    }
  }

  async function chamarAtendente() {
    const itens = itensProntos(linhas)
    if (!clienteNome.trim() || itens.length === 0) {
      setErro(MSG_INCOMPLETO)
      return
    }
    setGravando(true)
    setErro('')
    setAviso('')
    try {
      await clienteHttp.post('/receber-pagamento/chamar', {
        clienteNome: clienteNome.trim(),
        itens,
      })
      setAviso('Um atendente foi chamado. Aguarde na loja.')
      limpar()
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível chamar o atendente.'))
    } finally {
      setGravando(false)
    }
  }

  if (!podeCriar) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-6">
        <p className="text-lg text-muted-foreground">Sem permissão para confirmar o pagamento.</p>
        <Button type="button" variant="outline" onClick={encerrarSessao}>
          Sair
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Autoatendimento</p>
          <h1 className="text-2xl font-bold text-foreground">{empresaNome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o cliente e os produtos. Escolha como vai pagar.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={encerrarSessao}>
          Sair
        </Button>
      </header>

      <FormularioVendaCaixa
        travado={travado}
        clienteNome={clienteNome}
        aoMudarClienteNome={setClienteNome}
        linhas={linhas}
        aoMudarLinhas={setLinhas}
      />

      <CardPadrao titulo="Como vai pagar">
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMAS_TOTEM_UI.map((opcao) => (
            <Button
              key={opcao.valor}
              type="button"
              size="lg"
              variant={forma === opcao.valor ? 'default' : 'outline'}
              disabled={travado}
              onClick={() => setForma(opcao.valor)}
            >
              {opcao.rotulo}
            </Button>
          ))}
        </div>
      </CardPadrao>

      {aviso ? (
        <p className="text-sm text-foreground" role="status">
          {aviso}
        </p>
      ) : null}
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <BotaoPrimario
          type="button"
          className="min-h-12 flex-1"
          disabled={travado || !pronto}
          onClick={() => void confirmar()}
        >
          {gravando ? 'Confirmando…' : 'Confirmar pagamento'}
        </BotaoPrimario>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-12 flex-1"
          disabled={travado || !clienteNome.trim() || itensProntos(linhas).length === 0}
          onClick={() => void chamarAtendente()}
        >
          Chame um atendente
        </Button>
      </div>
    </div>
  )
}

export default function PaginaTotemReceberPagamento() {
  return (
    <ProtegerRota chaveDaPagina="receber-pagamento">
      <ConteudoTotem />
    </ProtegerRota>
  )
}
