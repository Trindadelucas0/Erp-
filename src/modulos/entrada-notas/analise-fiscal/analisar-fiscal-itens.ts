/**
 * Etapa 2 — Análise fiscal (NCM, origem; CST/CFOP com regras fiscais ativas).
 * NCM/origem: bloqueio liberável (importar da NF ou senha gerente).
 * CST/CFOP ausente: bloqueio não liberável (só desconhecimento/devolução).
 */
import {
  analisarFiscalBasico,
  type RegrasFiscaisJson,
} from '../analise-fiscal/analisar-fiscal-basico.js'
import type { ResultadoEtapa } from '../tipos-analise.js'

type ItemFiscal = {
  id: string
  produtoId: string | null
  ncm: string | null
  cfop: string | null
  cst: string | null
  origem: string | null
  produtoNcm?: string | null
  produtoOrigem?: string | null
}

function normalizar(valor?: string | null): string {
  return (valor ?? '').replace(/\D/g, '').trim()
}

export function analisarFiscalItens(params: {
  regras: RegrasFiscaisJson | null | undefined
  itens: ItemFiscal[]
}): {
  resultado: ResultadoEtapa
  itensCritica: Array<{ id: string; criticaFiscal: boolean }>
} {
  const gate = analisarFiscalBasico(params.regras)
  const avisos = [...gate.avisos]
  const bloqueios: string[] = []
  const bloqueiosNaoLiberaveis: string[] = []
  const regrasAtivas = params.regras?.ativo === true
  const checks = params.regras?.checks ?? []
  const checaNcm = !regrasAtivas || checks.includes('ncm')
  const checaOrigem = !regrasAtivas || checks.includes('origem')
  const itensCritica: Array<{ id: string; criticaFiscal: boolean }> = []

  for (const item of params.itens) {
    let critica = false
    if (!item.produtoId) {
      itensCritica.push({ id: item.id, criticaFiscal: false })
      continue
    }

    const ncmNf = normalizar(item.ncm)
    const ncmProd = normalizar(item.produtoNcm)
    if (checaNcm && ncmNf && ncmNf !== ncmProd) {
      const msg = ncmProd
        ? `NCM diverge (NF ${ncmNf} × produto ${ncmProd}).`
        : `Produto sem NCM (NF ${ncmNf}).`
      if (regrasAtivas) {
        bloqueios.push(msg + ' Importe o NCM da NF para o produto ou libere com senha de gerente.')
        critica = true
      } else {
        avisos.push(msg + ' Pode importar da NF para o produto.')
      }
    }

    const origNf = (item.origem ?? '').trim()
    const origProd = (item.produtoOrigem ?? '').trim()
    if (checaOrigem && origNf && origNf !== origProd) {
      const msg = origProd
        ? `Código de origem diverge (NF ${origNf} × produto ${origProd}).`
        : `Produto sem código de origem (NF ${origNf}).`
      if (regrasAtivas) {
        bloqueios.push(
          msg + ' Importe a origem da NF para o produto ou libere com senha de gerente.'
        )
        critica = true
      } else {
        avisos.push(msg + ' Pode importar da NF para o produto.')
      }
    }

    if (regrasAtivas) {
      if (checks.includes('cst_cfop') || checks.includes('cfop') || checks.includes('cst')) {
        if (!item.cfop) {
          bloqueiosNaoLiberaveis.push(
            'Item sem CFOP na NF — não é possível prosseguir; use desconhecimento da operação ou devolução.'
          )
          critica = true
        }
        if (!item.cst) {
          bloqueiosNaoLiberaveis.push(
            'Item sem CST/CSOSN na NF — não é possível prosseguir; use desconhecimento da operação ou devolução.'
          )
          critica = true
        }
      }
    }

    itensCritica.push({ id: item.id, criticaFiscal: critica })
  }

  const todosBloqueios = [...bloqueios, ...bloqueiosNaoLiberaveis]
  const exigeManifesto = bloqueiosNaoLiberaveis.length > 0
  const status =
    todosBloqueios.length > 0
      ? 'bloqueante'
      : avisos.length > 0
        ? 'aviso'
        : gate.status === 'ok'
          ? 'ok'
          : 'aviso'

  return {
    resultado: {
      status,
      avisos,
      bloqueios: todosBloqueios,
      bloqueiosNaoLiberaveis,
      exigeManifesto,
    },
    itensCritica,
  }
}
