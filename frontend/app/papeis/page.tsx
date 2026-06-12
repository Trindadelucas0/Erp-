'use client'

/**
 * Tela de gestão de permissões por papel.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clienteHttp } from '@/services/api'
import {
  GradePermissoes,
  type Permissao,
} from '@/components/compartilhado/grade-permissoes'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Papel = {
  id: string
  name: string
  permissions: { permission: Permissao }[]
}

function ConteudoDaPaginaDePapeis() {
  const { estaAutenticado, carregando: carregandoSessao, perfil } =
    useSessaoDoUsuario()
  const [listaDePapeis, setListaDePapeis] = useState<Papel[]>([])
  const [listaDePermissoes, setListaDePermissoes] = useState<Permissao[]>([])
  const [papelSelecionado, setPapelSelecionado] = useState<Papel | null>(null)
  const [idsDasPermissoes, setIdsDasPermissoes] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado || !perfil?.ehAdmin) return
    carregarDados()
  }, [carregandoSessao, estaAutenticado, perfil])

  async function carregarDados() {
    try {
      const [respostaPapeis, respostaPermissoes] = await Promise.all([
        clienteHttp.get('/roles'),
        clienteHttp.get('/permissions'),
      ])
      setListaDePapeis(respostaPapeis.data.papeis)
      setListaDePermissoes(respostaPermissoes.data.permissoes)
    } catch {
      setMensagem('Erro ao carregar dados.')
    }
  }

  function selecionarPapel(papel: Papel) {
    setPapelSelecionado(papel)
    setIdsDasPermissoes(
      papel.permissions.map((item) => item.permission.id)
    )
    setMensagem('')
  }

  async function salvarPermissoes() {
    if (!papelSelecionado) return

    setMensagem('')

    try {
      await clienteHttp.put(`/roles/${papelSelecionado.id}/permissoes`, {
        idsDasPermissoes,
      })
      setMensagem('Permissões salvas com sucesso!')
      await carregarDados()
      const atualizado = (await clienteHttp.get(`/roles/${papelSelecionado.id}`))
        .data.papel
      setPapelSelecionado(atualizado)
      setIdsDasPermissoes(
        atualizado.permissions.map((item: { permission: Permissao }) => item.permission.id)
      )
    } catch (erro: unknown) {
      const msg =
        (erro as { response?: { data?: { mensagem?: string } } })?.response?.data
          ?.mensagem || 'Erro ao salvar'
      setMensagem(msg)
    }
  }

  const ehAdmin = papelSelecionado?.name === 'admin'

  return (
    <div className="space-y-6">
      <p>
        <Link
          href="/users"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← Voltar para usuários
        </Link>
      </p>

      {mensagem && (
        <p
          className={cn(
            'rounded-md px-3 py-2 text-sm',
            mensagem.includes('sucesso')
              ? 'bg-primary/10 text-primary'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          {mensagem}
        </p>
      )}

      <CardPadrao titulo="Papéis" descricao="Selecione um papel para editar permissões">
        <div className="flex flex-wrap gap-2">
          {listaDePapeis.map((papel) => (
            <Button
              key={papel.id}
              type="button"
              variant={papelSelecionado?.id === papel.id ? 'default' : 'outline'}
              onClick={() => selecionarPapel(papel)}
            >
              {papel.name}
            </Button>
          ))}
        </div>
      </CardPadrao>

      {papelSelecionado && (
        <CardPadrao titulo={`Permissões do papel: ${papelSelecionado.name}`}>
          {ehAdmin ? (
            <p className="text-sm text-muted-foreground">
              O papel admin tem acesso total ao sistema.
            </p>
          ) : (
            <div className="space-y-4">
              <GradePermissoes
                listaDePermissoes={listaDePermissoes}
                idsSelecionados={idsDasPermissoes}
                aoAlterar={setIdsDasPermissoes}
              />
              <BotaoPrimario type="button" onClick={salvarPermissoes}>
                Salvar permissões
              </BotaoPrimario>
            </div>
          )}
        </CardPadrao>
      )}
    </div>
  )
}

export default function PaginaDePapeis() {
  return (
    <ProtegerRota somenteAdmin>
      <ConteudoDaPaginaDePapeis />
    </ProtegerRota>
  )
}
