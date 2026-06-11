/**
 * Cria e configura o servidor Fastify com CORS, JWT e tratamento de erros.
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { TEMPO_DE_EXPIRACAO_DO_TOKEN } from '../../compartilhado/utilitarios/token-jwt.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarRotas } from './registrar-rotas.js'

/**
 * Monta o servidor HTTP pronto para receber requisições.
 * @returns Instância configurada do Fastify
 */
export async function criarServidor() {
  const aplicacao = Fastify({ logger: true })

  await aplicacao.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  const chaveSecretaJwt = process.env.JWT_SECRET
  if (!chaveSecretaJwt) {
    throw new Error('Configure JWT_SECRET no arquivo .env')
  }

  await aplicacao.register(jwt, {
    secret: chaveSecretaJwt,
    sign: { expiresIn: TEMPO_DE_EXPIRACAO_DO_TOKEN },
  })

  await registrarRotas(aplicacao)

  aplicacao.setErrorHandler((erro, _requisicao, resposta) => {
    const ehErroDaAplicacao =
      erro instanceof ErroDaAplicacao ||
      (erro instanceof Error &&
        erro.name === 'ErroDaAplicacao' &&
        'codigoHttp' in erro)

    if (ehErroDaAplicacao) {
      const erroDaAplicacao = erro as ErroDaAplicacao
      return resposta
        .status(erroDaAplicacao.codigoHttp)
        .send({ mensagem: erroDaAplicacao.message })
    }

    aplicacao.log.error(erro)
    return resposta.status(500).send({ mensagem: 'Erro interno do servidor' })
  })

  return aplicacao
}
