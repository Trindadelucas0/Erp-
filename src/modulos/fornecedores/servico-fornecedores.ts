/**
 * Regras de negócio para fornecedores.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioDeCfops } from '../cfops/repositorio-cfops.js'
import { repositorioDeFornecedores } from './repositorio-fornecedores.js'
import {
  assertTodosPlanosDespesaEncontrados,
  coletarIdsPlanosFinanceiros,
} from './validacao-planos-fornecedor.js'
import type { DadosParaCriarFornecedor, DadosParaEditarFornecedor } from './esquema-fornecedores.js'

type DadosComVinculos = {
  planosFinanceirosIds?: string[]
  planoFinanceiroAlternativoId?: string | null
  cfopsEntradaIds?: string[]
  cfopSugestaoXmlId?: string | null
  paresPlanoCfopPadrao?: { planoFinanceiroId: string; cfopId: string }[]
}

async function validarVinculosFinanceirosECfop(companyId: string, dados: DadosComVinculos) {
  const idsUnicosPlanos = coletarIdsPlanosFinanceiros(dados)

  if (idsUnicosPlanos.length > 0) {
    const planos = await clientePrisma.planoFinanceiro.findMany({
      where: {
        id: { in: idsUnicosPlanos },
        companyId,
        tipo: 'despesa',
        ativo: true,
      },
      select: { id: true },
    })
    assertTodosPlanosDespesaEncontrados(idsUnicosPlanos, planos)
  }

  const cfopIds = [
    ...(dados.cfopsEntradaIds ?? []),
    ...(dados.cfopSugestaoXmlId ? [dados.cfopSugestaoXmlId] : []),
    ...(dados.paresPlanoCfopPadrao ?? []).map((p) => p.cfopId),
  ]
  const idsUnicosCfops = [...new Set(cfopIds)]

  if (idsUnicosCfops.length > 0) {
    try {
      await repositorioDeCfops.validarIdsEntradaFornecedor(companyId, idsUnicosCfops)
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'CFOP inválido'
      throw new ErroDaAplicacao(mensagem, 400)
    }
  }
}

async function listarFornecedores(companyId: string, q?: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada. Selecione uma empresa.', 400)
  }
  return repositorioDeFornecedores.listarPorEmpresa(companyId, q)
}

async function criarFornecedor(
  dados: DadosParaCriarFornecedor,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  await validarVinculosFinanceirosECfop(companyId, dados)

  const documento =
    dados.tipo === 'PF' ? dados.cpf?.replace(/\D/g, '') : dados.cnpj?.replace(/\D/g, '')

  if (documento) {
    const busca = await repositorioDeFornecedores.buscarPessoaPorDocumentoNaEmpresa(
      documento,
      companyId
    )
    if (busca.temPapelFornecedor && busca.pessoa?.ativo) {
      throw new ErroDaAplicacao(
        dados.tipo === 'PF'
          ? 'CPF já cadastrado como fornecedor nesta empresa'
          : 'CNPJ já cadastrado como fornecedor nesta empresa',
        400
      )
    }
  }

  const fornecedor = await repositorioDeFornecedores.criar(dados, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'fornecedor',
    entidadeId: fornecedor.id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo },
  })

  return fornecedor
}

async function editarFornecedor(
  id: string,
  dados: DadosParaEditarFornecedor,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDeFornecedores.buscarPorId(id)

  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Fornecedor não encontrado', 404)
  }

  await validarVinculosFinanceirosECfop(companyId, dados)

  if (dados.tipo === 'PF' && dados.cpf) {
    const outro = await repositorioDeFornecedores.buscarPorCpfNaEmpresa(dados.cpf, companyId)
    if (outro && outro.id !== id) {
      throw new ErroDaAplicacao('CPF já cadastrado como fornecedor nesta empresa', 400)
    }
  }

  if (dados.tipo === 'PJ' && dados.cnpj) {
    const outro = await repositorioDeFornecedores.buscarPorCnpjNaEmpresa(dados.cnpj, companyId)
    if (outro && outro.id !== id) {
      throw new ErroDaAplicacao('CNPJ já cadastrado como fornecedor nesta empresa', 400)
    }
  }

  const atualizado = await repositorioDeFornecedores.atualizar(id, dados, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'fornecedor',
    entidadeId: id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo },
  })

  return atualizado
}

async function alterarStatusDoFornecedor(
  id: string,
  ativo: boolean,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDeFornecedores.buscarPorId(id)

  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Fornecedor não encontrado', 404)
  }

  const atualizado = await repositorioDeFornecedores.alterarStatus(id, ativo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: ativo ? 'reativar' : 'desativar',
    entidade: 'fornecedor',
    entidadeId: id,
    valoresDepois: { ativo },
  })

  return atualizado
}

async function buscarFornecedorPorDocumento(documento: string, companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDeFornecedores.buscarPessoaPorDocumentoNaEmpresa(documento, companyId)
}

export const servicoDeFornecedores = {
  listarFornecedores,
  criarFornecedor,
  editarFornecedor,
  alterarStatusDoFornecedor,
  buscarFornecedorPorDocumento,
}
