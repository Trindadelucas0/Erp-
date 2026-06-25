/**
 * Controlador de autenticação — recebe requisições HTTP de login e perfil.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  gerarTokenDeAutenticacao,
  gerarTokenDeReautenticacao,
  ESCOPO_REAUTH_ASSINATURA,
} from '../../compartilhado/utilitarios/token-jwt.js'
import { servicoDeAutenticacao } from './servico-autenticacao.js'
import { esquemaDeLogin, esquemaDeTema } from './esquema-autenticacao.js'
import { usuarioEhAdmin } from '../../compartilhado/paginas/registro-de-paginas.js'
import { repositorioDeUsuarios } from '../usuarios/repositorio-usuarios.js'

/**
 * Recebe email e senha, valida e devolve token JWT.
 * @param requisicao - Body com email e senha
 * @param resposta - Objeto para enviar a resposta HTTP
 * @returns JSON com o token de autenticação
 */
async function fazerLogin(requisicao: FastifyRequest, resposta: FastifyReply) {
  const resultadoDaValidacao = esquemaDeLogin.safeParse(requisicao.body)

  if (!resultadoDaValidacao.success) {
    throw new ErroDaAplicacao(
      resultadoDaValidacao.error.errors[0].message,
      400
    )
  }

  const { idDoUsuario, tokenVersion } = await servicoDeAutenticacao.realizarLogin(
    resultadoDaValidacao.data
  )

  const token = await gerarTokenDeAutenticacao(resposta, idDoUsuario, tokenVersion)

  return resposta.send({ token })
}

/**
 * Retorna dados do usuário que está logado.
 * @param requisicao - Requisição com idDoUsuario no middleware
 * @param resposta - Objeto para enviar a resposta HTTP
 * @returns JSON com usuario, permissoes e empresas
 */
async function buscarMeuPerfil(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const idDoUsuario = requisicao.idDoUsuario

  if (!idDoUsuario) {
    throw new ErroDaAplicacao('Não autenticado', 401)
  }

  const perfil =
    await servicoDeAutenticacao.buscarPerfilDoUsuarioLogado(idDoUsuario)

  return resposta.send(perfil)
}

/**
 * Verifica a senha do usuário logado para confirmar ações críticas.
 * Quando escopo === 'assinatura-documentos', exige admin e devolve um token
 * de reautenticação de curta duração (15 min) para o cabeçalho X-Reauth-Token.
 */
async function verificarSenha(requisicao: FastifyRequest, resposta: FastifyReply) {
  const idDoUsuario = requisicao.idDoUsuario!
  const { senha, escopo } = requisicao.body as {
    senha?: string
    escopo?: string
  }

  if (!senha) {
    throw new ErroDaAplicacao('Senha é obrigatória', 400)
  }

  if (escopo === ESCOPO_REAUTH_ASSINATURA) {
    const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)
    if (!usuario || !usuarioEhAdmin(usuario.roles)) {
      throw new ErroDaAplicacao(
        'Acesso restrito ao administrador para esta ação',
        403
      )
    }
  }

  const senhaCorreta = await servicoDeAutenticacao.verificarSenhaDoUsuario(
    idDoUsuario,
    senha
  )

  if (!senhaCorreta) {
    throw new ErroDaAplicacao('Senha incorreta', 401)
  }

  if (escopo === ESCOPO_REAUTH_ASSINATURA) {
    const tokenReauth = await gerarTokenDeReautenticacao(resposta, idDoUsuario)
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    return resposta.send({ valido: true, tokenReauth, expiraEm })
  }

  return resposta.send({ valido: true })
}

async function atualizarTema(
  requisicao: FastifyRequest,
  resposta: FastifyReply
) {
  const idDoUsuario = requisicao.idDoUsuario

  if (!idDoUsuario) {
    throw new ErroDaAplicacao('Não autenticado', 401)
  }

  const resultadoDaValidacao = esquemaDeTema.safeParse(requisicao.body)

  if (!resultadoDaValidacao.success) {
    throw new ErroDaAplicacao(
      resultadoDaValidacao.error.errors[0].message,
      400
    )
  }

  const tema = await servicoDeAutenticacao.atualizarTemaDoUsuario(
    idDoUsuario,
    resultadoDaValidacao.data.tema
  )

  return resposta.send({ tema })
}

export const controladorDeAutenticacao = {
  fazerLogin,
  buscarMeuPerfil,
  verificarSenha,
  atualizarTema,
}
