'use client'

import Link from 'next/link'
import { CardPadrao } from '@/components/ui/card-padrao'

export function ConteudoDaPaginaEstruturaWms() {
  return (
    <CardPadrao titulo="Estrutura WMS">
      <p className="text-sm text-muted-foreground">
        O cadastro do depósito (Local, Área, Rua, Bloco, Andar e Apartamento) fica em{' '}
        <Link href="/enderecos-wms" className="underline underline-offset-2">
          Endereços WMS
        </Link>
        . Use <strong>Cadastrar endereços</strong> para um apartamento ou uma faixa; a prévia mostra
        o código completo antes de gravar.
      </p>
    </CardPadrao>
  )
}
