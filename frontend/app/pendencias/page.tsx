'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ROTULO_TIPO_PENDENCIA,
  classeUrgenciaPendencia,
  type ItemPendencia,
  type ListaPendencias,
} from '@/lib/pendencias'
import { cn } from '@/lib/utils'

function ConteudoPendencias() {
  const searchParams = useSearchParams()
  const tela = searchParams.get('tela')?.trim() || undefined
  const [itens, setItens] = useState<ItemPendencia[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get<ListaPendencias>('/pendencias', {
        params: {
          ...(tela ? { tela } : {}),
          limite: 100,
          pagina: 1,
        },
      })
      setItens(data.itens)
      setTotal(data.total)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Não foi possível carregar as pendências.'))
      setItens([])
      setTotal(0)
    } finally {
      setCarregando(false)
    }
  }, [tela])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const porGrupo = useMemo(() => {
    const mapa = new Map<string, ItemPendencia[]>()
    for (const item of itens) {
      const lista = mapa.get(item.tipo) ?? []
      lista.push(item)
      mapa.set(item.tipo, lista)
    }
    return [...mapa.entries()]
  }, [itens])

  return (
    <div className="space-y-4">
      <TituloPagina>Pendências</TituloPagina>
      <CardPadrao
        titulo="O que precisa da sua atenção"
        descricao={
          tela
            ? `Filtrado pela tela ${tela}. Itens somem sozinhos quando a ação for concluída.`
            : 'Estado vivo do sistema — sem marcar como lida. Fechar o card na tela só esconde nesta visita.'
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}>
            Atualizar
          </Button>
          {tela && (
            <Link href="/pendencias" className="text-sm text-primary hover:underline">
              Ver todas as telas
            </Link>
          )}
          {!carregando && (
            <span className="text-sm text-muted-foreground">{total} item(ns)</span>
          )}
        </div>

        {erro && <p className="mb-3 text-sm text-destructive">{erro}</p>}
        {carregando && (
          <p className="text-sm text-muted-foreground">Carregando pendências…</p>
        )}
        {!carregando && itens.length === 0 && !erro && (
          <p className="text-sm text-muted-foreground">Nenhuma pendência no momento.</p>
        )}

        <div className="space-y-6">
          {porGrupo.map(([tipo, grupo]) => (
            <section key={tipo} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {ROTULO_TIPO_PENDENCIA[tipo] ?? tipo}{' '}
                <span className="font-normal text-muted-foreground">({grupo.length})</span>
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.map((item) => (
                  <Card
                    key={item.id}
                    size="sm"
                    className={cn('border-2', classeUrgenciaPendencia(item.urgencia))}
                  >
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm leading-snug">
                        <Link href={item.href} className="hover:underline">
                          {item.titulo}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">{item.descricao}</p>
                      <Link
                        href={item.href}
                        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Abrir
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      </CardPadrao>
    </div>
  )
}

export default function PaginaPendencias() {
  return (
    <ProtegerRota chaveDaPagina="pendencias">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Carregando Pendências…</p>}
      >
        <ConteudoPendencias />
      </Suspense>
    </ProtegerRota>
  )
}
