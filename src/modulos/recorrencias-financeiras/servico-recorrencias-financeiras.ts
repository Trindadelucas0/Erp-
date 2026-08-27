import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarRecorrencia,
  DadosParaEditarRecorrencia,
} from './esquema-recorrencias-financeiras.js'
import { repositorioDeRecorrenciasFinanceiras } from './repositorio-recorrencias-financeiras.js'
import { servicoDeProdutos } from '../produtos/servico-produtos.js'
import { servicoDeMarcas } from '../produtos/servico-marcas.js'
import { servicoDeUnidadesMedida } from '../produtos/servico-unidades-medida.js'
import { proximoSkuNumerico } from '../produtos/sku-sequencial.js'
import { esquemaDeCriacaoDeProduto } from '../produtos/esquema-produtos.js'

const MARCA_SERVICO = 'Serviço'
const UNIDADE_SERVICO = 'UN'

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

function payloadPersistencia(dados: DadosParaCriarRecorrencia | DadosParaEditarRecorrencia) {
  return {
    fornecedorPessoaId: dados.fornecedorPessoaId,
    produtoId: dados.produtoId,
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
  await validarProduto(companyId, dados.produtoId)
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
      produtoId: registro.produtoId,
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
  await validarProduto(companyId, dados.produtoId)
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
      produtoId: existente.produtoId,
      valor: existente.valor,
      periodicidade: existente.periodicidade,
      diaVencimento: existente.diaVencimento,
      competenciaInicio: existente.competenciaInicio,
      competenciaFim: existente.competenciaFim,
      ativo: existente.ativo,
    },
    valoresDepois: {
      fornecedorPessoaId: registro.fornecedorPessoaId,
      produtoId: registro.produtoId,
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

async function garantirMarcaServico(companyId: string): Promise<string> {
  try {
    return await servicoDeMarcas.validarMarca(MARCA_SERVICO, companyId)
  } catch {
    try {
      const criada = await servicoDeMarcas.criarMarca({ nome: MARCA_SERVICO }, companyId)
      return criada.nome
    } catch {
      return servicoDeMarcas.validarMarca(MARCA_SERVICO, companyId)
    }
  }
}

async function criarServico(companyId: string, nome: string, usuarioId: string) {
  try {
    await servicoDeUnidadesMedida.validarUnidade(UNIDADE_SERVICO, companyId)
  } catch {
    throw new ErroDaAplicacao(
      'Unidade UN não cadastrada. Cadastre em Configurações → Logística.',
      400
    )
  }

  const marca = await garantirMarcaServico(companyId)
  const sku = await proximoSkuNumerico(companyId)
  const parse = esquemaDeCriacaoDeProduto.safeParse({
    nomeVenda: nome,
    marca,
    unidade: UNIDADE_SERVICO,
    controlaEstoque: false,
    sku,
  })
  if (!parse.success) {
    throw new ErroDaAplicacao(parse.error.errors[0]?.message ?? 'Dados do serviço inválidos', 400)
  }

  const produto = await servicoDeProdutos.criarProduto(parse.data, companyId, usuarioId)
  return {
    id: produto.id,
    nomeVenda: produto.nomeVenda,
    sku: produto.sku,
    unidade: produto.unidade,
    marca: produto.marca,
    controlaEstoque: produto.controlaEstoque,
  }
}

export const servicoDeRecorrenciasFinanceiras = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
  agenda,
  criarServico,
}
