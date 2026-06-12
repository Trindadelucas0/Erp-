/**
 * Regras de negócio de autenticação (login e perfil do usuário).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { compararSenhaComHash } from '../../compartilhado/utilitarios/criptografia-senha.js'
import { repositorioDeUsuarios } from '../usuarios/repositorio-usuarios.js'
import { repositorioDePermissoes } from '../permissoes/repositorio-permissoes.js'
import { repositorioDeEmpresas } from '../empresas/repositorio-empresas.js'
import {
  montarPaginasPermitidasParaUsuario,
  usuarioEhAdmin,
} from '../../compartilhado/paginas/registro-de-paginas.js'
import { DadosDeLogin } from './esquema-autenticacao.js'

/**
 * Valida email e senha e retorna o ID do usuário autenticado.
 * @param dadosDeLogin - Email e senha enviados no body
 * @returns Objeto com idDoUsuario
 */
async function realizarLogin(dadosDeLogin: DadosDeLogin) {
  const usuarioEncontrado = await repositorioDeUsuarios.buscarPorEmail(
    dadosDeLogin.email
  )

  if (!usuarioEncontrado || !usuarioEncontrado.active) {
    throw new ErroDaAplicacao('Email ou senha incorretos', 401)
  }

  const senhaEstaCorreta = await compararSenhaComHash(
    dadosDeLogin.senha,
    usuarioEncontrado.password
  )

  if (!senhaEstaCorreta) {
    throw new ErroDaAplicacao('Email ou senha incorretos', 401)
  }

  return { idDoUsuario: usuarioEncontrado.id }
}

/**
 * Busca perfil completo do usuário logado.
 * @param idDoUsuario - ID extraído do token JWT
 * @returns Usuário, permissões dos papéis, extras e efetivas
 */
async function buscarPerfilDoUsuarioLogado(idDoUsuario: string) {
  const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuario) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  const permissoesDosPapeis =
    await repositorioDePermissoes.buscarChavesDosPapeisPorIdDoUsuario(idDoUsuario)
  const permissoesExtras =
    await repositorioDePermissoes.buscarChavesExtrasPorIdDoUsuario(idDoUsuario)
  const permissoesEfetivas =
    await repositorioDePermissoes.buscarChavesPorIdDoUsuario(idDoUsuario)
  const empresas =
    await repositorioDeEmpresas.buscarPorIdDoUsuario(idDoUsuario)

  const ehAdmin = usuarioEhAdmin(usuario.roles)
  const chavesDasPaginas = usuario.paginasPermitidas.map(
    (item) => item.pageKey
  )
  const paginasPermitidas = montarPaginasPermitidasParaUsuario(
    ehAdmin,
    chavesDasPaginas,
    permissoesEfetivas
  )

  return {
    usuario,
    ehAdmin,
    paginasPermitidas,
    permissoesDosPapeis,
    permissoesExtras,
    permissoesEfetivas,
    empresas,
  }
}

export const servicoDeAutenticacao = {
  realizarLogin,
  buscarPerfilDoUsuarioLogado,
}
