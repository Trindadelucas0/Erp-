/**
 * Ponto de entrada da API do ERP.
 * Carrega o .env, monta DATABASE_URL e inicia o servidor.
 */
import { config } from 'dotenv'
import { definirUrlDoBancoNoAmbiente } from './compartilhado/banco-dados/montar-url-do-banco.js'
import { criarServidor } from './infraestrutura/http/servidor.js'

config()
definirUrlDoBancoNoAmbiente()

const porta = Number(process.env.PORT) || 3333

const aplicacao = await criarServidor()

try {
  await aplicacao.listen({ port: porta, host: '0.0.0.0' })
  console.log(`API rodando em http://localhost:${porta}`)
} catch (erro) {
  aplicacao.log.error(erro)
  process.exit(1)
}
