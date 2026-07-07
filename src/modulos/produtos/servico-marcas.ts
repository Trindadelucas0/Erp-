import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { normalizarTextoCadastro } from '../../compartilhado/normalizacao/texto-cadastro.js'
import { mensagemErroZod } from './esquema-produtos.js'
import {
  esquemaDeCriacaoDeMarca,
  type DadosParaCriarMarca,
} from './esquema-marcas.js'
import { repositorioDeMarcas } from './repositorio-marcas.js'

async function listarMarcas(companyId: string, busca?: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  const marcas = await repositorioDeMarcas.listarPorEmpresa(companyId, busca)
  return {
    marcas: marcas.map((m) => m.nome),
    itens: marcas,
  }
}

async function criarMarca(body: unknown, companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  const resultado = esquemaDeCriacaoDeMarca.safeParse(body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }

  const dados: DadosParaCriarMarca = resultado.data
  const existente = await repositorioDeMarcas.buscarPorNome(dados.nome, companyId)
  if (existente) {
    throw new ErroDaAplicacao('Marca já cadastrada', 400)
  }

  const marca = await repositorioDeMarcas.criar(dados, companyId)
  return marca
}

async function validarMarca(marca: string, companyId: string): Promise<string> {
  const normalizada = normalizarTextoCadastro(marca)
  if (!normalizada) {
    throw new ErroDaAplicacao('Marca obrigatória', 400)
  }

  const cadastrada = await repositorioDeMarcas.buscarPorNome(normalizada, companyId)
  if (!cadastrada) {
    throw new ErroDaAplicacao('Marca inválida. Cadastre ou selecione uma marca existente.', 400)
  }

  return cadastrada.nome
}

export const servicoDeMarcas = {
  listarMarcas,
  criarMarca,
  validarMarca,
}
