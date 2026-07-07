/**
 * Regras de negócio para produtos.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { repositorioDeProdutos } from './repositorio-produtos.js'
import { servicoDeUnidadesMedida } from './servico-unidades-medida.js'
import { proximoSkuNumerico } from './sku-sequencial.js'
import { normalizarTextoCadastro } from '../../compartilhado/normalizacao/texto-cadastro.js'
import {
  salvarFotosProduto,
  removerPastaFotosProduto,
} from './armazenamento-foto-produto.js'
import type {
  DadosParaCriarProduto,
  DadosParaEditarProduto,
  DadosUploadFotoProduto,
} from './esquema-produtos.js'

function normalizarNomeCompra(dados: DadosParaCriarProduto | DadosParaEditarProduto) {
  if (!dados.nomeCompra?.trim()) {
    dados.nomeCompra = dados.nomeVenda
  }
}

async function validarFornecedores(
  fornecedores: { fornecedorPessoaId: string; unidadeEntrada?: string | null }[] | undefined,
  companyId: string
) {
  if (!fornecedores?.length) return

  const ids = fornecedores.map((f) => f.fornecedorPessoaId)
  const unicos = new Set(ids)
  if (unicos.size !== ids.length) {
    throw new ErroDaAplicacao('Fornecedor duplicado no cadastro do produto', 400)
  }

  for (const fornecedor of fornecedores) {
    const pessoa = await clientePrisma.pessoa.findFirst({
      where: {
        id: fornecedor.fornecedorPessoaId,
        companyId,
        papeis: { some: { papel: 'fornecedor', ativo: true } },
      },
    })
    if (!pessoa) {
      throw new ErroDaAplicacao('Fornecedor inválido ou inativo', 400)
    }
    if (fornecedor.unidadeEntrada?.trim()) {
      await servicoDeUnidadesMedida.validarUnidade(fornecedor.unidadeEntrada.trim(), companyId)
    }
  }
}

async function validarSimilares(
  similaresIds: string[] | undefined,
  produtoId: string | null,
  companyId: string
) {
  if (!similaresIds?.length) return
  if (produtoId && similaresIds.includes(produtoId)) {
    throw new ErroDaAplicacao('Produto não pode ser similar de si mesmo', 400)
  }
  const count = await clientePrisma.produto.count({
    where: { id: { in: similaresIds }, companyId, ativo: true },
  })
  if (count !== similaresIds.length) {
    throw new ErroDaAplicacao('Um ou mais produtos similares são inválidos ou inativos', 400)
  }
}

async function validarMarca(
  marca: string,
  companyId: string,
  marcaAtual?: string | null
): Promise<string> {
  const normalizada = normalizarTextoCadastro(marca)
  if (!normalizada) {
    throw new ErroDaAplicacao('Marca obrigatória', 400)
  }

  const marcas = await repositorioDeProdutos.listarMarcasDistintas(companyId)
  const normalizadaLower = normalizada.toLowerCase()

  if (marcas.some((m) => m.toLowerCase() === normalizadaLower)) {
    return marcas.find((m) => m.toLowerCase() === normalizadaLower) ?? normalizada
  }

  if (marcas.length === 0) {
    return normalizada
  }

  const atualNormalizada = marcaAtual ? normalizarTextoCadastro(marcaAtual) : null
  if (atualNormalizada && atualNormalizada.toLowerCase() === normalizadaLower) {
    return normalizada
  }

  throw new ErroDaAplicacao('Marca inválida. Selecione uma marca já cadastrada.', 400)
}

async function listarMarcas(companyId: string, busca?: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  const marcas = await repositorioDeProdutos.listarMarcasDistintas(companyId, busca)
  return { marcas }
}

async function sugerirProximoSku(companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  const sku = await proximoSkuNumerico(companyId)
  return { sku }
}

async function listarProdutos(companyId: string, busca?: string, incluirInativos?: boolean) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDeProdutos.listarPorEmpresa(companyId, busca, incluirInativos)
}

async function buscarProduto(id: string, companyId: string) {
  const produto = await repositorioDeProdutos.buscarPorId(id)
  if (!produto || produto.companyId !== companyId) {
    throw new ErroDaAplicacao('Produto não encontrado', 404)
  }
  return repositorioDeProdutos.mapearProduto(produto, companyId)
}

async function criarProduto(
  dados: DadosParaCriarProduto,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  normalizarNomeCompra(dados)
  dados.marca = await validarMarca(dados.marca, companyId)
  await servicoDeUnidadesMedida.validarUnidade(dados.unidade, companyId)
  await validarFornecedores(dados.fornecedores, companyId)
  await validarSimilares(dados.similaresIds, null, companyId)

  if (dados.sku) {
    const existente = await repositorioDeProdutos.buscarPorSkuNaEmpresa(dados.sku, companyId)
    if (existente) {
      throw new ErroDaAplicacao('SKU já cadastrado nesta empresa', 400)
    }
  }

  const produto = await repositorioDeProdutos.criar(dados, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'produto',
    entidadeId: produto.id,
    valoresDepois: { nomeVenda: dados.nomeVenda, sku: dados.sku },
  })

  return produto
}

async function editarProduto(
  id: string,
  dados: DadosParaEditarProduto,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDeProdutos.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Produto não encontrado', 404)
  }

  normalizarNomeCompra(dados)
  dados.marca = await validarMarca(dados.marca, companyId, existente.marca)
  await servicoDeUnidadesMedida.validarUnidade(dados.unidade, companyId)
  await validarFornecedores(dados.fornecedores, companyId)
  await validarSimilares(dados.similaresIds, id, companyId)

  if (dados.sku) {
    const outro = await repositorioDeProdutos.buscarPorSkuNaEmpresa(dados.sku, companyId)
    if (outro && outro.id !== id) {
      throw new ErroDaAplicacao('SKU já cadastrado nesta empresa', 400)
    }
  }

  const produto = await repositorioDeProdutos.atualizar(id, dados, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'produto',
    entidadeId: id,
    valoresDepois: { nomeVenda: dados.nomeVenda },
  })

  return produto
}

async function alterarStatusDoProduto(
  id: string,
  ativo: boolean,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDeProdutos.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Produto não encontrado', 404)
  }

  const atualizado = await repositorioDeProdutos.alterarStatus(id, ativo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: ativo ? 'reativar' : 'desativar',
    entidade: 'produto',
    entidadeId: id,
    valoresDepois: { ativo },
  })

  return repositorioDeProdutos.mapearProduto(atualizado, companyId)
}

async function salvarFotoDoProduto(
  id: string,
  dados: DadosUploadFotoProduto,
  companyId: string,
  idDoAutor: string
) {
  const existente = await repositorioDeProdutos.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Produto não encontrado', 404)
  }

  const arquivos = await salvarFotosProduto(companyId, id, dados.principal, dados.miniatura)

  await repositorioDeProdutos.sincronizarFotos(id, {
    ...arquivos,
    larguraPrincipal: dados.larguraPrincipal,
    alturaPrincipal: dados.alturaPrincipal,
    larguraMiniatura: dados.larguraMiniatura,
    alturaMiniatura: dados.alturaMiniatura,
  })

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'upload_foto',
    entidade: 'produto',
    entidadeId: id,
    valoresDepois: {
      tamanhoPrincipal: arquivos.tamanhoPrincipal,
      tamanhoMiniatura: arquivos.tamanhoMiniatura,
    },
  })

  return buscarProduto(id, companyId)
}

async function removerFotoDoProduto(id: string, companyId: string, idDoAutor: string) {
  const existente = await repositorioDeProdutos.buscarPorId(id)
  if (!existente || existente.companyId !== companyId) {
    throw new ErroDaAplicacao('Produto não encontrado', 404)
  }

  await repositorioDeProdutos.removerFotosDoBanco(id)
  await removerPastaFotosProduto(companyId, id)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'remover_foto',
    entidade: 'produto',
    entidadeId: id,
  })

  return buscarProduto(id, companyId)
}

export const servicoDeProdutos = {
  listarProdutos,
  listarMarcas,
  sugerirProximoSku,
  buscarProduto,
  criarProduto,
  editarProduto,
  alterarStatusDoProduto,
  salvarFotoDoProduto,
  removerFotoDoProduto,
}
