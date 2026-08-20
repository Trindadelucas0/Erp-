/**
 * Ponto de entrada da API do ERP.
 * Carrega o .env, monta DATABASE_URL e inicia o servidor.
 */
import { config } from 'dotenv'
import { definirUrlDoBancoNoAmbiente } from './compartilhado/banco-dados/montar-url-do-banco.js'
import { criarServidor } from './infraestrutura/http/servidor.js'
import { iniciarAgendadorFocusNfe } from './modulos/focus-nfe/agendador-focus-nfe.js'
import { iniciarWorkerJobs, workerJobsAtivoPorEnv } from './compartilhado/jobs/worker-jobs.js'

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

function lerAgendadorFocusAtivo(): boolean {
  const raw = (process.env.FOCUS_NFE_AGENDADOR ?? 'true').trim().toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'nao' || raw === 'não' || raw === 'off') {
    return false
  }
  return true
}

try {
  await aplicacao.listen({ port: porta, host: '0.0.0.0' })
  console.log(`API rodando em http://localhost:${porta}`)
  if (workerJobsAtivoPorEnv()) {
    iniciarWorkerJobs()
    console.log('Worker de jobs ativo (sync Focus e conferência por IA). Desligar: JOBS_WORKER=false')
  } else {
    console.log('Worker de jobs desligado (JOBS_WORKER=false). Nenhum job será processado.')
  }
  if (lerAgendadorFocusAtivo()) {
    iniciarAgendadorFocusNfe()
    console.log('Agendador Focus NFe ativo (sync ~2 min). Desligar: FOCUS_NFE_AGENDADOR=false')
  } else {
    console.log('Agendador Focus NFe desligado (FOCUS_NFE_AGENDADOR=false). Sync só via BUSCAR.')
  }
} catch (erro) {
  aplicacao.log.error(erro)
  process.exit(1)
}
