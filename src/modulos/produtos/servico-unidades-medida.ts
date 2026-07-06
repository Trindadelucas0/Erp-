import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  esquemaDeCriacaoDeUnidadeMedida,
  type DadosParaCriarUnidadeMedida,
} from './esquema-unidades-medida.js'
import { mensagemErroZod } from './esquema-produtos.js'
import { repositorioDeUnidadesMedida } from './repositorio-unidades-medida.js'

async function listarUnidades(companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDeUnidadesMedida.listarPorEmpresa(companyId)
}

async function criarUnidade(body: unknown, companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  const resultado = esquemaDeCriacaoDeUnidadeMedida.safeParse(body)
  if (!resultado.success) {
    throw new ErroDaAplicacao(mensagemErroZod(resultado.error), 400)
  }

  const dados: DadosParaCriarUnidadeMedida = resultado.data
  const existente = await repositorioDeUnidadesMedida.buscarPorSigla(dados.sigla, companyId)
  if (existente) {
    throw new ErroDaAplicacao('Sigla de unidade já cadastrada', 400)
  }

  return repositorioDeUnidadesMedida.criar(dados, companyId)
}

async function validarUnidade(sigla: string, companyId: string) {
  await repositorioDeUnidadesMedida.listarPorEmpresa(companyId)
  const unidade = await repositorioDeUnidadesMedida.buscarPorSigla(sigla, companyId)
  if (!unidade) {
    throw new ErroDaAplicacao('Unidade de medida inválida ou não cadastrada', 400)
  }
}

export const servicoDeUnidadesMedida = {
  listarUnidades,
  criarUnidade,
  validarUnidade,
}
