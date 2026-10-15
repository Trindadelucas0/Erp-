import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type { Prisma } from '@prisma/client'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioRegrasFiscais } from './repositorio-regras-fiscais.js'
import { esquemaRegrasFiscais, regrasFiscaisPadrao, type RegrasFiscais } from './esquema-regras-fiscais.js'

function exigirEmpresa(companyId: string) {
  if (!companyId) throw new ErroDaAplicacao('Empresa ativa não informada', 400)
}

function paraResposta(registro: Awaited<ReturnType<typeof repositorioRegrasFiscais.buscarDaEmpresa>>): RegrasFiscais {
  if (!registro) return regrasFiscaisPadrao()
  return esquemaRegrasFiscais.parse({
    mercadoria: { modo: registro.mercadoriaModo, aliquota: registro.mercadoriaAliquota == null ? null : Number(registro.mercadoriaAliquota) },
    transporte: { modo: registro.transporteModo, aliquota: registro.transporteAliquota == null ? null : Number(registro.transporteAliquota) },
    baseIcms: registro.baseIcms ?? 'bruto',
    operacoes: registro.operacoes ?? [],
  })
}

async function obter(companyId: string, db: Prisma.TransactionClient = clientePrisma) {
  exigirEmpresa(companyId)
  return paraResposta(await repositorioRegrasFiscais.buscarDaEmpresa(companyId, db))
}

async function gravar(companyId: string, dados: RegrasFiscais, usuarioId: string) {
  exigirEmpresa(companyId)
  const regras = esquemaRegrasFiscais.parse(dados)
  if (regras.operacoes?.length) {
    const ids = [...new Set(regras.operacoes.map(r => r.cfopEntradaId))]
    const cfops = await clientePrisma.cfop.findMany({ where: { companyId, ativo: true, id: { in: ids } }, select: { id: true, codigo: true, nome: true } })
    if (cfops.length !== ids.length || cfops.some(c => !/^[123]/.test(c.codigo))) {
      throw new ErroDaAplicacao('Informe somente CFOPs de entrada existentes', 400)
    }
    regras.operacoes = regras.operacoes.map(r => ({ ...r, cfopCodigo: cfops.find(c => c.id === r.cfopEntradaId)!.codigo, cfopNome: cfops.find(c => c.id === r.cfopEntradaId)!.nome }))
  }
  const antes = await repositorioRegrasFiscais.buscarDaEmpresa(companyId)
  const depois = await repositorioRegrasFiscais.gravar(companyId, regras)
  await registrarAuditoria({ usuarioId, acao: antes ? 'atualizar' : 'criar', entidade: 'RegraFiscal', entidadeId: depois.id,
    valoresAntes: antes ? { companyId, ...paraResposta(antes) } : null,
    valoresDepois: { companyId, ...paraResposta(depois) } })
  return paraResposta(depois)
}

export const servicoRegrasFiscais = { obter, gravar }
