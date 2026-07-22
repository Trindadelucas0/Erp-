/**
 * Agendador Focus (opcional): sync incremental a cada 2 min.
 * **Desligado por padrão** — não é iniciado em `aplicacao.ts` (cota plano básico).
 * Sync sob demanda: botão BUSCAR na Entrada de Notas (sync + completar + vincular).
 * Para reativar em ambiente com cota folgada: chamar `iniciarAgendadorFocusNfe()` após o listen.
 */
import { empresaFocusEmAndamento } from './fila-focus-nfe.js'
import { logFocus } from './logs-focus-nfe.js'
import { repositorioFocusNfe } from './repositorio-focus-nfe.js'
import { servicoFocusNfe } from './servico-focus-nfe.js'

const INTERVALO_MS = 120_000
let timer: ReturnType<typeof setInterval> | null = null
let rodandoTick = false

async function tickAgendadorFocus() {
  if (rodandoTick) return
  rodandoTick = true
  try {
    const companyIds = await repositorioFocusNfe.listarCompanyIdsComFocusAtivo()
    for (const companyId of companyIds) {
      if (empresaFocusEmAndamento(companyId)) continue
      try {
        const job = await servicoFocusNfe.enfileirarSync(companyId, { completo: false })
        logFocus('info', 'agendador_sync', { companyId, jobId: job.jobId })
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : String(erro)
        // 409 / sem token — silencioso
        if (!msg.includes('em andamento') && !msg.includes('não configurado')) {
          logFocus('warn', 'agendador_sync_falhou', { companyId, mensagem: msg })
        }
      }
    }
  } catch (erro) {
    logFocus('error', 'agendador_tick_erro', {
      mensagem: erro instanceof Error ? erro.message : String(erro),
    })
  } finally {
    rodandoTick = false
  }
}

export function iniciarAgendadorFocusNfe() {
  if (timer) return
  logFocus('info', 'agendador_inicio', { intervaloMs: INTERVALO_MS })
  // Primeiro tick após 30s (dá tempo do servidor subir)
  setTimeout(() => {
    void tickAgendadorFocus()
  }, 30_000)
  timer = setInterval(() => {
    void tickAgendadorFocus()
  }, INTERVALO_MS)
}

export function pararAgendadorFocusNfe() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
