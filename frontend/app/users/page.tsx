'use client'

/**
 * Tela de usuários — listar, criar, editar, desativar e permissões extras.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { LinhaTabelaClicavel } from '@/components/compartilhado/linha-tabela-clicavel'
import { MenuAcoesLinha } from '@/components/compartilhado/menu-acoes-linha'
import { RodapeModalVisualizacao } from '@/components/compartilhado/rodape-modal-visualizacao'
import { RodapeModalFormulario } from '@/components/compartilhado/rodape-modal-formulario'
import { IndicadorEtapasModal } from '@/components/compartilhado/indicador-etapas-modal'
import { useRegistrarAtalhos } from '@/hooks/use-registrar-atalhos'
import {
  tituloComAtalho,
  useTeclaDaAcao,
} from '@/components/compartilhado/provedor-de-atalhos'
import { ConfirmacaoComSenha } from '@/components/compartilhado/confirmacao-com-senha'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import type { PaginaDoSistema } from '@/types/sessao'
import {
  GradePermissoes,
  montarResumoDasPermissoes,
  type Permissao,
} from '@/components/compartilhado/grade-permissoes'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BadgeCadastro } from '@/components/ui/badge-cadastro'
import { CelulaBadge } from '@/components/ui/celula-badge'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { textosContemTodosTermos } from '@/lib/normalizar-busca'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Select, classesOption } from '@/components/ui/select'
import { classesCampoLista } from '@/components/ui/classes-campo'
import { atributosCampoBuscaLista } from '@/lib/atributos-campo-busca-lista'
import { Modal } from '@/components/ui/modal'
import { Abas } from '@/components/ui/abas'
import { Separator } from '@/components/ui/separator'
import { TituloSecao } from '@/components/ui/titulo-secao'
import { submeterFormularioPorId } from '@/lib/atalhos/submeter-formulario'
import { useConfirmarSaida } from '@/hooks/use-confirmar-saida'
import { clonarFormulario } from '@/lib/formulario-alterado'

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  cargo: string | null
  active: boolean
  roles: { role: Papel }[]
  companies: { company: Empresa }[]
  permissoesExtras: { permission: Permissao }[]
  paginasPermitidas: { pageKey: string }[]
}

type FormularioUsuario = {
  nome: string
  email: string
  senha: string
  cargo: string
  idsDosPapeis: string[]
  idsDasEmpresas: string[]
  idsDasPermissoesExtras: string[]
  chavesDasPaginas: string[]
}

const FORM_USUARIO_VAZIO: FormularioUsuario = {
  nome: '',
  email: '',
  senha: '',
  cargo: '',
  idsDosPapeis: [],
  idsDasEmpresas: [],
  idsDasPermissoesExtras: [],
  chavesDasPaginas: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// ─── Status de cadastro ───────────────────────────────────────────────────────

type StatusCadastro = 'completo' | 'incompleto'

function gerarPendenciasUsuario(usuario: Usuario): string[] {
  const pendencias: string[] = []
  if (!usuario.name || usuario.name.trim().length < 2)
    pendencias.push('Nome inválido (mínimo 2 caracteres)')
  if (!emailValido(usuario.email))
    pendencias.push('E-mail inválido')
  if (!usuario.cargo || usuario.cargo.trim() === '')
    pendencias.push('Cargo não informado')
  if (usuario.roles.length === 0)
    pendencias.push('Nenhum papel vinculado')
  if (usuario.companies.length === 0)
    pendencias.push('Nenhuma empresa vinculada')
  return pendencias
}

function calcularStatusUsuario(usuario: Usuario): StatusCadastro {
  return gerarPendenciasUsuario(usuario).length === 0 ? 'completo' : 'incompleto'
}

// ─── Constantes de abas ───────────────────────────────────────────────────────

const ABAS_USUARIO = [
  { id: 'dados', rotulo: 'Dados básicos' },
  { id: 'acesso', rotulo: 'Acesso' },
  { id: 'permissoes', rotulo: 'Permissões' },
]

const PREFIXO_ERRO_POR_CAMPO: Record<string, string> = {
  nome: 'Dados básicos',
  email: 'Dados básicos',
  senha: 'Dados básicos',
  papeis: 'Acesso',
  empresas: 'Acesso',
}

const ROTULO_POR_ABA: Record<string, string> = {
  dados: 'Dados básicos',
  acesso: 'Acesso',
  permissoes: 'Permissões',
}

const CAMPOS_POR_ABA: Record<string, string[]> = {
  dados: ['nome', 'email', 'senha'],
  acesso: ['papeis', 'empresas'],
  permissoes: [],
}

function gerarPendenciasDaAba(abaId: string, erros: Record<string, string>): string[] {
  const rotulo = ROTULO_POR_ABA[abaId]
  return Object.entries(erros)
    .filter(([campo]) => PREFIXO_ERRO_POR_CAMPO[campo] === rotulo)
    .map(([, msg]) => msg)
}

function abaEstaValida(abaId: string, erros: Record<string, string>): boolean {
  return gerarPendenciasDaAba(abaId, erros).length === 0
}

// ─── Componente principal ─────────────────────────────────────────────────────

function ConteudoDaPaginaDeUsuarios() {
  const roteador = useRouter()
  const { estaAutenticado, carregando: carregandoSessao, perfil } =
    useSessaoDoUsuario()

  // Dados carregados da API
  const [listaDeUsuarios, setListaDeUsuarios] = useState<Usuario[]>([])
  const [listaDePapeis, setListaDePapeis] = useState<Papel[]>([])
  const [listaDeEmpresas, setListaDeEmpresas] = useState<Empresa[]>([])
  const [listaDePermissoes, setListaDePermissoes] = useState<Permissao[]>([])
  const [listaDePaginasVinculaveis, setListaDePaginasVinculaveis] = useState<
    PaginaDoSistema[]
  >([])

  // Mensagens globais
  const [mensagemDeErro, setMensagemDeErro] = useState('')
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState('')

  // Loading states
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [alterandoStatusId, setAlterandoStatusId] = useState<string | null>(null)

  // Modal de criar/editar
  const [modalUsuarioAberto, setModalUsuarioAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [modoVisualizacao, setModoVisualizacao] = useState(false)
  const [idDoUsuarioEmEdicao, setIdDoUsuarioEmEdicao] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('dados')
  const [salvando, setSalvando] = useState(false)

  // Campos do formulário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cargo, setCargo] = useState('')
  const [idsDosPapeisSelecionados, setIdsDosPapeisSelecionados] = useState<string[]>([])
  const [idsDasEmpresasSelecionadas, setIdsDasEmpresasSelecionadas] = useState<string[]>([])
  const [idsDasPermissoesExtras, setIdsDasPermissoesExtras] = useState<string[]>([])
  const [chavesDasPaginasSelecionadas, setChavesDasPaginasSelecionadas] = useState<string[]>([])

  // Filtros da tabela
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [filtroPapel, setFiltroPapel] = useState('')
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<
    'nome' | 'cargo' | 'email' | 'status' | 'papeis' | 'cadastro'
  >()

  // Modais de ação
  const [usuarioParaDesativar, setUsuarioParaDesativar] = useState<Usuario | null>(null)
  const [usuarioParaResetarSenha, setUsuarioParaResetarSenha] = useState<Usuario | null>(null)
  const refBusca = useRef<HTMLInputElement>(null)

  const teclaNovo = useTeclaDaAcao('novo')
  const teclaSalvar = useTeclaDaAcao('salvar')
  const [novaSenhaReset, setNovaSenhaReset] = useState('')
  const [salvandoResetSenha, setSalvandoResetSenha] = useState(false)

  // Tooltip de pendências
  const [camposTocados, setCamposTocados] = useState<Set<string>>(() => new Set())
  const [erroSalvar, setErroSalvar] = useState('')
  const [errosDaAbaAtual, setErrosDaAbaAtual] = useState<string[]>([])
  const [formInicial, setFormInicial] = useState<FormularioUsuario>(() =>
    clonarFormulario(FORM_USUARIO_VAZIO)
  )

  const idsAbas = ['dados', 'acesso', 'permissoes']
  const indiceAbaAtiva = idsAbas.indexOf(abaAtiva)
  const ehPrimeiraAba = indiceAbaAtiva === 0
  const ehUltimaAba = indiceAbaAtiva === idsAbas.length - 1

  const formAtual = useMemo<FormularioUsuario>(
    () => ({
      nome,
      email,
      senha,
      cargo,
      idsDosPapeis: idsDosPapeisSelecionados,
      idsDasEmpresas: idsDasEmpresasSelecionadas,
      idsDasPermissoesExtras,
      chavesDasPaginas: chavesDasPaginasSelecionadas,
    }),
    [
      nome,
      email,
      senha,
      cargo,
      idsDosPapeisSelecionados,
      idsDasEmpresasSelecionadas,
      idsDasPermissoesExtras,
      chavesDasPaginasSelecionadas,
    ]
  )

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado || !perfil?.ehAdmin) return
    carregarDadosDaTela()
  }, [carregandoSessao, estaAutenticado, perfil])

  async function carregarDadosDaTela() {
    setCarregandoLista(true)
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
    } finally {
      setCarregandoLista(false)
    }
  }

  // ─── Filtro client-side ────────────────────────────────────────────────────

  const listaFiltrada = useMemo(() => {
    return listaDeUsuarios.filter((u) => {
      const matchBusca =
        !termoBusca.trim() ||
        textosContemTodosTermos([u.name, u.email], termoBusca)
      const matchStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativo' && u.active) ||
        (filtroStatus === 'inativo' && !u.active)
      const matchPapel =
        !filtroPapel ||
        u.roles.some((r) => r.role.id === filtroPapel)
      return matchBusca && matchStatus && matchPapel
    })
  }, [listaDeUsuarios, termoBusca, filtroStatus, filtroPapel])

  const listaExibida = useMemo(
    () =>
      ordenarLista(listaFiltrada, ordenacao, (usuario, coluna) => {
        switch (coluna) {
          case 'nome':
            return usuario.name
          case 'cargo':
            return usuario.cargo ?? ''
          case 'email':
            return usuario.email
          case 'status':
            return usuario.active ? 'Ativo' : 'Inativo'
          case 'papeis':
            return usuario.roles.map((r) => r.role.name).join(', ')
          case 'cadastro':
            return gerarPendenciasUsuario(usuario).length === 0 ? 1 : 0
        }
      }),
    [listaFiltrada, ordenacao]
  )

  // ─── Validação visual das abas ─────────────────────────────────────────────

  const statusDasAbas = useMemo(() => {
    const dadosValido = nome.trim().length >= 2 && emailValido(email)
    const acessoValido =
      idsDosPapeisSelecionados.length >= 1 && idsDasEmpresasSelecionadas.length >= 1

    return {
      dados: dadosValido ? ('valid' as const) : ('error' as const),
      acesso: acessoValido ? ('valid' as const) : ('error' as const),
      permissoes: 'valid' as const,
    }
  }, [nome, email, idsDosPapeisSelecionados, idsDasEmpresasSelecionadas])

  const errosForm = useMemo(() => {
    const erros: Record<string, string> = {}
    if (!nome.trim() || nome.trim().length < 2)
      erros.nome = 'Nome obrigatório (mínimo 2 caracteres)'
    if (!emailValido(email))
      erros.email = 'E-mail inválido'
    if (!modoEdicao && !senha)
      erros.senha = 'Senha obrigatória'
    if (senha && senha.trim().length < 6)
      erros.senha = 'Senha deve ter mínimo 6 caracteres'
    if (idsDosPapeisSelecionados.length === 0)
      erros.papeis = 'Selecione pelo menos um papel'
    if (idsDasEmpresasSelecionadas.length === 0)
      erros.empresas = 'Selecione pelo menos uma empresa'
    return erros
  }, [nome, email, senha, modoEdicao, idsDosPapeisSelecionados, idsDasEmpresasSelecionadas])

  const formularioValido = Object.keys(errosForm).length === 0

  const etapaAtualLiberada = abaEstaValida(abaAtiva, errosForm)

  const abasComStatus = ABAS_USUARIO.map((aba) => ({
    ...aba,
    status: statusDasAbas[aba.id as keyof typeof statusDasAbas],
  }))

  const etapasModalUsuario = ABAS_USUARIO.map(({ id, rotulo }) => ({ id, rotulo }))

  // ─── Helpers de formulário ─────────────────────────────────────────────────

  function alternarIdNaLista(listaAtual: string[], idParaAlternar: string) {
    return listaAtual.includes(idParaAlternar)
      ? listaAtual.filter((id) => id !== idParaAlternar)
      : [...listaAtual, idParaAlternar]
  }

  function tocarCampo(id: string) {
    setCamposTocados((anterior) => {
      if (anterior.has(id)) return anterior
      const proximo = new Set(anterior)
      proximo.add(id)
      return proximo
    })
  }

  function erroVisivel(campo: string): string | undefined {
    if (!camposTocados.has(campo)) return undefined
    return errosForm[campo]
  }

  function tocarCamposDaAba(abaId: string) {
    const campos = CAMPOS_POR_ABA[abaId] ?? []
    setCamposTocados((anterior) => {
      const proximo = new Set(anterior)
      for (const campo of campos) proximo.add(campo)
      return proximo
    })
  }

  function aoAvancar() {
    if (!abaEstaValida(abaAtiva, errosForm)) {
      tocarCamposDaAba(abaAtiva)
      setErrosDaAbaAtual(gerarPendenciasDaAba(abaAtiva, errosForm))
      return
    }

    setErrosDaAbaAtual([])
    setAbaAtiva((atual) => {
      const i = idsAbas.indexOf(atual)
      return i >= 0 && i < idsAbas.length - 1 ? idsAbas[i + 1] : atual
    })
  }

  function irParaAbaAnterior() {
    setErrosDaAbaAtual([])
    setAbaAtiva((atual) => {
      const i = idsAbas.indexOf(atual)
      return i > 0 ? idsAbas[i - 1] : atual
    })
  }

  function avancarAbaVisualizacao() {
    setAbaAtiva((atual) => {
      const i = idsAbas.indexOf(atual)
      return i >= 0 && i < idsAbas.length - 1 ? idsAbas[i + 1] : atual
    })
  }

  function aplicarFormulario(f: FormularioUsuario) {
    setNome(f.nome)
    setEmail(f.email)
    setSenha(f.senha)
    setCargo(f.cargo)
    setIdsDosPapeisSelecionados(f.idsDosPapeis)
    setIdsDasEmpresasSelecionadas(f.idsDasEmpresas)
    setIdsDasPermissoesExtras(f.idsDasPermissoesExtras)
    setChavesDasPaginasSelecionadas(f.chavesDasPaginas)
    setAbaAtiva('dados')
    setCamposTocados(new Set())
    setErroSalvar('')
    setErrosDaAbaAtual([])
  }

  function usuarioParaFormulario(usuario: Usuario): FormularioUsuario {
    return {
      nome: usuario.name,
      email: usuario.email,
      senha: '',
      cargo: usuario.cargo ?? '',
      idsDosPapeis: usuario.roles.map((item) => item.role.id),
      idsDasEmpresas: usuario.companies
        .map((item) => item.company.id)
        .filter((id) => listaDeEmpresas.some((e) => e.id === id)),
      idsDasPermissoesExtras: usuario.permissoesExtras.map(
        (item) => item.permission.id
      ),
      chavesDasPaginas: usuario.paginasPermitidas
        .map((item) => item.pageKey)
        .filter((chave) =>
          listaDePaginasVinculaveis.some((p) => p.chave === chave)
        ),
    }
  }

  function limparFormulario() {
    aplicarFormulario(FORM_USUARIO_VAZIO)
  }

  function abrirModalNovo() {
    const vazio = clonarFormulario(FORM_USUARIO_VAZIO)
    aplicarFormulario(vazio)
    setFormInicial(vazio)
    setModoEdicao(false)
    setModoVisualizacao(false)
    setIdDoUsuarioEmEdicao('')
    setModalUsuarioAberto(true)
  }

  function abrirModalEdicao(usuario: Usuario) {
    const f = usuarioParaFormulario(usuario)
    aplicarFormulario(f)
    setFormInicial(clonarFormulario(f))
    setModoEdicao(true)
    setModoVisualizacao(false)
    setIdDoUsuarioEmEdicao(usuario.id)
    setModalUsuarioAberto(true)
  }

  function abrirModalVisualizacao(usuario: Usuario) {
    const f = usuarioParaFormulario(usuario)
    aplicarFormulario(f)
    setFormInicial(clonarFormulario(f))
    setModoEdicao(false)
    setModoVisualizacao(true)
    setIdDoUsuarioEmEdicao(usuario.id)
    setModalUsuarioAberto(true)
  }

  function alternarParaEdicao() {
    setModoVisualizacao(false)
    setModoEdicao(true)
    setFormInicial(clonarFormulario(formAtual))
  }

  const fecharModalUsuario = useCallback(() => {
    setModalUsuarioAberto(false)
    setModoVisualizacao(false)
    setCamposTocados(new Set())
    setErroSalvar('')
    setErrosDaAbaAtual([])
  }, [])

  const { solicitarFechar, dialogoConfirmacao } = useConfirmarSaida(
    formAtual,
    formInicial,
    fecharModalUsuario
  )

  function atualizarUsuarioNaLista(usuarioAtualizado: Usuario) {
    setListaDeUsuarios((listaAtual) =>
      listaAtual.map((u) => (u.id === usuarioAtualizado.id ? usuarioAtualizado : u))
    )
  }

  // ─── Ações ─────────────────────────────────────────────────────────────────

  async function confirmarAlteracaoDeStatus() {
    if (!usuarioParaDesativar) return
    const novoStatus = !usuarioParaDesativar.active
    setAlterandoStatusId(usuarioParaDesativar.id)
    try {
      await clienteHttp.patch(`/users/${usuarioParaDesativar.id}/ativo`, {
        ativo: novoStatus,
      })
      setMensagemDeSucesso(novoStatus ? 'Usuário reativado.' : 'Usuário desativado.')
      setUsuarioParaDesativar(null)
      await carregarDadosDaTela()
    } catch (erro: unknown) {
      setMensagemDeErro(extrairMensagemDeErro(erro, 'Erro ao alterar status'))
    } finally {
      setAlterandoStatusId(null)
    }
  }

  async function aoSalvarUsuario(evento: FormEvent) {
    evento.preventDefault()
    setErroSalvar('')

    if (!formularioValido) {
      setCamposTocados(new Set(['nome', 'email', 'senha', 'papeis', 'empresas']))
      if (errosForm.papeis || errosForm.empresas) setAbaAtiva('acesso')
      else setAbaAtiva('dados')
      return
    }

    const corpo = {
      nome,
      email,
      cargo: cargo.trim() || undefined,
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
        await clienteHttp.post('/users', { ...corpo, senha })
        setMensagemDeSucesso('Usuário criado!')
        await carregarDadosDaTela()
      }
      fecharModalUsuario()
    } catch (erro: unknown) {
      setErroSalvar(extrairMensagemDeErro(erro, 'Erro ao salvar usuário'))
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

  const operacaoEmAndamento = salvando || alterandoStatusId !== null

  const usuarioEmVisualizacao = listaDeUsuarios.find((u) => u.id === idDoUsuarioEmEdicao)

  const fecharDialogsAbertos = useCallback(() => {
    if (modalUsuarioAberto) solicitarFechar()
    else if (usuarioParaDesativar) setUsuarioParaDesativar(null)
    else if (usuarioParaResetarSenha) setUsuarioParaResetarSenha(null)
  }, [
    modalUsuarioAberto,
    usuarioParaDesativar,
    usuarioParaResetarSenha,
    solicitarFechar,
  ])

  useRegistrarAtalhos(
    {
      buscar: () => refBusca.current?.focus(),
      novo: abrirModalNovo,
      atualizar: carregarDadosDaTela,
      salvar: () => submeterFormularioPorId('form-usuario'),
      cancelar: fecharDialogsAbertos,
    },
    {
      buscar:
        !modalUsuarioAberto &&
        !usuarioParaDesativar &&
        !usuarioParaResetarSenha,
      novo:
        !modalUsuarioAberto &&
        !usuarioParaDesativar &&
        !usuarioParaResetarSenha,
      atualizar:
        !modalUsuarioAberto &&
        !usuarioParaDesativar &&
        !usuarioParaResetarSenha &&
        !carregandoLista,
      salvar:
        modalUsuarioAberto && formularioValido && !salvando && !modoVisualizacao,
      cancelar:
        modalUsuarioAberto ||
        Boolean(usuarioParaDesativar) ||
        Boolean(usuarioParaResetarSenha),
    }
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-6">
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
                {salvandoResetSenha ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Salvando...
                  </span>
                ) : 'Redefinir senha'}
              </BotaoPrimario>
            </div>
          </div>
        </div>
      )}

      {dialogoConfirmacao}

      {/* Modal de criar/editar usuário */}
      <Modal
        aberto={modalUsuarioAberto}
        aoFechar={solicitarFechar}
        titulo={
          modoVisualizacao
            ? `Visualizar: ${nome || 'usuário'}`
            : modoEdicao
              ? `Editar: ${nome}`
              : 'Novo usuário'
        }
        largura="2xl"
        manterPosicao={!modoVisualizacao}
        alturaMinimaConteudo={!modoVisualizacao ? 'min-h-[420px]' : undefined}
        rodape={
          modoVisualizacao ? (
            <RodapeModalVisualizacao
              aoFechar={fecharModalUsuario}
              aoAnterior={irParaAbaAnterior}
              aoProximo={avancarAbaVisualizacao}
              mostrarAnterior={!ehPrimeiraAba}
              mostrarProximo={!ehUltimaAba}
              aoEditar={alternarParaEdicao}
              podeEditar
              aoAlternarStatus={() => {
                if (usuarioEmVisualizacao) {
                  fecharModalUsuario()
                  setUsuarioParaDesativar(usuarioEmVisualizacao)
                  setMensagemDeErro('')
                }
              }}
              podeDesativar
              registroAtivo={usuarioEmVisualizacao?.active ?? true}
              carregandoStatus={
                !!usuarioEmVisualizacao && alterandoStatusId === usuarioEmVisualizacao.id
              }
            />
          ) : (
            <RodapeModalFormulario
              formId="form-usuario"
              rotuloSalvar={modoEdicao ? 'Salvar' : 'Criar usuário'}
              salvando={salvando}
              podeSalvar={formularioValido}
              titleSalvar={tituloComAtalho(modoEdicao ? 'Salvar' : 'Criar usuário', teclaSalvar)}
              aoAnterior={irParaAbaAnterior}
              mostrarAnterior={!ehPrimeiraAba}
              aoProximo={aoAvancar}
              mostrarProximo={!ehUltimaAba}
              podeProximo={etapaAtualLiberada}
              desabilitado={salvando}
            />
          )
        }
      >
        {!modoVisualizacao && (
          <IndicadorEtapasModal
            etapas={etapasModalUsuario}
            etapaAtiva={abaAtiva}
            className="mb-4"
          />
        )}

        {!modoVisualizacao && (errosDaAbaAtual.length > 0 || erroSalvar) && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erroSalvar ? (
              <p>{erroSalvar}</p>
            ) : (
              <ul className="space-y-0.5">
                {errosDaAbaAtual.map((erro, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span>{erro}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!modoVisualizacao &&
          !etapaAtualLiberada &&
          !ehUltimaAba &&
          errosDaAbaAtual.length === 0 && (
            <p className="mb-4 text-xs text-muted-foreground">
              Preencha os campos obrigatórios desta etapa para continuar
            </p>
          )}

        <Abas
          abas={abasComStatus}
          abaAtiva={abaAtiva}
          aoMudar={setAbaAtiva}
          className="mb-5"
        />

        <div className="relative">
          {salvando && (
            <div className="absolute inset-0 z-10 rounded-md bg-background/60 backdrop-blur-[1px]" />
          )}
        <form id="form-usuario" onSubmit={aoSalvarUsuario}>
          <fieldset disabled={modoVisualizacao} className="m-0 min-w-0 border-0 p-0">
          <div key={abaAtiva} className="transition-opacity duration-150">
          {/* Aba 1: Dados básicos */}
          {abaAtiva === 'dados' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputPadrao
                  rotulo="Nome"
                  value={nome}
                  onChange={(e) => { tocarCampo('nome'); setNome(e.target.value) }}
                  onBlur={() => tocarCampo('nome')}
                  mensagemDeErro={erroVisivel('nome')}
                  required
                />
                <InputPadrao
                  rotulo="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => { tocarCampo('email'); setEmail(e.target.value) }}
                  onBlur={() => tocarCampo('email')}
                  mensagemDeErro={erroVisivel('email')}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputPadrao
                  rotulo="Cargo / Função"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Vendedor, Analista Financeiro"
                  maxLength={100}
                />
                {!modoVisualizacao && (
                <InputPadrao
                  rotulo={
                    modoEdicao
                      ? 'Nova senha (deixe vazio para não alterar)'
                      : 'Senha'
                  }
                  type="password"
                  value={senha}
                  onChange={(e) => { tocarCampo('senha'); setSenha(e.target.value) }}
                  onBlur={() => tocarCampo('senha')}
                  mensagemDeErro={erroVisivel('senha')}
                  required={!modoEdicao}
                  placeholder="Mínimo 6 caracteres"
                />
                )}
              </div>
              {!modoVisualizacao && (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Após preencher os dados básicos, avance para a aba{' '}
                  <strong>Acesso</strong> para vincular papéis e empresas.
                </p>
              </div>
              )}
            </div>
          )}

          {/* Aba 2: Acesso */}
          {abaAtiva === 'acesso' && (
            <div className="min-w-0 space-y-6">
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
            <div className="min-w-0 space-y-6">
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
          </div>
          </fieldset>
        </form>
        </div>
      </Modal>

      {/* Tabela de usuários */}
      <CardPadrao
        titulo="Usuários"
        descricao="Lista de todos os usuários do sistema"
        acoes={
          <div className="flex gap-2">
            <BotaoPrimario
              type="button"
              onClick={abrirModalNovo}
              title={tituloComAtalho('Novo usuário', teclaNovo)}
            >
              + Novo usuário
            </BotaoPrimario>
          </div>
        }
      >
        {/* Barra de busca e filtros */}
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            ref={refBusca}
            {...atributosCampoBuscaLista('busca-lista-usuarios')}
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className={cn(classesCampoLista, 'min-w-[200px] flex-1')}
          />
          <Select
            className="h-9 w-auto"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
          >
            <option value="todos" className={classesOption}>Todos os status</option>
            <option value="ativo" className={classesOption}>Ativo</option>
            <option value="inativo" className={classesOption}>Inativo</option>
          </Select>
          <Select
            className="h-9 w-auto"
            value={filtroPapel}
            onChange={(e) => setFiltroPapel(e.target.value)}
          >
            <option value="" className={classesOption}>Todos os papéis</option>
            {listaDePapeis.map((p) => (
              <option key={p.id} value={p.id} className={classesOption}>
                {p.name}
              </option>
            ))}
          </Select>
          {(termoBusca || filtroStatus !== 'todos' || filtroPapel) && (
            <button
              type="button"
              onClick={() => {
                setTermoBusca('')
                setFiltroStatus('todos')
                setFiltroPapel('')
              }}
              className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <colgroup>
              <col />
              <col className="w-[8rem]" />
              <col />
              <col className="w-[4.5rem]" />
              <col className="w-[10rem]" />
              <col className="w-[5.5rem]" />
              <col className="w-[3rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <CabecalhoColunaOrdenavel className="px-2 py-2" rotulo="Nome" coluna="nome" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-2 py-2" rotulo="Cargo" coluna="cargo" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-2 py-2" rotulo="Email" coluna="email" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-2 py-2" rotulo="Status" coluna="status" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-2 py-2" rotulo="Papéis" coluna="papeis" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <CabecalhoColunaOrdenavel className="px-2 py-2" rotulo="Cadastro" coluna="cadastro" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                <th className="px-2 py-2 text-left font-medium">
                  <span className="sr-only">Mais</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Skeleton de carregamento */}
              {carregandoLista &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-2 py-2">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!carregandoLista && listaExibida.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {listaDeUsuarios.length === 0
                      ? 'Nenhum usuário cadastrado.'
                      : 'Nenhum usuário encontrado com os filtros aplicados.'}
                  </td>
                </tr>
              )}

              {!carregandoLista &&
                listaExibida.map((usuario) => {
                  const pendencias = gerarPendenciasUsuario(usuario)
                  const statusCadastro = pendencias.length === 0 ? 'completo' : 'incompleto'
                  const esteAlterando = alterandoStatusId === usuario.id

                  return (
                    <LinhaTabelaClicavel
                      key={usuario.id}
                      ariaLabel={`Visualizar ${usuario.name}`}
                      desabilitada={esteAlterando}
                      aoClicar={() => abrirModalVisualizacao(usuario)}
                    >
                      <td className="max-w-0 truncate px-2 py-2 font-medium">{usuario.name}</td>
                      <td className="max-w-0 truncate px-2 py-2 text-muted-foreground">
                        {usuario.cargo || (
                          <span className="italic text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="max-w-0 truncate px-2 py-2 text-muted-foreground">
                        {usuario.email}
                      </td>
                      <CelulaBadge>
                        <BadgeStatus variante={usuario.active ? 'ativo' : 'inativo'}>
                          {usuario.active ? 'Ativo' : 'Inativo'}
                        </BadgeStatus>
                      </CelulaBadge>
                      <td className="max-w-0 truncate px-2 py-2 text-muted-foreground">
                        {usuario.roles.map((r) => r.role.name).join(', ')}
                      </td>
                      <td
                        className="overflow-hidden px-2 py-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="min-w-0 max-w-full">
                          <BadgeCadastro
                            completo={statusCadastro === 'completo'}
                            pendencias={pendencias}
                          />
                        </div>
                      </td>
                      <td
                        className="w-12 px-2 py-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <MenuAcoesLinha
                          carregando={esteAlterando}
                          ariaLabel={`Mais opções para ${usuario.name}`}
                          itens={[
                            {
                              rotulo: 'Redefinir senha',
                              icone: KeyRound,
                              onClick: () => {
                                setUsuarioParaResetarSenha(usuario)
                                setNovaSenhaReset('')
                                setMensagemDeErro('')
                              },
                              desabilitado: operacaoEmAndamento,
                            },
                          ]}
                        />
                      </td>
                    </LinhaTabelaClicavel>
                  )
                })}
            </tbody>
          </table>
        </div>

        {!carregandoLista && listaFiltrada.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {listaFiltrada.length} de {listaDeUsuarios.length} usuário
            {listaDeUsuarios.length === 1 ? '' : 's'}
          </p>
        )}
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
