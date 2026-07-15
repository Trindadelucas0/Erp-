/**
 * Ponto de entrada da API do ERP.
 * Carrega o .env, monta DATABASE_URL e inicia o servidor.
 */
import { config } from 'dotenv'
import { definirUrlDoBancoNoAmbiente } from './compartilhado/banco-dados/montar-url-do-banco.js'
import { criarServidor } from './infraestrutura/http/servidor.js'

config()
definirUrlDoBancoNoAmbiente()

process.on('unhandledRejection', (erro) => {
  console.error('[aplicacao] Promise rejeitada sem tratamento:', erro)
})

process.on('uncaughtException', (erro) => {
  console.error('[aplicacao] Exceção não capturada:', erro)
})

const porta = Number(process.env.PORT) || 8885

const aplicacao = await criarServidor()

try {
  await aplicacao.listen({ port: porta, host: '0.0.0.0' })
  console.log(`API rodando em http://localhost:${porta}`)
} catch (erro) {
  aplicacao.log.error(erro)
  process.exit(1)
}
