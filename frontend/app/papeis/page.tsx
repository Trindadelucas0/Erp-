'use client'

/**
 * Tela de gestão de papéis — criar, excluir e editar permissões.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import {
  GradePermissoes,
  type Permissao,
} from '@/components/compartilhado/grade-permissoes'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Papel = {
  id: string
  name: string
  description?: string
  permissions: { permission: Permissao }[]
}

const PAPEL_PROTEGIDO = 'admin'

function ConteudoDaPaginaDePapeis() {
  const { estaAutenticado, carregando: carregandoSessao, perfil } =
    useSessaoDoUsuario()
  const [listaDePapeis, setListaDePapeis] = useState<Papel[]>([])
  const [listaDePermissoes, setListaDePermissoes] = useState<Permissao[]>([])
  const [papelSelecionado, setPapelSelecionado] = useState<Papel | null>(null)
  const [idsDasPermissoes, setIdsDasPermissoes] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')

  // Criar papel
  const [criandoPapel, setCriandoPapel] = useState(false)
  const [nomeDoPapel, setNomeDoPapel] = useState('')
  const [descricaoDoPapel, setDescricaoDoPapel] = useState('')
  const [salvandoPapel, setSalvandoPapel] = useState(false)

  // Excluir papel
  const [papelParaExcluir, setPapelParaExcluir] = useState<Papel | null>(null)

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
    setIdsDasPermissoes(papel.permissions.map((item) => item.permission.id))
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
      const atualizado = (await clienteHttp.get(`/roles/${papelSelecionado.id}`)).data.papel
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

  async function criarPapel() {
    if (!nomeDoPapel) return

    setSalvandoPapel(true)
    setMensagem('')

    try {
      await clienteHttp.post('/roles', {
        nome: nomeDoPapel,
        descricao: descricaoDoPapel || undefined,
      })
      setMensagem(`Papel "${nomeDoPapel}" criado com sucesso!`)
      setNomeDoPapel('')
      setDescricaoDoPapel('')
      setCriandoPapel(false)
      await carregarDados()
    } catch (erro: unknown) {
      const msg =
        (erro as { response?: { data?: { mensagem?: string } } })?.response?.data
          ?.mensagem || 'Erro ao criar papel'
      setMensagem(msg)
    } finally {
      setSalvandoPapel(false)
    }
  }

  async function confirmarExclusaoDePapel() {
    if (!papelParaExcluir) return

    try {
      await clienteHttp.delete(`/roles/${papelParaExcluir.id}`)
      setMensagem(`Papel "${papelParaExcluir.name}" excluído.`)
      if (papelSelecionado?.id === papelParaExcluir.id) {
        setPapelSelecionado(null)
      }
      setPapelParaExcluir(null)
      await carregarDados()
    } catch (erro: unknown) {
      const msg =
        (erro as { response?: { data?: { mensagem?: string } } })?.response?.data
          ?.mensagem || 'Erro ao excluir papel'
      setMensagem(msg)
    }
  }

  const ehAdmin = papelSelecionado?.name === PAPEL_PROTEGIDO

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
            mensagem.includes('sucesso') || mensagem.includes('excluído')
              ? 'bg-primary/10 text-primary'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          {mensagem}
        </p>
      )}

      {/* Modal de confirmação para excluir papel */}
      {papelParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Excluir papel</h3>
            <ConfirmacaoComSenha
              mensagem={`Confirme sua senha para excluir o papel "${papelParaExcluir.name}". Usuários com este papel perderão as permissões associadas.`}
              onConfirmar={confirmarExclusaoDePapel}
              onCancelar={() => setPapelParaExcluir(null)}
            />
          </div>
        </div>
      )}

      <CardPadrao
        titulo="Papéis"
        descricao="Selecione um papel para editar permissões"
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {listaDePapeis.map((papel) => (
            <div key={papel.id} className="flex items-center gap-1">
              <Button
                type="button"
                variant={papelSelecionado?.id === papel.id ? 'default' : 'outline'}
                onClick={() => selecionarPapel(papel)}
              >
                {papel.name}
              </Button>
              {papel.name !== PAPEL_PROTEGIDO && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  title={`Excluir papel ${papel.name}`}
                  onClick={() => {
                    setPapelParaExcluir(papel)
                    setMensagem('')
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setCriandoPapel((v) => !v)
              setNomeDoPapel('')
              setDescricaoDoPapel('')
            }}
          >
            <Plus className="size-4" />
            Novo papel
          </Button>
        </div>

        {/* Formulário de criação */}
        {criandoPapel && (
          <div className="mt-4 rounded-md border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Criar novo papel</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputPadrao
                rotulo="Nome (sem espaços, ex: vendedor)"
                value={nomeDoPapel}
                onChange={(e) => setNomeDoPapel(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                placeholder="Ex: vendedor"
              />
              <InputPadrao
                rotulo="Descrição (opcional)"
                value={descricaoDoPapel}
                onChange={(e) => setDescricaoDoPapel(e.target.value)}
                placeholder="Descrição do papel"
              />
            </div>
            <div className="flex gap-2">
              <BotaoPrimario
                type="button"
                onClick={criarPapel}
                disabled={!nomeDoPapel || salvandoPapel}
              >
                {salvandoPapel ? 'Criando...' : 'Criar papel'}
              </BotaoPrimario>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCriandoPapel(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardPadrao>

      {papelSelecionado && (
        <CardPadrao titulo={`Permissões do papel: ${papelSelecionado.name}`}>
          {ehAdmin ? (
            <p className="text-sm text-muted-foreground">
              O papel admin tem acesso total ao sistema e não pode ser editado.
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
