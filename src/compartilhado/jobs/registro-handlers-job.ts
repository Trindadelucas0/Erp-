/**
 * Registro tipo → handler. Cada módulo registra o seu no import, o que evita
 * o worker importar (e acoplar) todos os serviços do ERP.
 */
import type { HandlerJob, TipoJob } from './tipos-job.js'

const handlers = new Map<string, HandlerJob>()

export function registrarHandlerJob(tipo: TipoJob, handler: HandlerJob): void {
  handlers.set(tipo, handler)
}

export function obterHandlerJob(tipo: string): HandlerJob | undefined {
  return handlers.get(tipo)
}

export function tiposRegistrados(): string[] {
  return [...handlers.keys()]
}
