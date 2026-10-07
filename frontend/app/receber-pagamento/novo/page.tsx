'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import {
  FormularioVendaCaixa,
  itensProntos,
  linhaVendaVazia,
  type LinhaVendaCaixa,
} from '@/components/receber-pagamento/formulario-venda-caixa'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { usePermissao } from '@/hooks/use-permissao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CHAVE_AVISO, fraseSeparacoes } from '@/lib/receber-pagamento-desenvolvimento'
import { clienteHttp } from '@/services/api'

const MSG_INCOMPLETO = 'Informe o cliente e ao menos um produto com quantidade.'

function ConteudoNovaVenda() {
  const roteador = useRouter()
  const podeCriar = usePermissao('vendas:create')
  const [clienteNome, setClienteNome] = useState('')
  const [linhas, setLinhas] = useState<LinhaVendaCaixa[]>(() => [linhaVendaVazia()])
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)

  async function confirmar() {
    const itens = itensProntos(linhas)
    if (!clienteNome.trim() || itens.length === 0) {
      setErro(MSG_INCOMPLETO)
      return
    }
    setGravando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post<{ venda: { separacoes: number[] } }>(
        '/receber-pagamento',
        {
          clienteNome: clienteNome.trim(),
          itens,
          formaPagamento: 'dinheiro',
          origem: 'caixa',
        }
      )
      sessionStorage.setItem(CHAVE_AVISO, fraseSeparacoes(data.venda.separacoes ?? []))
      roteador.push('/receber-pagamento')
    } catch (falha: unknown) {
      setErro(extrairMensagemApi(falha, 'Não foi possível confirmar o pagamento.'))
      setGravando(false)
    }
  }

  if (!podeCriar) {
    return (
      <div className="space-y-4">
        <TituloPagina caminho={<Link href="/receber-pagamento">Receber pagamento</Link>}>
          Receber em dinheiro
        </TituloPagina>
        <p className="text-sm text-muted-foreground">Sem permissão para confirmar o pagamento.</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <TituloPagina caminho={<Link href="/receber-pagamento">Receber pagamento</Link>}>
        Receber em dinheiro
      </TituloPagina>

      <p className="text-sm text-muted-foreground">Forma de pagamento: Dinheiro.</p>

      <FormularioVendaCaixa
        travado={gravando}
        clienteNome={clienteNome}
        aoMudarClienteNome={setClienteNome}
        linhas={linhas}
        aoMudarLinhas={setLinhas}
      />

      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      <BotaoPrimario type="button" disabled={gravando} onClick={() => void confirmar()}>
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
