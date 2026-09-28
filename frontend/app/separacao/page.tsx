'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { Button } from '@/components/ui/button'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import {
  BadgePrioridadeRequisicao,
  BadgeStatusRequisicao,
} from '@/components/requisicoes-wms/badges-requisicao'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  formatarNumeroRequisicao,
  type ListaRequisicoes,
  type RequisicaoWms,
} from '@/lib/requisicoes-wms'

function ConteudoLista() {
  const { perfil } = useSessaoDoUsuario()
  const padraoFila = perfil?.ehAdmin ? 'todas' : 'minha'
  const [fila, setFila] = useState<'minha' | 'todas'>(padraoFila)
  const [itens, setItens] = useState<RequisicaoWms[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (perfil && !perfil.ehAdmin) setFila('minha')
  }, [perfil])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<ListaRequisicoes>('/requisicoes', {
        params: { fila, tipo: 'separacao', pagina: 1, limite: 50 },
      })
      setItens(data.itens)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível carregar as separações.'))
      setItens([])
    } finally {
      setCarregando(false)
    }
  }, [fila])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Separação de pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Fila de Separação. Cada ordem continua criada em Requisições.
          </p>
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
        <div className="space-y-2">
          <p className="text-sm text-destructive">{erro}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void carregar()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border-2 border-border bg-card">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Endereço</th>
                <th className="px-3 py-2">Qtd</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela linhas={5} colunas={6} />
              ) : itens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma separação nesta fila.
                  </td>
                </tr>
              ) : (
                itens.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <Link
                        href={`/separacao/${item.id}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {formatarNumeroRequisicao(item.numero)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{item.produtoNome || '—'}</td>
                    <td className="px-3 py-2">{item.origemCodigo || '—'}</td>
                    <td className="px-3 py-2">
                      {item.qtdExecutada ?? 0} / {item.quantidade ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <BadgePrioridadeRequisicao prioridade={item.prioridade} />
                    </td>
                    <td className="px-3 py-2">
                      <BadgeStatusRequisicao status={item.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PaginaSeparacao() {
  return (
    <ProtegerRota chaveDaPagina="separacao" chavesDaPagina={['requisicoes']}>
      <ConteudoLista />
    </ProtegerRota>
  )
}
