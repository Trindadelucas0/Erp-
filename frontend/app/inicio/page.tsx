'use client'

import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { CardPadrao } from '@/components/ui/card-padrao'

export default function PaginaDeInicio() {
  return (
    <ProtegerRota>
      <CardPadrao
        titulo="Bem-vindo"
        descricao="Nenhuma página liberada. Contate o administrador."
      >
        <p className="text-sm text-muted-foreground">
          Seu usuário está autenticado, mas ainda não possui páginas vinculadas
          para acesso no sistema.
        </p>
      </CardPadrao>
    </ProtegerRota>
  )
}
