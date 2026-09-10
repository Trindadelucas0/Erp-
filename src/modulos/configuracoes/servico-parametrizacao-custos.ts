import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioParametrizacaoCustos } from './repositorio-parametrizacao-custos.js'
import {
  somarTotalVenda,
  type DadosParametrizacaoCustos,
} from './esquema-parametrizacao-custos.js'

function exigirEmpresa(companyId: string) {
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
}

function decimalNum(valor: unknown): number | null {
  if (valor == null) return null
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : null
}

function paraResposta(
  registro: {
    id: string
    companyId: string
    pis: unknown
    cofins: unknown
    impRendaSupSimples: unknown
    contribuicaoSocial: unknown
    custoFixo: unknown
    comissao: unknown
    jurosMensaisCustoFinanOperac: unknown
    aliquotaCbs: unknown
    aliquotaIbs: unknown
  } | null
) {
  const campos = {
    pis: decimalNum(registro?.pis),
    cofins: decimalNum(registro?.cofins),
    impRendaSupSimples: decimalNum(registro?.impRendaSupSimples),
    contribuicaoSocial: decimalNum(registro?.contribuicaoSocial),
    custoFixo: decimalNum(registro?.custoFixo),
    comissao: decimalNum(registro?.comissao),
    jurosMensaisCustoFinanOperac: decimalNum(registro?.jurosMensaisCustoFinanOperac),
    aliquotaCbs: decimalNum(registro?.aliquotaCbs),
    aliquotaIbs: decimalNum(registro?.aliquotaIbs),
  }
  return {
    id: registro?.id ?? null,
    ...campos,
    totalVenda: somarTotalVenda(campos),
  }
}

async function obter(companyId: string) {
  exigirEmpresa(companyId)
  const registro = await repositorioParametrizacaoCustos.buscarDaEmpresa(companyId)
  return paraResposta(registro)
}

async function gravar(companyId: string, dados: DadosParametrizacaoCustos, usuarioId: string) {
  exigirEmpresa(companyId)
  const antes = await repositorioParametrizacaoCustos.buscarDaEmpresa(companyId)
  const registro = await repositorioParametrizacaoCustos.upsert(companyId, dados)
  await registrarAuditoria({
    usuarioId,
    acao: antes ? 'atualizar' : 'criar',
    entidade: 'ParametrizacaoCustoVenda',
    entidadeId: registro.id,
    valoresAntes: antes
      ? {
          pis: decimalNum(antes.pis),
          cofins: decimalNum(antes.cofins),
          custoFixo: decimalNum(antes.custoFixo),
        }
      : null,
    valoresDepois: {
      pis: decimalNum(registro.pis),
      cofins: decimalNum(registro.cofins),
      custoFixo: decimalNum(registro.custoFixo),
    },
  })
  return paraResposta(registro)
}

export const servicoParametrizacaoCustos = {
  obter,
  gravar,
}
