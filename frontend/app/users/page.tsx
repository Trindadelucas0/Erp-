'use client'

/**
 * Tela de usuários — listar, criar, editar, desativar e permissões extras.
 */
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
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
import { Modal } from '@/components/ui/modal'
import { Abas } from '@/components/ui/abas'
import { Separator } from '@/components/ui/separator'
import { TituloSecao } from '@/components/ui/titulo-secao'
import { exportarCsv } from '@/lib/exportar-csv'

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

function extrairMensagemDeErro(erro: unknown, mensagemPadrao: string): string {
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

const ABAS_USUARIO = [
  { id: 'dados', rotulo: 'Dados básicos' },
  { id: 'acesso', rotulo: 'Acesso' },
  { id: 'permissoes', rotulo: 'Permissões' },
]

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

  // Modal de criar/editar
  const [modalUsuarioAberto, setModalUsuarioAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [idDoUsuarioEmEdicao, setIdDoUsuarioEmEdicao] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('dados')
  const [salvando, setSalvando] = useState(false)

  // Campos do formulário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [idsDosPapeisSelecionados, setIdsDosPapeisSelecionados] = useState<string[]>([])
  const [idsDasEmpresasSelecionadas, setIdsDasEmpresasSelecionadas] = useState<string[]>([])
  const [idsDasPermissoesExtras, setIdsDasPermissoesExtras] = useState<string[]>([])
  const [chavesDasPaginasSelecionadas, setChavesDasPaginasSelecionadas] = useState<string[]>([])

  // Modais de ação (desativar/resetar senha)
  const [usuarioParaDesativar, setUsuarioParaDesativar] = useState<Usuario | null>(null)
  const [usuarioParaResetarSenha, setUsuarioParaResetarSenha] = useState<Usuario | null>(null)
  const [novaSenhaReset, setNovaSenhaReset] = useState('')
  const [salvandoResetSenha, setSalvandoResetSenha] = useState(false)

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
    setNome('')
    setEmail('')
    setSenha('')
    setIdsDosPapeisSelecionados([])
    setIdsDasEmpresasSelecionadas([])
    setIdsDasPermissoesExtras([])
    setChavesDasPaginasSelecionadas([])
    setAbaAtiva('dados')
  }

  function abrirModalNovo() {
    limparFormulario()
    setModoEdicao(false)
    setIdDoUsuarioEmEdicao('')
    setMensagemDeErro('')
    setModalUsuarioAberto(true)
  }

  function abrirModalEdicao(usuario: Usuario) {
    setModoEdicao(true)
    setIdDoUsuarioEmEdicao(usuario.id)
    setNome(usuario.name)
    setEmail(usuario.email)
    setSenha('')
    setIdsDosPapeisSelecionados(usuario.roles.map((item) => item.role.id))
    setIdsDasEmpresasSelecionadas(
      usuario.companies
        .map((item) => item.company.id)
        .filter((id) => listaDeEmpresas.some((e) => e.id === id))
    )
    setIdsDasPermissoesExtras(
      usuario.permissoesExtras.map((item) => item.permission.id)
    )
    setChavesDasPaginasSelecionadas(
      usuario.paginasPermitidas.map((item) => item.pageKey)
    )
    setAbaAtiva('dados')
    setMensagemDeErro('')
    setModalUsuarioAberto(true)
  }

  function fecharModalUsuario() {
    setModalUsuarioAberto(false)
    setMensagemDeErro('')
  }

  function atualizarUsuarioNaLista(usuarioAtualizado: Usuario) {
    setListaDeUsuarios((listaAtual) =>
      listaAtual.map((u) => (u.id === usuarioAtualizado.id ? usuarioAtualizado : u))
    )
  }

  async function confirmarAlteracaoDeStatus() {
    if (!usuarioParaDesativar) return
    const novoStatus = !usuarioParaDesativar.active
    try {
      await clienteHttp.patch(`/users/${usuarioParaDesativar.id}/ativo`, {
        ativo: novoStatus,
      })
      setMensagemDeSucesso(novoStatus ? 'Usuário reativado.' : 'Usuário desativado.')
      setUsuarioParaDesativar(null)
      await carregarDadosDaTela()
    } catch (erro: unknown) {
      setMensagemDeErro(extrairMensagemDeErro(erro, 'Erro ao alterar status'))
    }
  }

  async function aoSalvarUsuario(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')

    if (idsDosPapeisSelecionados.length === 0) {
      setAbaAtiva('acesso')
      setMensagemDeErro('Selecione pelo menos um papel')
      return
    }

    if (idsDasEmpresasSelecionadas.length === 0) {
      setAbaAtiva('acesso')
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

    setSalvando(true)
    try {
      if (modoEdicao) {
        const { data } = await clienteHttp.put(`/users/${idDoUsuarioEmEdicao}`, corpo)
        atualizarUsuarioNaLista(data.usuario as Usuario)
        setMensagemDeSucesso('Usuário atualizado!')
      } else {
        if (!senha) {
          setAbaAtiva('dados')
          setMensagemDeErro('Senha é obrigatória ao criar usuário')
          return
        }
        await clienteHttp.post('/users', { ...corpo, senha })
        setMensagemDeSucesso('Usuário criado!')
        await carregarDadosDaTela()
      }
      fecharModalUsuario()
    } catch (erro: unknown) {
      setMensagemDeErro(extrairMensagemDeErro(erro, 'Erro ao salvar usuário'))
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarResetSenha() {
    if (!usuarioParaResetarSenha || !novaSenhaReset) return
    setSalvandoResetSenha(true)
    try {
      await clienteHttp.patch(`/users/${usuarioParaResetarSenha.id}/senha`, {
        novaSenha: novaSenhaReset,
      })
      setMensagemDeSucesso(`Senha de ${usuarioParaResetarSenha.name} redefinida.`)
      setUsuarioParaResetarSenha(null)
      setNovaSenhaReset('')
    } catch (erro: unknown) {
      setMensagemDeErro(extrairMensagemDeErro(erro, 'Erro ao redefinir senha'))
    } finally {
      setSalvandoResetSenha(false)
    }
  }

  const resumoDosPapeisSelecionados = listaDePapeis
    .filter((p) => idsDosPapeisSelecionados.includes(p.id))
    .map((p) => `${p.name}: ${montarResumoDasPermissoes(p.permissions)}`)
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

      {mensagemDeErro && !modalUsuarioAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensagemDeErro}
        </p>
      )}
      {mensagemDeSucesso && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {mensagemDeSucesso}
        </p>
      )}

      {/* Modal de confirmar desativação */}
      {usuarioParaDesativar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {usuarioParaDesativar.active ? 'Desativar' : 'Reativar'} usuário
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Usuário: <strong>{usuarioParaDesativar.name}</strong>
            </p>
            <ConfirmacaoComSenha
              mensagem={
                usuarioParaDesativar.active
                  ? `Confirme sua senha para desativar "${usuarioParaDesativar.name}". O usuário perderá acesso ao sistema imediatamente.`
                  : `Confirme sua senha para reativar "${usuarioParaDesativar.name}".`
              }
              onConfirmar={confirmarAlteracaoDeStatus}
              onCancelar={() => setUsuarioParaDesativar(null)}
            />
          </div>
        </div>
      )}

      {/* Modal de reset de senha */}
      {usuarioParaResetarSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold">Redefinir senha</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Usuário: <strong>{usuarioParaResetarSenha.name}</strong>
            </p>
            <InputPadrao
              rotulo="Nova senha"
              type="password"
              value={novaSenhaReset}
              onChange={(e) => setNovaSenhaReset(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUsuarioParaResetarSenha(null)
                  setNovaSenhaReset('')
                }}
                disabled={salvandoResetSenha}
              >
                Cancelar
              </Button>
              <BotaoPrimario
                type="button"
                onClick={confirmarResetSenha}
                disabled={!novaSenhaReset || salvandoResetSenha}
              >
                {salvandoResetSenha ? 'Salvando...' : 'Redefinir senha'}
              </BotaoPrimario>
            </div>
          </div>
        </div>
      )}

      {/* Modal de criar/editar usuário */}
      <Modal
        aberto={modalUsuarioAberto}
        aoFechar={fecharModalUsuario}
        titulo={modoEdicao ? `Editar: ${nome}` : 'Novo usuário'}
        largura="2xl"
        rodape={
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {ABAS_USUARIO.map((aba, idx) => (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    abaAtiva === aba.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {idx + 1}. {aba.rotulo}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={fecharModalUsuario}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <BotaoPrimario
                form="form-usuario"
                type="submit"
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Criar usuário'}
              </BotaoPrimario>
            </div>
          </div>
        }
      >
        {mensagemDeErro && modalUsuarioAberto && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mensagemDeErro}
          </p>
        )}

        <Abas
          abas={ABAS_USUARIO}
          abaAtiva={abaAtiva}
          aoMudar={setAbaAtiva}
          className="mb-5"
        />

        <form id="form-usuario" onSubmit={aoSalvarUsuario}>
          {/* Aba 1: Dados básicos */}
          {abaAtiva === 'dados' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputPadrao
                  rotulo="Nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
                <InputPadrao
                  rotulo="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <InputPadrao
                rotulo={
                  modoEdicao
                    ? 'Nova senha (deixe vazio para não alterar)'
                    : 'Senha'
                }
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required={!modoEdicao}
                placeholder="Mínimo 6 caracteres"
              />
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Após preencher os dados básicos, avance para a aba{' '}
                  <strong>Acesso</strong> para vincular papéis e empresas.
                </p>
              </div>
            </div>
          )}

          {/* Aba 2: Acesso */}
          {abaAtiva === 'acesso' && (
            <div className="space-y-6">
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
                          setIdsDosPapeisSelecionados((l) =>
                            alternarIdNaLista(l, papel.id)
                          )
                        }
                      />
                      <span className="text-sm">{papel.name}</span>
                    </label>
                  ))}
                </div>
                {resumoDosPapeisSelecionados && (
                  <p className="text-xs text-muted-foreground">
                    Permissões herdadas: {resumoDosPapeisSelecionados}
                  </p>
                )}
                {idsDosPapeisSelecionados.length === 0 && (
                  <p className="text-xs text-destructive">
                    Obrigatório: selecione pelo menos 1 papel.
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <TituloSecao className="mb-0">
                  Empresas ({idsDasEmpresasSelecionadas.length} selecionada
                  {idsDasEmpresasSelecionadas.length === 1 ? '' : 's'})
                </TituloSecao>
                <div className="grid gap-2 sm:grid-cols-2">
                  {listaDeEmpresas.map((empresa) => (
                    <label
                      key={empresa.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={idsDasEmpresasSelecionadas.includes(empresa.id)}
                        onCheckedChange={() =>
                          setIdsDasEmpresasSelecionadas((l) =>
                            alternarIdNaLista(l, empresa.id)
                          )
                        }
                      />
                      <span className="text-sm">{empresa.name}</span>
                    </label>
                  ))}
                </div>
                {idsDasEmpresasSelecionadas.length === 0 && (
                  <p className="text-xs text-destructive">
                    Obrigatório: selecione pelo menos 1 empresa.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Aba 3: Permissões */}
          {abaAtiva === 'permissoes' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <TituloSecao className="mb-0">Páginas liberadas</TituloSecao>
                <p className="text-xs text-muted-foreground">
                  Selecione quais páginas o usuário poderá acessar no menu.
                  Marcar uma página com permissão Ver no papel também libera
                  automaticamente.
                </p>
                {listaDePaginasVinculaveis.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma página disponível para vínculo ainda.
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
                            setChavesDasPaginasSelecionadas((l) =>
                              alternarIdNaLista(l, pagina.chave)
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
                <TituloSecao className="mb-0">
                  Permissões extras (opcional)
                </TituloSecao>
                <p className="text-xs text-muted-foreground">
                  O usuário herda as permissões dos papéis selecionados. Marque
                  aqui apenas exceções individuais.
                </p>
                <GradePermissoes
                  listaDePermissoes={listaDePermissoes}
                  idsSelecionados={idsDasPermissoesExtras}
                  aoAlterar={setIdsDasPermissoesExtras}
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Tabela de usuários */}
      <CardPadrao
        titulo="Usuários"
        descricao="Lista de todos os usuários do sistema"
        acoes={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportarCsv(
                  listaDeUsuarios.map((u) => ({
                    Nome: u.name,
                    Email: u.email,
                    Status: u.active ? 'Ativo' : 'Inativo',
                    Papéis: u.roles.map((r) => r.role.name).join('; '),
                    Empresas: u.companies.map((c) => c.company.name).join('; '),
                  })),
                  'usuarios'
                )
              }
            >
              Exportar CSV
            </Button>
            <BotaoPrimario type="button" onClick={abrirModalNovo}>
              + Novo usuário
            </BotaoPrimario>
          </div>
        }
      >
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
              {listaDeUsuarios.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
              {listaDeUsuarios.map((usuario) => (
                <tr
                  key={usuario.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{usuario.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {usuario.email}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeStatus variante={usuario.active ? 'ativo' : 'inativo'}>
                      {usuario.active ? 'Ativo' : 'Inativo'}
                    </BadgeStatus>
                  </td>
                  <td className="px-4 py-3">
                    {usuario.roles.map((r) => r.role.name).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    {usuario.companies.map((c) => c.company.name).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => abrirModalEdicao(usuario)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUsuarioParaResetarSenha(usuario)
                          setNovaSenhaReset('')
                          setMensagemDeErro('')
                        }}
                      >
                        Redefinir senha
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setUsuarioParaDesativar(usuario)
                          setMensagemDeErro('')
                        }}
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
