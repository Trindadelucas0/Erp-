/**
 * Regras de negócio para usuários.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { criptografarSenha } from '../../compartilhado/utilitarios/criptografia-senha.js'
import { repositorioDeUsuarios } from './repositorio-usuarios.js'
import {
  DadosParaCriarUsuario,
  DadosParaEditarUsuario,
} from './esquema-usuarios.js'

/**
 * Cria um novo usuário.
 */
async function criarUsuario(dados: DadosParaCriarUsuario) {
  const emailJaCadastrado = await repositorioDeUsuarios.buscarPorEmail(
    dados.email
  )

  if (emailJaCadastrado) {
    throw new ErroDaAplicacao('Email já cadastrado', 400)
  }

  const senhaCriptografada = await criptografarSenha(dados.senha)

  return repositorioDeUsuarios.criar({
    nome: dados.nome,
    email: dados.email,
    senhaCriptografada,
    idsDosPapeis: dados.idsDosPapeis,
    idsDasEmpresas: dados.idsDasEmpresas,
    idsDasPermissoesExtras: dados.idsDasPermissoesExtras ?? [],
  })
}

/**
 * Atualiza um usuário existente.
 */
async function editarUsuario(
  idDoUsuario: string,
  dados: DadosParaEditarUsuario
) {
  const usuarioExiste = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuarioExiste) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  const emailEmUso = await repositorioDeUsuarios.buscarPorEmail(dados.email)

  if (emailEmUso && emailEmUso.id !== idDoUsuario) {
    throw new ErroDaAplicacao('Email já cadastrado', 400)
  }

  let senhaCriptografada: string | undefined

  if (dados.senha) {
    senhaCriptografada = await criptografarSenha(dados.senha)
  }

  return repositorioDeUsuarios.atualizar(idDoUsuario, {
    nome: dados.nome,
    email: dados.email,
    senhaCriptografada,
    idsDosPapeis: dados.idsDosPapeis,
    idsDasEmpresas: dados.idsDasEmpresas,
    idsDasPermissoesExtras: dados.idsDasPermissoesExtras ?? [],
  })
}

/**
 * Ativa ou desativa um usuário.
 */
async function alterarStatusDoUsuario(
  idDoUsuario: string,
  ativo: boolean,
  idDoUsuarioLogado: string
) {
  if (idDoUsuario === idDoUsuarioLogado && !ativo) {
    throw new ErroDaAplicacao('Você não pode desativar seu próprio usuário', 400)
  }

  const usuarioExiste = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuarioExiste) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  return repositorioDeUsuarios.alterarStatus(idDoUsuario, ativo)
}

/**
 * Lista todos os usuários.
 */
async function listarUsuarios() {
  return repositorioDeUsuarios.listarTodos()
}

/**
 * Busca um usuário pelo ID.
 */
async function buscarUsuarioPorId(idDoUsuario: string) {
  const usuarioEncontrado =
    await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuarioEncontrado) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  return usuarioEncontrado
}

export const servicoDeUsuarios = {
  criarUsuario,
  editarUsuario,
  alterarStatusDoUsuario,
  listarUsuarios,
  buscarUsuarioPorId,
}
