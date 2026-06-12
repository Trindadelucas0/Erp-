/**
 * Regras de negócio para empresas.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { usuarioEhAdmin } from '../../compartilhado/paginas/registro-de-paginas.js'
import { repositorioDeUsuarios } from '../usuarios/repositorio-usuarios.js'
import { repositorioDeEmpresas } from './repositorio-empresas.js'
import {
  DadosParaCriarEmpresa,
  DadosParaEditarEmpresa,
} from './esquema-empresas.js'

async function listarEmpresasParaUsuario(idDoUsuario: string) {
  const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuario) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  if (usuarioEhAdmin(usuario.roles)) {
    return repositorioDeEmpresas.listarTodasAtivas()
  }

  return repositorioDeEmpresas.buscarPorIdDoUsuario(idDoUsuario)
}

async function criarEmpresa(dados: DadosParaCriarEmpresa) {
  const cnpjJaCadastrado = await repositorioDeEmpresas.buscarPorCnpj(dados.cnpj)

  if (cnpjJaCadastrado) {
    throw new ErroDaAplicacao('CNPJ já cadastrado', 400)
  }

  return repositorioDeEmpresas.criar({
    nome: dados.nome,
    cnpj: dados.cnpj,
  })
}

async function editarEmpresa(idDaEmpresa: string, dados: DadosParaEditarEmpresa) {
  const empresaExiste = await repositorioDeEmpresas.buscarPorId(idDaEmpresa)

  if (!empresaExiste) {
    throw new ErroDaAplicacao('Empresa não encontrada', 404)
  }

  const cnpjEmUso = await repositorioDeEmpresas.buscarPorCnpj(dados.cnpj)

  if (cnpjEmUso && cnpjEmUso.id !== idDaEmpresa) {
    throw new ErroDaAplicacao('CNPJ já cadastrado', 400)
  }

  return repositorioDeEmpresas.atualizar(idDaEmpresa, {
    nome: dados.nome,
    cnpj: dados.cnpj,
  })
}

async function alterarStatusDaEmpresa(idDaEmpresa: string, ativo: boolean) {
  const empresaExiste = await repositorioDeEmpresas.buscarPorId(idDaEmpresa)

  if (!empresaExiste) {
    throw new ErroDaAplicacao('Empresa não encontrada', 404)
  }

  return repositorioDeEmpresas.alterarStatus(idDaEmpresa, ativo)
}

export const servicoDeEmpresas = {
  listarEmpresasParaUsuario,
  criarEmpresa,
  editarEmpresa,
  alterarStatusDaEmpresa,
}
