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

async function validarProduto(companyId: string, produtoId: string) {
  const produto = await clientePrisma.produto.findFirst({
    where: { id: produtoId, companyId, ativo: true },
    select: { id: true },
  })
  if (!produto) {
    throw new ErroDaAplicacao('Produto/serviço não encontrado ou inativo', 400)
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
  await validarProduto(companyId, dados.produtoId)
  if (dados.ativo !== false) {
    await garantirValorUnicoAtivo(companyId, dados.fornecedorPessoaId, dados.valor)
  }

  const registro = await repositorioDeRecorrenciasFinanceiras.criar(companyId, {
    fornecedorPessoaId: dados.fornecedorPessoaId,
    produtoId: dados.produtoId,
    valor: dados.valor,
    ativo: dados.ativo !== false,
  })

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'RecorrenciaFinanceira',
    entidadeId: registro.id,
    valoresDepois: {
      fornecedorPessoaId: registro.fornecedorPessoaId,
      produtoId: registro.produtoId,
      valor: registro.valor,
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
  await validarProduto(companyId, dados.produtoId)
  if (dados.ativo) {
    await garantirValorUnicoAtivo(companyId, dados.fornecedorPessoaId, dados.valor, id)
  }

  const registro = await repositorioDeRecorrenciasFinanceiras.atualizar(companyId, id, {
    fornecedorPessoaId: dados.fornecedorPessoaId,
    produtoId: dados.produtoId,
    valor: dados.valor,
    ativo: dados.ativo,
  })
  if (!registro) throw new ErroDaAplicacao('Recorrência não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'RecorrenciaFinanceira',
    entidadeId: id,
    valoresAntes: {
      fornecedorPessoaId: existente.fornecedorPessoaId,
      produtoId: existente.produtoId,
      valor: existente.valor,
      ativo: existente.ativo,
    },
    valoresDepois: {
      fornecedorPessoaId: registro.fornecedorPessoaId,
      produtoId: registro.produtoId,
      valor: registro.valor,
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

export const servicoDeRecorrenciasFinanceiras = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
