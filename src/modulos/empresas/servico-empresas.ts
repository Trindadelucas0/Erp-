/**
 * Regras de negócio para empresas.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { usuarioEhAdmin } from '../../compartilhado/paginas/registro-de-paginas.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
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

async function criarEmpresa(dados: DadosParaCriarEmpresa, idDoAutor: string) {
  const cnpjJaCadastrado = await repositorioDeEmpresas.buscarPorCnpj(dados.cnpj)

  if (cnpjJaCadastrado) {
    throw new ErroDaAplicacao('CNPJ já cadastrado', 400)
  }

  const empresaCriada = await repositorioDeEmpresas.criar(dados)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'empresa',
    entidadeId: empresaCriada.id,
    valoresDepois: { nome: dados.nome, cnpj: dados.cnpj },
  })

  return empresaCriada
}

async function editarEmpresa(
  idDoUsuario: string,
  idDaEmpresa: string,
  dados: DadosParaEditarEmpresa
) {
  const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuario) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  const ehAdmin = usuarioEhAdmin(usuario.roles)

  if (!ehAdmin) {
    const vinculo = usuario.companies.find((c) => c.company.id === idDaEmpresa)
    if (!vinculo) {
      throw new ErroDaAplicacao('Sem permissão para editar esta empresa', 403)
    }
  }

  const empresaExiste = await repositorioDeEmpresas.buscarPorId(idDaEmpresa)

  if (!empresaExiste) {
    throw new ErroDaAplicacao('Empresa não encontrada', 404)
  }

  const cnpjEmUso = await repositorioDeEmpresas.buscarPorCnpj(dados.cnpj)

  if (cnpjEmUso && cnpjEmUso.id !== idDaEmpresa) {
    throw new ErroDaAplicacao('CNPJ já cadastrado', 400)
  }

  return repositorioDeEmpresas.atualizar(idDaEmpresa, dados)
}

async function alterarStatusDaEmpresa(
  idDoUsuario: string,
  idDaEmpresa: string,
  ativo: boolean
) {
  const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)

  if (!usuario) {
    throw new ErroDaAplicacao('Usuário não encontrado', 404)
  }

  const ehAdmin = usuarioEhAdmin(usuario.roles)

  if (!ehAdmin) {
    const vinculo = usuario.companies.find((c) => c.company.id === idDaEmpresa)
    if (!vinculo) {
      throw new ErroDaAplicacao('Sem permissão para alterar esta empresa', 403)
    }
  }

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
