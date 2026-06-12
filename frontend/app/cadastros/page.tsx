'use client'

/**
 * Tela de cadastros — CRUD de empresas com permissões cadastros:*.
 */
import { FormEvent, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { usePermissao } from '@/hooks/use-permissao'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'

type Empresa = {
  id: string
  name: string
  cnpj: string
  active: boolean
}

function extrairMensagemDeErro(
  erro: unknown,
  mensagemPadrao: string
): string {
  const respostaAxios = erro as {
    response?: { data?: { mensagem?: string; message?: string } }
    message?: string
    code?: string
  }

  if (!respostaAxios.response) {
    if (respostaAxios.code === 'ERR_NETWORK') {
      return 'Não foi possível conectar à API. Verifique se o servidor está rodando.'
    }
    return respostaAxios.message || mensagemPadrao
  }

  const dados = respostaAxios.response.data
  return dados?.mensagem || dados?.message || mensagemPadrao
}

function ConteudoDaPaginaDeCadastros() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('cadastros:create')
  const podeEditar = usePermissao('cadastros:edit')
  const podeDesativar = usePermissao('cadastros:delete')

  const [listaDeEmpresas, setListaDeEmpresas] = useState<Empresa[]>([])
  const [mensagemDeErro, setMensagemDeErro] = useState('')
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState('')

  const [modoEdicao, setModoEdicao] = useState(false)
  const [idDaEmpresaEmEdicao, setIdDaEmpresaEmEdicao] = useState('')

  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarEmpresas()
  }, [carregandoSessao, estaAutenticado])

  async function carregarEmpresas() {
    try {
      const { data } = await clienteHttp.get('/companies')
      setListaDeEmpresas(data.empresas)
    } catch (erro: unknown) {
      setMensagemDeErro(
        extrairMensagemDeErro(erro, 'Erro ao carregar empresas')
      )
    }
  }

  function limparFormulario() {
    setModoEdicao(false)
    setIdDaEmpresaEmEdicao('')
    setNome('')
    setCnpj('')
  }

  function iniciarEdicao(empresa: Empresa) {
    setModoEdicao(true)
    setIdDaEmpresaEmEdicao(empresa.id)
    setNome(empresa.name)
    setCnpj(empresa.cnpj)
    setMensagemDeErro('')
    setMensagemDeSucesso('')
  }

  async function aoSalvarEmpresa(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')
    setMensagemDeSucesso('')

    const corpo = { nome, cnpj }

    try {
      if (modoEdicao) {
        await clienteHttp.put(`/companies/${idDaEmpresaEmEdicao}`, corpo)
        setMensagemDeSucesso('Empresa atualizada!')
      } else {
        await clienteHttp.post('/companies', corpo)
        setMensagemDeSucesso('Empresa criada!')
        limparFormulario()
      }
      await carregarEmpresas()
    } catch (erro: unknown) {
      setMensagemDeErro(
        extrairMensagemDeErro(erro, 'Erro ao salvar empresa')
      )
    }
  }

  async function alternarStatusDaEmpresa(empresa: Empresa) {
    setMensagemDeErro('')
    setMensagemDeSucesso('')

    try {
      await clienteHttp.patch(`/companies/${empresa.id}/ativo`, {
        ativo: !empresa.active,
      })
      setMensagemDeSucesso(
        empresa.active ? 'Empresa desativada.' : 'Empresa reativada.'
      )
      await carregarEmpresas()
    } catch (erro: unknown) {
      setMensagemDeErro(
        extrairMensagemDeErro(erro, 'Erro ao alterar status')
      )
    }
  }

  const exibirFormulario = podeCriar || (modoEdicao && podeEditar)

  return (
    <div className="space-y-6">
      {mensagemDeErro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensagemDeErro}
        </p>
      )}
      {mensagemDeSucesso && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {mensagemDeSucesso}
        </p>
      )}

      <CardPadrao
        titulo="Empresas"
        descricao="Cadastro de empresas do sistema"
      >
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">CNPJ</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                {(podeEditar || podeDesativar) && (
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {listaDeEmpresas.map((empresa) => (
                <tr
                  key={empresa.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">{empresa.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {empresa.cnpj}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeStatus variante={empresa.active ? 'ativo' : 'inativo'}>
                      {empresa.active ? 'Ativa' : 'Inativa'}
                    </BadgeStatus>
                  </td>
                  {(podeEditar || podeDesativar) && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {podeEditar && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => iniciarEdicao(empresa)}
                          >
                            Editar
                          </Button>
                        )}
                        {podeDesativar && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => alternarStatusDaEmpresa(empresa)}
                          >
                            {empresa.active ? 'Desativar' : 'Reativar'}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      {exibirFormulario && (
        <CardPadrao
          titulo={modoEdicao ? 'Editar empresa' : 'Criar empresa'}
          descricao={
            modoEdicao
              ? 'Altere os dados e clique em Salvar'
              : 'Preencha os campos para cadastrar uma nova empresa'
          }
        >
          <form onSubmit={aoSalvarEmpresa} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InputPadrao
                rotulo="Nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                required
              />
              <InputPadrao
                rotulo="CNPJ"
                value={cnpj}
                onChange={(evento) => setCnpj(evento.target.value)}
                placeholder="00000000000000"
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <BotaoPrimario type="submit">
                {modoEdicao ? 'Salvar' : 'Criar'}
              </BotaoPrimario>
              {modoEdicao && (
                <Button type="button" variant="outline" onClick={limparFormulario}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardPadrao>
      )}
    </div>
  )
}

export default function PaginaDeCadastros() {
  return (
    <ProtegerRota chaveDaPagina="cadastros">
      <ConteudoDaPaginaDeCadastros />
    </ProtegerRota>
  )
}
