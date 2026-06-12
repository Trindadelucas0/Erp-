/**
 * Controlador de autenticação — recebe requisições HTTP de login e perfil.
 */
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { gerarTokenDeAutenticacao } from '../../compartilhado/utilitarios/token-jwt.js'
import { servicoDeAutenticacao } from './servico-autenticacao.js'
import { esquemaDeLogin } from './esquema-autenticacao.js'

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
 */
async function verificarSenha(requisicao: FastifyRequest, resposta: FastifyReply) {
  const idDoUsuario = requisicao.idDoUsuario!
  const { senha } = requisicao.body as { senha?: string }

  if (!senha) {
    throw new ErroDaAplicacao('Senha é obrigatória', 400)
  }

  const senhaCorreta = await servicoDeAutenticacao.verificarSenhaDoUsuario(
    idDoUsuario,
    senha
  )

  if (!senhaCorreta) {
    throw new ErroDaAplicacao('Senha incorreta', 401)
  }

  return resposta.send({ valido: true })
}

export const controladorDeAutenticacao = {
  fazerLogin,
  buscarMeuPerfil,
  verificarSenha,
}
