'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { Button } from '@/components/ui/button'
import { CampoBuscaLista } from '@/components/compartilhado/campo-busca-lista'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import {
  barrasArmazenagemTexto,
  podeIniciarGuardar,
  rotuloNfDaRequisicao,
  statusUiArmazenagem,
  type ListaRequisicoes,
  type RequisicaoWms,
} from '@/lib/requisicoes-wms'
import { cn } from '@/lib/utils'

function ConteudoLista() {
  const router = useRouter()
  const { perfil } = useSessaoDoUsuario()
  const padraoFila = perfil?.ehAdmin ? 'todas' : 'minha'
  const [fila, setFila] = useState<'minha' | 'todas'>(padraoFila)
  const [q, setQ] = useState('')
  const [itens, setItens] = useState<RequisicaoWms[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)

  useEffect(() => {
    if (perfil && !perfil.ehAdmin) setFila('minha')
  }, [perfil])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<ListaRequisicoes>('/requisicoes', {
        params: {
          tipo: 'armazenagem',
          fila,
          ...(q.trim() ? { q: q.trim() } : {}),
          pagina: 1,
          limite: 50,
        },
      })
      setItens(data.itens)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível carregar as mercadorias a guardar.'))
      setItens([])
    } finally {
      setCarregando(false)
    }
  }, [fila, q])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function guardar(item: RequisicaoWms) {
    if (!podeIniciarGuardar(item)) return
    setOcupadoId(item.id)
    setErro('')
    try {
      if (item.status === 'em_execucao' || item.status === 'pausada') {
        router.push(`/requisicoes/${item.id}/executar`)
        return
      }
      await clienteHttp.post(`/requisicoes/${item.id}/iniciar`)
      router.push(`/requisicoes/${item.id}/executar`)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível iniciar o guardar.'))
    } finally {
      setOcupadoId(null)
    }
  }

  return (
    <div className="space-y-4">
      <TituloPagina subtitulo="Bipa o produto (EAN-13 ou DUN-14) e o endereço de destino. O estoque já entrou na consolidação da nota.">
        Guardar mercadorias
      </TituloPagina>

      <CardPadrao
        titulo="Fila"
        descricao="Minha fila = atribuídas a você ou disponíveis sem dono. Uma ordem por produto da nota consolidada."
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <CampoBuscaLista
              nomeCampo="busca-lista-guardar-mercadorias"
              rotulo="Busca"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Produto, endereço, barras…"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={fila === 'minha' ? 'default' : 'outline'}
              onClick={() => setFila('minha')}
            >
              Minha fila
            </Button>
            <Button
              type="button"
              size="sm"
              variant={fila === 'todas' ? 'default' : 'outline'}
              onClick={() => setFila('todas')}
            >
              Todas da empresa
            </Button>
          </div>
        </div>

        {erro ? (
          <div className="mb-3 space-y-2">
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Produto</th>
                <th className="px-2 py-2">Quantidade</th>
                <th className="px-2 py-2">Código de barras</th>
                <th className="px-2 py-2">Endereço de armazenagem</th>
                <th className="px-2 py-2">Status da armazenagem</th>
                <th className="px-2 py-2">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela linhas={5} colunas={6} />
              ) : itens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
                    Nenhuma mercadoria pendente de armazenagem.
                  </td>
                </tr>
              ) : (
                itens.map((item) => {
                  const status = statusUiArmazenagem(item)
                  const pode = podeIniciarGuardar(item)
                  const nf = rotuloNfDaRequisicao(item.nfeRecebidaChave)
                  return (
                    <tr key={item.id} className="border-b border-border">
                      <td className="px-2 py-2">
                        <p className="font-medium">{item.produtoNome || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.produtoSku || '—'}
                          {nf ? ` · ${nf}` : ''}
                        </p>
                      </td>
                        <td className="px-2 py-2">
                          {item.quantidade ?? '—'} {item.produtoUnidade ?? ''}
                        </td>
                        <td className="px-2 py-2 break-all">
                          {barrasArmazenagemTexto(item) || '—'}
                        </td>
                        <td className="px-2 py-2 break-all">{item.destinoCodigo || '—'}</td>
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              'inline-block rounded-md border-2 px-2 py-0.5 text-xs font-medium',
                              status.chave === 'ok' && 'border-emerald-600 text-emerald-800',
                              status.chave === 'em_execucao' && 'border-amber-600 text-amber-800',
                              (status.chave === 'sem_endereco' || status.chave === 'sem_barras') &&
                                'border-destructive text-destructive',
                              status.chave === 'pendente' && 'border-border'
                            )}
                          >
                            {status.rotulo}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!pode || ocupadoId === item.id}
                            onClick={() => void guardar(item)}
                          >
                            Guardar
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
      </CardPadrao>
    </div>
  )
}

export default function PaginaGuardarMercadorias() {
  return (
    <ProtegerRota chaveDaPagina="guardar-mercadorias">
      <ConteudoLista />
    </ProtegerRota>
  )
}
