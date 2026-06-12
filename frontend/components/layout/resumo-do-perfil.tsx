import { BadgeStatus } from '@/components/ui/badge-status'
import type { PerfilDoUsuario } from '@/types/sessao'

function montarIniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)

  if (partes.length === 0) return '?'

  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase()
  }

  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase()
}

function montarRotuloDoPapel(perfil: PerfilDoUsuario): string {
  if (perfil.ehAdmin) {
    return 'Administrador'
  }

  const nomesDosPapeis =
    perfil.usuario.roles?.map((item) => item.role.name).filter(Boolean) ?? []

  if (nomesDosPapeis.length === 0) {
    return 'Usuário'
  }

  return nomesDosPapeis.join(', ')
}

type Props = {
  perfil: PerfilDoUsuario
}

export function ResumoDoPerfil({ perfil }: Props) {
  const { usuario } = perfil
  const iniciais = montarIniciaisDoNome(usuario.name)
  const rotuloDoPapel = montarRotuloDoPapel(perfil)

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {iniciais}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{usuario.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {usuario.email}
          </p>
        </div>
      </div>
      <BadgeStatus variante="info" className="mt-2">
        {rotuloDoPapel}
      </BadgeStatus>
    </div>
  )
}
