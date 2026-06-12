/**
 * Regras de negócio para usuários.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { paginaVinculavelExiste } from '../../compartilhado/paginas/registro-de-paginas.js'
import { criptografarSenha } from '../../compartilhado/utilitarios/criptografia-senha.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioDeUsuarios } from './repositorio-usuarios.js'
import {
  DadosParaCriarUsuario,
  DadosParaEditarUsuario,
} from './esquema-usuarios.js'

function validarChavesDasPaginasPermitidas(chaves: string[]) {
  const chavesInvalidas = chaves.filter((chave) => !paginaVinculavelExiste(chave))

  if (chavesInvalidas.length > 0) {
    throw new ErroDaAplicacao(
      `Páginas inválidas: ${chavesInvalidas.join(', ')}`,
      400
    )
  }

  return chaves
}

async function criarUsuario(dados: DadosParaCriarUsuario, idDoAutor: string) {
  const emailJaCadastrado = await repositorioDeUsuarios.buscarPorEmail(dados.email)

  if (emailJaCadastrado) {
    throw new ErroDaAplicacao('Email já cadastrado', 400)
  }

  const senhaCriptografada = await criptografarSenha(dados.senha)
  const chavesDasPaginasPermitidas = validarChavesDasPaginasPermitidas(
    dados.chavesDasPaginasPermitidas ?? []
  )

  const usuarioCriado = await repositorioDeUsuarios.criar({
    nome: dados.nome,
    email: dados.email,
    senhaCriptografada,
    idsDosPapeis: dados.idsDosPapeis,
    idsDasEmpresas: dados.idsDasEmpresas,
    idsDasPermissoesExtras: dados.idsDasPermissoesExtras ?? [],
    chavesDasPaginasPermitidas,
  })

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'usuario',
    entidadeId: usuarioCriado.id,
    valoresDepois: { nome: dados.nome, email: dados.email },
  })

  return usuarioCriado
}

async function editarUsuario(
  idDoUsuario: string,
  dados: DadosParaEditarUsuario,
  idDoAutor: string
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

  const chavesDasPaginasPermitidas = validarChavesDasPaginasPermitidas(
    dados.chavesDasPaginasPermitidas ?? []
  )

  const usuarioAtualizado = await repositorioDeUsuarios.atualizar(idDoUsuario, {
    nome: dados.nome,
    email: dados.email,
    senhaCriptografada,
    idsDosPapeis: dados.idsDosPapeis,
    idsDasEmpresas: dados.idsDasEmpresas,
    idsDasPermissoesExtras: dados.idsDasPermissoesExtras ?? [],
    chavesDasPaginasPermitidas,
  })

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'usuario',
    entidadeId: idDoUsuario,
    valoresAntes: { nome: usuarioExiste.name, email: usuarioExiste.email },
    valoresDepois: { nome: dados.nome, email: dados.email },
  })

  return usuarioAtualizado
}

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

  const resultado = await repositorioDeUsuarios.alterarStatus(idDoUsuario, ativo)

  await registrarAuditoria({
    usuarioId: idDoUsuarioLogado,
    acao: ativo ? 'ativar' : 'desativar',
    entidade: 'usuario',
    entidadeId: idDoUsuario,
    valoresAntes: { ativo: usuarioExiste.active },
    valoresDepois: { ativo },
  })

  return resultado
}

async function listarUsuarios() {
  return repositorioDeUsuarios.listarTodos()
}

async function buscarUsuarioPorId(idDoUsuario: string) {
  const usuarioEncontrado = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuarioEncontrado) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  return usuarioEncontrado
}

async function resetarSenhaPorAdmin(
  idDoUsuario: string,
  novaSenha: string,
  idDoAutor: string
) {
  const usuarioExiste = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuarioExiste) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  const senhaCriptografada = await criptografarSenha(novaSenha)
  const resultado = await repositorioDeUsuarios.atualizarSenha(idDoUsuario, senhaCriptografada)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'resetar_senha',
    entidade: 'usuario',
    entidadeId: idDoUsuario,
  })

  return resultado
}

export const servicoDeUsuarios = {
  criarUsuario,
  editarUsuario,
  alterarStatusDoUsuario,
  listarUsuarios,
  buscarUsuarioPorId,
  resetarSenhaPorAdmin,
}
