/**
 * Cria e configura o servidor Fastify com CORS, JWT e tratamento de erros.
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { TEMPO_DE_EXPIRACAO_DO_TOKEN } from '../../compartilhado/utilitarios/token-jwt.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarRotas } from './registrar-rotas.js'
import {
  ehProducao,
  marcarMensagemDeErro,
  registrarHooksDeLog,
} from './logs-http.js'

/**
 * Monta o servidor HTTP pronto para receber requisições.
 * @returns Instância configurada do Fastify
 */
export async function criarServidor() {
  const producao = ehProducao()

  const aplicacao = Fastify({
    logger: producao ? true : { level: 'warn' },
    disableRequestLogging: !producao,
  })

  if (!producao) {
    registrarHooksDeLog(aplicacao)
  }

  await aplicacao.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'X-Reauth-Token'],
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

  aplicacao.setErrorHandler((erro, requisicao, resposta) => {
    const ehErroDaAplicacao =
      erro instanceof ErroDaAplicacao ||
      (erro instanceof Error &&
        erro.name === 'ErroDaAplicacao' &&
        'codigoHttp' in erro)

    if (ehErroDaAplicacao) {
      const erroDaAplicacao = erro as ErroDaAplicacao
      marcarMensagemDeErro(requisicao, erroDaAplicacao.message)
      return resposta
        .status(erroDaAplicacao.codigoHttp)
        .send({ mensagem: erroDaAplicacao.message })
    }

    const mensagem =
      erro instanceof Error ? erro.message : 'Erro interno do servidor'
    marcarMensagemDeErro(requisicao, mensagem)

    // Resumo fica no onResponse; aqui só stack / JSON de produção
    if (producao) {
      aplicacao.log.error(erro)
    } else if (erro instanceof Error && erro.stack) {
      console.error(erro.stack)
    } else {
      console.error(erro)
    }

    return resposta.status(500).send({ mensagem: 'Erro interno do servidor' })
  })

  return aplicacao
}
