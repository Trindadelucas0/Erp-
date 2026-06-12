'use client'

/**
 * Tela de usuários — listar, criar, editar, desativar e permissões extras.
 */
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import type { PaginaDoSistema } from '@/types/sessao'
import {
  GradePermissoes,
  montarResumoDasPermissoes,
  type Permissao,
} from '@/components/compartilhado/grade-permissoes'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Checkbox } from '@/components/ui/checkbox'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Separator } from '@/components/ui/separator'
import { TituloSecao } from '@/components/ui/titulo-secao'
type Papel = {
  id: string
  name: string
  permissions: { permission: Permissao }[]
}

type Empresa = { id: string; name: string }

type Usuario = {
  id: string
  name: string
  email: string
  active: boolean
  roles: { role: Papel }[]
  companies: { company: Empresa }[]
  permissoesExtras: { permission: Permissao }[]
  paginasPermitidas: { pageKey: string }[]
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

function ConteudoDaPaginaDeUsuarios() {
  const roteador = useRouter()
  const { estaAutenticado, carregando: carregandoSessao, perfil } =
    useSessaoDoUsuario()
  const [listaDeUsuarios, setListaDeUsuarios] = useState<Usuario[]>([])
  const [listaDePapeis, setListaDePapeis] = useState<Papel[]>([])
  const [listaDeEmpresas, setListaDeEmpresas] = useState<Empresa[]>([])
  const [listaDePermissoes, setListaDePermissoes] = useState<Permissao[]>([])
  const [listaDePaginasVinculaveis, setListaDePaginasVinculaveis] = useState<
    PaginaDoSistema[]
  >([])
  const [mensagemDeErro, setMensagemDeErro] = useState('')
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState('')

  const [modoEdicao, setModoEdicao] = useState(false)
  const [idDoUsuarioEmEdicao, setIdDoUsuarioEmEdicao] = useState('')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [idsDosPapeisSelecionados, setIdsDosPapeisSelecionados] = useState<
    string[]
  >([])
  const [idsDasEmpresasSelecionadas, setIdsDasEmpresasSelecionadas] = useState<
    string[]
  >([])
  const [idsDasPermissoesExtras, setIdsDasPermissoesExtras] = useState<
    string[]
  >([])
  const [chavesDasPaginasSelecionadas, setChavesDasPaginasSelecionadas] =
    useState<string[]>([])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado || !perfil?.ehAdmin) return
    carregarDadosDaTela()
  }, [carregandoSessao, estaAutenticado, perfil])

  async function carregarDadosDaTela() {
    try {
      const [
        respostaUsuarios,
        respostaPapeis,
        respostaEmpresas,
        respostaPermissoes,
        respostaPaginas,
      ] = await Promise.all([
        clienteHttp.get('/users'),
        clienteHttp.get('/roles'),
        clienteHttp.get('/companies'),
        clienteHttp.get('/permissions'),
        clienteHttp.get('/paginas/vinculaveis'),
      ])

      setListaDeUsuarios(respostaUsuarios.data.usuarios)
      setListaDePapeis(respostaPapeis.data.papeis)
      setListaDeEmpresas(respostaEmpresas.data.empresas)
      setListaDePermissoes(respostaPermissoes.data.permissoes)
      setListaDePaginasVinculaveis(respostaPaginas.data.paginas)
    } catch {
      setMensagemDeErro('Erro ao carregar dados. Faça login novamente.')
      roteador.push('/login')
    }
  }

  function alternarIdNaLista(listaAtual: string[], idParaAlternar: string) {
    return listaAtual.includes(idParaAlternar)
      ? listaAtual.filter((id) => id !== idParaAlternar)
      : [...listaAtual, idParaAlternar]
  }

  function limparFormulario() {
    setModoEdicao(false)
    setIdDoUsuarioEmEdicao('')
    setNome('')
    setEmail('')
    setSenha('')
    setIdsDosPapeisSelecionados([])
    setIdsDasEmpresasSelecionadas([])
    setIdsDasPermissoesExtras([])
    setChavesDasPaginasSelecionadas([])
  }

  function aplicarUsuarioNoFormulario(usuario: Usuario) {
    setModoEdicao(true)
    setIdDoUsuarioEmEdicao(usuario.id)
    setNome(usuario.name)
    setEmail(usuario.email)
    setSenha('')
    setIdsDosPapeisSelecionados(
      usuario.roles.map((item) => item.role.id)
    )
    setIdsDasEmpresasSelecionadas(
      usuario.companies
        .map((item) => item.company.id)
        .filter((id) => listaDeEmpresas.some((empresa) => empresa.id === id))
    )
    setIdsDasPermissoesExtras(
      usuario.permissoesExtras.map((item) => item.permission.id)
    )
    setChavesDasPaginasSelecionadas(
      usuario.paginasPermitidas.map((item) => item.pageKey)
    )
  }

  function iniciarEdicao(usuario: Usuario) {
    aplicarUsuarioNoFormulario(usuario)
    setMensagemDeErro('')
    setMensagemDeSucesso('')
  }

  function atualizarUsuarioNaLista(usuarioAtualizado: Usuario) {
    setListaDeUsuarios((listaAtual) =>
      listaAtual.map((usuario) =>
        usuario.id === usuarioAtualizado.id ? usuarioAtualizado : usuario
      )
    )
  }

  async function alternarStatusDoUsuario(usuario: Usuario) {
    setMensagemDeErro('')
    setMensagemDeSucesso('')

    try {
      await clienteHttp.patch(`/users/${usuario.id}/ativo`, {
        ativo: !usuario.active,
      })
      setMensagemDeSucesso(
        usuario.active ? 'Usuário desativado.' : 'Usuário reativado.'
      )
      await carregarDadosDaTela()
    } catch (erro: unknown) {
      setMensagemDeErro(
        extrairMensagemDeErro(erro, 'Erro ao alterar status')
      )
    }
  }

  async function aoSalvarUsuario(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')
    setMensagemDeSucesso('')

    if (idsDosPapeisSelecionados.length === 0) {
      setMensagemDeErro('Selecione pelo menos um papel')
      return
    }

    if (idsDasEmpresasSelecionadas.length === 0) {
      setMensagemDeErro(
        'Selecione pelo menos uma empresa. Todo usuário precisa estar vinculado a uma empresa.'
      )
      return
    }

    const corpo = {
      nome,
      email,
      idsDosPapeis: idsDosPapeisSelecionados,
      idsDasEmpresas: idsDasEmpresasSelecionadas,
      idsDasPermissoesExtras,
      chavesDasPaginasPermitidas: chavesDasPaginasSelecionadas,
      ...(senha ? { senha } : {}),
    }

    try {
      if (modoEdicao) {
        const { data } = await clienteHttp.put(
          `/users/${idDoUsuarioEmEdicao}`,
          corpo
        )
        const usuarioAtualizado = data.usuario as Usuario
        atualizarUsuarioNaLista(usuarioAtualizado)
        aplicarUsuarioNoFormulario(usuarioAtualizado)
        setMensagemDeSucesso(
          `Usuário atualizado! Empresas vinculadas: ${usuarioAtualizado.companies.length}`
        )
      } else {
        if (!senha) {
          setMensagemDeErro('Senha é obrigatória ao criar usuário')
          return
        }
        await clienteHttp.post('/users', { ...corpo, senha })
        setMensagemDeSucesso('Usuário criado!')
        limparFormulario()
        await carregarDadosDaTela()
      }
    } catch (erro: unknown) {
      setMensagemDeErro(
        extrairMensagemDeErro(erro, 'Erro ao salvar usuário')
      )
    }
  }

  const resumoDosPapeisSelecionados = listaDePapeis
    .filter((papel) => idsDosPapeisSelecionados.includes(papel.id))
    .map((papel) => `${papel.name}: ${montarResumoDasPermissoes(papel.permissions)}`)
    .join(' | ')

  return (
    <div className="space-y-6">
      <p>
        <Link
          href="/papeis"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          Gerenciar papéis
        </Link>
      </p>

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

      <CardPadrao titulo="Lista de usuários">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Papéis</th>
                <th className="px-4 py-3 text-left font-medium">Empresas</th>
                <th className="px-4 py-3 text-left font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {listaDeUsuarios.map((usuario) => (
                <tr
                  key={usuario.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">{usuario.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {usuario.email}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeStatus variante={usuario.active ? 'ativo' : 'inativo'}>
                      {usuario.active ? 'Ativo' : 'Inativo'}
                    </BadgeStatus>
                  </td>
                  <td className="px-4 py-3">
                    {usuario.roles.map((item) => item.role.name).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    {usuario.companies
                      .map((item) => item.company.name)
                      .join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => iniciarEdicao(usuario)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => alternarStatusDoUsuario(usuario)}
                      >
                        {usuario.active ? 'Desativar' : 'Reativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <CardPadrao
        titulo={modoEdicao ? 'Editar usuário' : 'Criar usuário'}
        descricao={
          modoEdicao
            ? 'Altere os dados e clique em Salvar'
            : 'Preencha os campos para cadastrar um novo usuário'
        }
      >
        <form onSubmit={aoSalvarUsuario} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputPadrao
              rotulo="Nome"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              required
            />
            <InputPadrao
              rotulo="Email"
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              required
            />
          </div>

          <InputPadrao
            rotulo={modoEdicao ? 'Senha (deixe vazio para não alterar)' : 'Senha'}
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            required={!modoEdicao}
          />

          <Separator />

          <div className="space-y-3">
            <TituloSecao className="mb-0">Papéis</TituloSecao>
            <div className="grid gap-2 sm:grid-cols-2">
              {listaDePapeis.map((papel) => (
                <label
                  key={papel.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={idsDosPapeisSelecionados.includes(papel.id)}
                    onCheckedChange={() =>
                      setIdsDosPapeisSelecionados((listaAtual) =>
                        alternarIdNaLista(listaAtual, papel.id)
                      )
                    }
                  />
                  <span className="text-sm">{papel.name}</span>
                </label>
              ))}
            </div>
            {resumoDosPapeisSelecionados && (
              <p className="text-xs text-muted-foreground">
                Permissões dos papéis: {resumoDosPapeisSelecionados}
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <TituloSecao className="mb-0">
              Empresas ({idsDasEmpresasSelecionadas.length} selecionada
              {idsDasEmpresasSelecionadas.length === 1 ? '' : 's'})
            </TituloSecao>
            <p className="text-xs text-muted-foreground">
              Obrigatório: pelo menos 1 empresa.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {listaDeEmpresas.map((empresa) => (
                <label
                  key={empresa.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={idsDasEmpresasSelecionadas.includes(empresa.id)}
                    onCheckedChange={() =>
                      setIdsDasEmpresasSelecionadas((listaAtual) =>
                        alternarIdNaLista(listaAtual, empresa.id)
                      )
                    }
                  />
                  <span className="text-sm">{empresa.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <TituloSecao className="mb-0">Páginas liberadas</TituloSecao>
            <p className="text-xs text-muted-foreground">
              Marcar Cadastros → Ver nas permissões também libera o menu
              automaticamente.
            </p>
            {listaDePaginasVinculaveis.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma página disponível para vínculo ainda. Novas páginas
                aparecerão aqui automaticamente.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {listaDePaginasVinculaveis.map((pagina) => (
                  <label
                    key={pagina.chave}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={chavesDasPaginasSelecionadas.includes(
                        pagina.chave
                      )}
                      onCheckedChange={() =>
                        setChavesDasPaginasSelecionadas((listaAtual) =>
                          alternarIdNaLista(listaAtual, pagina.chave)
                        )
                      }
                    />
                    <span className="text-sm">{pagina.rotulo}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <TituloSecao className="mb-0">Permissões extras (opcional)</TituloSecao>
            <p className="text-xs text-muted-foreground">
              O usuário herda as permissões dos papéis. Marque aqui apenas
              exceções individuais.
            </p>
            <GradePermissoes
              listaDePermissoes={listaDePermissoes}
              idsSelecionados={idsDasPermissoesExtras}
              aoAlterar={setIdsDasPermissoesExtras}
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
    </div>
  )
}

export default function PaginaDeUsuarios() {
  return (
    <ProtegerRota somenteAdmin>
      <ConteudoDaPaginaDeUsuarios />
    </ProtegerRota>
  )
}
