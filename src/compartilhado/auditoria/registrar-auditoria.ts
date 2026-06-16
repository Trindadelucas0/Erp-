/**
 * Helper para registrar ações de auditoria no banco de dados.
 * Falhas silenciosas — auditoria nunca deve quebrar a operação principal.
 */
import { clientePrisma } from '../banco-dados/cliente-prisma.js'

export type DadosDeAuditoria = {
  usuarioId: string
  acao: string
  entidade: string
  entidadeId: string
  valoresAntes?: object | null
  valoresDepois?: object | null
}

export async function registrarAuditoria(dados: DadosDeAuditoria): Promise<void> {
  try {
    await clientePrisma.logDeAuditoria.create({
      data: {
        usuarioId: dados.usuarioId,
        acao: dados.acao,
        entidade: dados.entidade,
        entidadeId: dados.entidadeId,
        valoresAntes: dados.valoresAntes ?? undefined,
        valoresDepois: dados.valoresDepois ?? undefined,
      },
    })
  } catch {
    // Auditoria nunca deve interromper a operação
  }
}
