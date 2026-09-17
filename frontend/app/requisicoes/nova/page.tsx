'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  FormularioCamposRequisicao,
  formParaPayload,
  formVazioRequisicao,
  type FormRequisicao,
} from '@/components/requisicoes-wms/formulario-campos-requisicao'

export default function PaginaNovaRequisicao() {
  return (
    <ProtegerRota chaveDaPagina="requisicoes">
      <ConteudoNova />
    </ProtegerRota>
  )
}

function ConteudoNova() {
  const router = useRouter()
  const [form, setForm] = useState<FormRequisicao>(formVazioRequisicao)
  const [operadores, setOperadores] = useState<Array<{ id: string; name: string }>>([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    void clienteHttp
      .get<{ operadores: Array<{ id: string; name: string }> }>('/requisicoes/operadores')
      .then((r) => setOperadores(r.data.operadores ?? []))
      .catch(() => setOperadores([]))
  }, [])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post('/requisicoes', formParaPayload(form))
      router.push(`/requisicoes/${data.requisicao.id}`)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível criar a requisição.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void salvar(e)}>
      <TituloPagina caminho={<Link href="/requisicoes">Requisições</Link>} subtitulo="Ordem operacional — não altera estoque.">
        Nova requisição
      </TituloPagina>
      <CardPadrao titulo="Dados">
        <FormularioCamposRequisicao form={form} aoMudar={setForm} operadores={operadores} />
        {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <BotaoPrimario type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Criar'}
          </BotaoPrimario>
          <Button type="button" variant="outline" asChild>
            <Link href="/requisicoes">Voltar</Link>
          </Button>
        </div>
      </CardPadrao>
    </form>
  )
}
