import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarRecorrencia,
  DadosParaEditarRecorrencia,
} from './esquema-recorrencias-financeiras.js'
import { repositorioDeRecorrenciasFinanceiras } from './repositorio-recorrencias-financeiras.js'

async function validarFornecedor(companyId: string, pessoaId: string) {
  const pessoa = await clientePrisma.pessoa.findFirst({
    where: {
      id: pessoaId,
      companyId,
      papeis: { some: { papel: 'fornecedor', ativo: true } },
    },
    select: { id: true },
  })
  if (!pessoa) {
    throw new ErroDaAplicacao('Fornecedor não encontrado nesta empresa', 400)
  }
}

async function garantirValorUnicoAtivo(
  companyId: string,
  fornecedorPessoaId: string,
  valor: number,
  excluirId?: string
) {
  const duplicada = await repositorioDeRecorrenciasFinanceiras.buscarAtivaPorFornecedorEValor(
    companyId,
    fornecedorPessoaId,
    valor,
    excluirId
  )
  if (duplicada) {
    throw new ErroDaAplicacao(
      'Já existe uma recorrência ativa deste fornecedor com o mesmo valor. Desabilite a outra ou use outro valor.',
      400
    )
  }
}

function payloadPersistencia(dados: DadosParaCriarRecorrencia | DadosParaEditarRecorrencia) {
  return {
    fornecedorPessoaId: dados.fornecedorPessoaId,
    valor: dados.valor,
    periodicidade: dados.periodicidade,
    diaVencimento: dados.diaVencimento,
    competenciaInicio: dados.competenciaInicio,
    competenciaFim: dados.competenciaFim,
    ativo: 'ativo' in dados ? dados.ativo !== false : true,
  }
}

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; fornecedorPessoaId?: string }
) {
  return repositorioDeRecorrenciasFinanceiras.listar(companyId, filtro)
}

async function obter(companyId: string, id: string) {
  const registro = await repositorioDeRecorrenciasFinanceiras.buscarPorId(companyId, id)
  if (!registro) throw new ErroDaAplicacao('Recorrência não encontrada', 404)
  return registro
}

async function criar(companyId: string, dados: DadosParaCriarRecorrencia, usuarioId: string) {
  await validarFornecedor(companyId, dados.fornecedorPessoaId)
  if (dados.ativo !== false) {
    await garantirValorUnicoAtivo(companyId, dados.fornecedorPessoaId, dados.valor)
  }

  const registro = await repositorioDeRecorrenciasFinanceiras.criar(
    companyId,
    payloadPersistencia(dados)
  )

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'RecorrenciaFinanceira',
    entidadeId: registro.id,
    valoresDepois: {
      fornecedorPessoaId: registro.fornecedorPessoaId,
      valor: registro.valor,
      periodicidade: registro.periodicidade,
      diaVencimento: registro.diaVencimento,
      competenciaInicio: registro.competenciaInicio,
      competenciaFim: registro.competenciaFim,
      ativo: registro.ativo,
    },
  })

  return registro
}

async function editar(
  companyId: string,
  id: string,
  dados: DadosParaEditarRecorrencia,
  usuarioId: string
) {
  const existente = await repositorioDeRecorrenciasFinanceiras.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Recorrência não encontrada', 404)

  await validarFornecedor(companyId, dados.fornecedorPessoaId)
  if (dados.ativo) {
    await garantirValorUnicoAtivo(companyId, dados.fornecedorPessoaId, dados.valor, id)
  }

  const registro = await repositorioDeRecorrenciasFinanceiras.atualizar(
    companyId,
    id,
    payloadPersistencia(dados)
  )
  if (!registro) throw new ErroDaAplicacao('Recorrência não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'RecorrenciaFinanceira',
    entidadeId: id,
    valoresAntes: {
      fornecedorPessoaId: existente.fornecedorPessoaId,
      valor: existente.valor,
      periodicidade: existente.periodicidade,
      diaVencimento: existente.diaVencimento,
      competenciaInicio: existente.competenciaInicio,
      competenciaFim: existente.competenciaFim,
      ativo: existente.ativo,
    },
    valoresDepois: {
      fornecedorPessoaId: registro.fornecedorPessoaId,
      valor: registro.valor,
      periodicidade: registro.periodicidade,
      diaVencimento: registro.diaVencimento,
      competenciaInicio: registro.competenciaInicio,
      competenciaFim: registro.competenciaFim,
      ativo: registro.ativo,
    },
  })

  return registro
}

async function alterarStatus(
  companyId: string,
  id: string,
  ativo: boolean,
  usuarioId: string
) {
  const existente = await repositorioDeRecorrenciasFinanceiras.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Recorrência não encontrada', 404)

  if (ativo) {
    await garantirValorUnicoAtivo(
      companyId,
      existente.fornecedorPessoaId,
      existente.valor,
      id
    )
  }

  const registro = await repositorioDeRecorrenciasFinanceiras.alterarAtivo(companyId, id, ativo)
  if (!registro) throw new ErroDaAplicacao('Recorrência não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: ativo ? 'habilitar' : 'desabilitar',
    entidade: 'RecorrenciaFinanceira',
    entidadeId: id,
    valoresAntes: { ativo: existente.ativo },
    valoresDepois: { ativo: registro.ativo },
  })

  return registro
}

async function agenda(companyId: string, competencia: string) {
  return repositorioDeRecorrenciasFinanceiras.montarAgenda(companyId, competencia)
}

export const servicoDeRecorrenciasFinanceiras = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
  agenda,
}
