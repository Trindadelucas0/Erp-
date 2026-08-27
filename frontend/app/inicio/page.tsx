'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { clienteHttp } from '@/services/api'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import {
  classeUrgenciaPendencia,
  type ItemPendencia,
  type ListaPendencias,
} from '@/lib/pendencias'
import { cn } from '@/lib/utils'

function ConteudoInicio() {
  const { perfil } = useSessaoDoUsuario()
  const [itens, setItens] = useState<ItemPendencia[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const semPaginas = (perfil?.paginasPermitidas.length ?? 0) === 0

  useEffect(() => {
    if (semPaginas) {
      setCarregando(false)
      return
    }
    let cancelado = false
    ;(async () => {
      try {
        const { data } = await clienteHttp.get<ListaPendencias>('/pendencias', {
          params: { tela: '/inicio', limite: 3 },
        })
        if (cancelado) return
        setItens(data.itens)
        setTotal(data.total)
      } catch {
        if (!cancelado) {
          setItens([])
          setTotal(0)
        }
      } finally {
        if (!cancelado) setCarregando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [semPaginas])

  if (semPaginas) {
    return (
      <CardPadrao
        titulo="Bem-vindo"
        descricao="Nenhuma página liberada. Contate o administrador."
      >
        <p className="text-sm text-muted-foreground">
          Seu usuário está autenticado, mas ainda não possui páginas vinculadas
          para acesso no sistema.
        </p>
      </CardPadrao>
    )
  }

  return (
    <div className="space-y-4">
      <TituloPagina>Início</TituloPagina>
      <CardPadrao
        titulo="Pendências mais urgentes"
        descricao="Os 3 itens que mais precisam de atenção agora. O restante está na tela Pendências e no sino do cabeçalho."
      >
        {carregando && (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
        {!carregando && itens.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma pendência no momento. Use o menu para abrir os módulos.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {itens.map((item) => (
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
              </CardContent>
            </Card>
          ))}
        </div>
        {total > 0 && (
          <p className="mt-3 text-sm">
            <Link href="/pendencias" className="font-medium text-primary hover:underline">
              Ver todas as pendências ({total})
            </Link>
          </p>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaDeInicio() {
  return (
    <ProtegerRota>
      <ConteudoInicio />
    </ProtegerRota>
  )
}
