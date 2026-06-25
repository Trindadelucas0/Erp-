'use client'

import { useState } from 'react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { PortaoAssinaturaComSenha } from '@/components/compartilhado/portao-assinatura-com-senha'
import { Abas } from '@/components/ui/abas'
import { PainelConfiguracaoZapsign } from '@/components/assinatura-zapsign/painel-configuracao-zapsign'
import { ListaDocumentosZapsign } from '@/components/assinatura-zapsign/lista-documentos-zapsign'

const ABAS = [
  { id: 'configuracao', rotulo: 'Configuração' },
  { id: 'documentos', rotulo: 'Documentos' },
]

function ConteudoPaginaAssinaturaDigital() {
  const [abaAtiva, setAbaAtiva] = useState('configuracao')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assinatura Digital</h1>
        <p className="text-sm text-muted-foreground">
          Integração com ZapSign — envie documentos para assinatura eletrônica
        </p>
      </div>

      <Abas abas={ABAS} abaAtiva={abaAtiva} aoMudar={setAbaAtiva} />

      <div>
        {abaAtiva === 'configuracao' && <PainelConfiguracaoZapsign />}
        {abaAtiva === 'documentos' && (
          <PortaoAssinaturaComSenha descricao="Para visualizar o status e enviar documentos de assinatura, confirme sua senha de administrador.">
            <ListaDocumentosZapsign />
          </PortaoAssinaturaComSenha>
        )}
      </div>
    </div>
  )
}

export default function PaginaAssinaturaDigital() {
  return (
    <ProtegerRota somenteAdmin>
      <ConteudoPaginaAssinaturaDigital />
    </ProtegerRota>
  )
}
