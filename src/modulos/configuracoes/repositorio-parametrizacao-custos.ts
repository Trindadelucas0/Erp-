import { randomUUID } from 'crypto'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { DadosParametrizacaoCustos } from './esquema-parametrizacao-custos.js'

function decimalOuNull(valor: number | null | undefined): number | null {
  if (valor == null || !Number.isFinite(valor)) return null
  return valor
}

async function buscarPorCompetencia(companyId: string, competencia: string) {
  return clientePrisma.parametrizacaoCustoVenda.findUnique({
    where: { companyId_competencia: { companyId, competencia } },
  })
}

async function upsert(
  companyId: string,
  dados: DadosParametrizacaoCustos
) {
  const campos = {
    pis: decimalOuNull(dados.pis),
    cofins: decimalOuNull(dados.cofins),
    impRendaSupSimples: decimalOuNull(dados.impRendaSupSimples),
    contribuicaoSocial: decimalOuNull(dados.contribuicaoSocial),
    custoFixo: decimalOuNull(dados.custoFixo),
    comissao: decimalOuNull(dados.comissao),
    jurosMensaisCustoFinanOperac: decimalOuNull(dados.jurosMensaisCustoFinanOperac),
    aliquotaCbs: decimalOuNull(dados.aliquotaCbs),
    aliquotaIbs: decimalOuNull(dados.aliquotaIbs),
  }

  return clientePrisma.parametrizacaoCustoVenda.upsert({
    where: { companyId_competencia: { companyId, competencia: dados.competencia } },
    create: {
      id: randomUUID(),
      companyId,
      competencia: dados.competencia,
      ...campos,
    },
    update: campos,
  })
}

export const repositorioParametrizacaoCustos = {
  buscarPorCompetencia,
  upsert,
}
