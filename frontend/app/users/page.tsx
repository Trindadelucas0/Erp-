'use client'

/**
 * Tela de usuários — listar, criar, editar, desativar e permissões extras.
 */
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clienteHttp } from '../../services/api'
import {
  GradePermissoes,
  montarResumoDasPermissoes,
  type Permissao,
} from '../../compartilhado/grade-permissoes'

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

export default function PaginaDeUsuarios() {
  const roteador = useRouter()
  const [listaDeUsuarios, setListaDeUsuarios] = useState<Usuario[]>([])
  const [listaDePapeis, setListaDePapeis] = useState<Papel[]>([])
  const [listaDeEmpresas, setListaDeEmpresas] = useState<Empresa[]>([])
  const [listaDePermissoes, setListaDePermissoes] = useState<Permissao[]>([])
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

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      roteador.push('/login')
      return
    }
    carregarDadosDaTela()
  }, [roteador])

  async function carregarDadosDaTela() {
    try {
      const [respostaUsuarios, respostaPapeis, respostaEmpresas, respostaPermissoes] =
        await Promise.all([
          clienteHttp.get('/users'),
          clienteHttp.get('/roles'),
          clienteHttp.get('/companies'),
          clienteHttp.get('/permissions'),
        ])

      setListaDeUsuarios(respostaUsuarios.data.usuarios)
      setListaDePapeis(respostaPapeis.data.papeis)
      setListaDeEmpresas(respostaEmpresas.data.empresas)
      setListaDePermissoes(respostaPermissoes.data.permissoes)
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
    <main>
      <h1>Usuários</h1>
      <p>
        <Link href="/papeis">Gerenciar papéis</Link>
      </p>

      {mensagemDeErro && <p>{mensagemDeErro}</p>}
      {mensagemDeSucesso && <p>{mensagemDeSucesso}</p>}

      <h2>Lista</h2>
      <table border={1} cellPadding={6}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Status</th>
            <th>Papéis</th>
            <th>Empresas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {listaDeUsuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td>{usuario.name}</td>
              <td>{usuario.email}</td>
              <td>{usuario.active ? 'Ativo' : 'Inativo'}</td>
              <td>
                {usuario.roles.map((item) => item.role.name).join(', ')}
              </td>
              <td>
                {usuario.companies
                  .map((item) => item.company.name)
                  .join(', ')}
              </td>
              <td>
                <button type="button" onClick={() => iniciarEdicao(usuario)}>
                  Editar
                </button>{' '}
                <button
                  type="button"
                  onClick={() => alternarStatusDoUsuario(usuario)}
                >
                  {usuario.active ? 'Desativar' : 'Reativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{modoEdicao ? 'Editar usuário' : 'Criar usuário'}</h2>
      <form onSubmit={aoSalvarUsuario}>
        <div>
          <label>Nome</label>
          <br />
          <input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            required
          />
        </div>
        <br />
        <div>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
          />
        </div>
        <br />
        <div>
          <label>Senha {modoEdicao && '(deixe vazio para não alterar)'}</label>
          <br />
          <input
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            required={!modoEdicao}
          />
        </div>
        <br />
        <fieldset>
          <legend>Papéis</legend>
          {listaDePapeis.map((papel) => (
            <label key={papel.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={idsDosPapeisSelecionados.includes(papel.id)}
                onChange={() =>
                  setIdsDosPapeisSelecionados((listaAtual) =>
                    alternarIdNaLista(listaAtual, papel.id)
                  )
                }
              />{' '}
              {papel.name}
            </label>
          ))}
        </fieldset>
        {resumoDosPapeisSelecionados && (
          <p>
            <small>Permissões dos papéis: {resumoDosPapeisSelecionados}</small>
          </p>
        )}
        <br />
        <fieldset>
          <legend>
            Empresas ({idsDasEmpresasSelecionadas.length} selecionada
            {idsDasEmpresasSelecionadas.length === 1 ? '' : 's'})
          </legend>
          <p>
            <small>Obrigatório: pelo menos 1 empresa.</small>
          </p>
          {listaDeEmpresas.map((empresa) => (
            <label key={empresa.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={idsDasEmpresasSelecionadas.includes(empresa.id)}
                onChange={() =>
                  setIdsDasEmpresasSelecionadas((listaAtual) =>
                    alternarIdNaLista(listaAtual, empresa.id)
                  )
                }
              />{' '}
              {empresa.name}
            </label>
          ))}
        </fieldset>
        <br />
        <fieldset>
          <legend>Permissões extras (opcional)</legend>
          <p>
            <small>
              O usuário herda as permissões dos papéis. Marque aqui apenas
              exceções individuais.
            </small>
          </p>
          <GradePermissoes
            listaDePermissoes={listaDePermissoes}
            idsSelecionados={idsDasPermissoesExtras}
            aoAlterar={setIdsDasPermissoesExtras}
          />
        </fieldset>
        <br />
        <button type="submit">{modoEdicao ? 'Salvar' : 'Criar'}</button>{' '}
        {modoEdicao && (
          <button type="button" onClick={limparFormulario}>
            Cancelar
          </button>
        )}
      </form>
    </main>
  )
}
