/**
 * Aplica o gate de recorrência financeira no pipeline da Entrada.
 * Fonte: DOCUMENTACAO-SISTEMA.md §7.23.
 * A regra só vale se a emissão da nota está na vigência; fora = fluxo normal.
 */
import { repositorioDeRecorrenciasFinanceiras } from '../recorrencias-financeiras/repositorio-recorrencias-financeiras.js'
import {
  casarRecorrencia,
  mensagemValorDivergenteRecorrencia,
  type ResultadoCasamentoRecorrencia,
} from '../recorrencias-financeiras/casar-recorrencia.js'
import { filtrarRecorrenciasNaVigencia } from '../recorrencias-financeiras/vigencia-recorrencia.js'
import { resolverParcelasRecorrencia } from '../contas-a-pagar/resolver-parcelas-recorrencia.js'

export type DecisaoRecorrenciaPipeline =
  | { acao: 'ignorar' }
  | {
      acao: 'casou'
      recorrenciaId: string
      produtoNome: string | null
      /** Documental (NFS-e / NFe sem produto): auto-consolidar após lançar. */
      autoConsolidar: boolean
    }
  | { acao: 'bloquear'; mensagem: string }

export async function avaliarRecorrenciaNoPipeline(input: {
  companyId: string
  fornecedorPessoaId: string | null
  valorTotal: unknown
  dataEmissao: Date | null
  xmlConteudo?: string | null
  prazoPagamentoXml?: string | null
  prazoPagamentoTexto?: string | null
  /** true = NFS-e ou NFe documental (sem contagem física). */
  documental: boolean
}): Promise<DecisaoRecorrenciaPipeline> {
  if (!input.fornecedorPessoaId) return { acao: 'ignorar' }

  const ativas = await repositorioDeRecorrenciasFinanceiras.listarAtivasPorFornecedor(
    input.companyId,
    input.fornecedorPessoaId
  )
  const naVigencia = filtrarRecorrenciasNaVigencia(ativas, input.dataEmissao)
  if (naVigencia.length === 0) return { acao: 'ignorar' }

  const match: ResultadoCasamentoRecorrencia = casarRecorrencia({
    fornecedorPessoaId: input.fornecedorPessoaId,
    valorTotal: Number(input.valorTotal ?? 0),
    recorrenciasAtivas: naVigencia.map((r) => ({
      id: r.id,
      valor: r.valor,
      produtoId: r.produtoId,
      produtoNome: r.produto?.nomeVenda ?? null,
    })),
  })

  if (match.status === 'sem_recorrencia') return { acao: 'ignorar' }

  if (match.status === 'valor_divergente') {
    return {
      acao: 'bloquear',
      mensagem: mensagemValorDivergenteRecorrencia(match.valorNota, match.esperados),
    }
  }

  // Casou — documental exige vencimento resolvível antes de consolidar.
  if (input.documental) {
    const parcelas = await resolverParcelasRecorrencia({
      companyId: input.companyId,
      fornecedorPessoaId: input.fornecedorPessoaId,
      valorTotal: Number(input.valorTotal ?? 0),
      dataEmissao: input.dataEmissao,
      xmlConteudo: input.xmlConteudo,
      prazoPagamentoXml: input.prazoPagamentoXml,
      prazoPagamentoTexto: input.prazoPagamentoTexto,
    })
    if (!parcelas.ok) {
      return { acao: 'bloquear', mensagem: parcelas.mensagem }
    }
  }

  return {
    acao: 'casou',
    recorrenciaId: match.recorrencia.id,
    produtoNome: match.recorrencia.produtoNome ?? null,
    autoConsolidar: input.documental,
  }
}
