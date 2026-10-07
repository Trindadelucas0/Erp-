import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import type { DadosParaCriarConta, DadosParaEditarConta } from './esquema-contas.js'
import { normalizarDadosContaParaGravacao } from './esquema-contas.js'
import { repositorioDeContas } from './repositorio-contas.js'

async function garantirUnicidade(
  companyId: string,
  dados: ReturnType<typeof normalizarDadosContaParaGravacao>,
  excluirId?: string
) {
  const duplicadaNome = await repositorioDeContas.buscarPorNome(companyId, dados.nome, excluirId)
  if (duplicadaNome) {
    throw new ErroDaAplicacao('Já existe uma conta com este nome nesta empresa', 400)
  }

  if (
    dados.tipo === 'bancaria' &&
    dados.banco &&
    dados.agencia &&
    dados.conta
  ) {
    const duplicadaCc = await repositorioDeContas.buscarBancariaDuplicada(
      companyId,
      dados.banco,
      dados.agencia,
      dados.conta,
      excluirId
    )
    if (duplicadaCc) {
      throw new ErroDaAplicacao(
        'Já existe uma conta bancária com este banco, agência e conta nesta empresa',
        400
      )
    }
  }
}

async function listar(
  companyId: string,
  filtro: { q?: string; incluirInativos?: boolean; somenteAtivos?: boolean }
) {
  return repositorioDeContas.listar(companyId, filtro)
}

async function obter(companyId: string, id: string) {
  const registro = await repositorioDeContas.buscarPorId(companyId, id)
  if (!registro) throw new ErroDaAplicacao('Conta não encontrada', 404)
  return registro
}

async function obterContaAtivaParaBaixa(companyId: string, contaId: string) {
  const conta = await repositorioDeContas.buscarAtivaPorId(companyId, contaId)
  if (!conta) {
    throw new ErroDaAplicacao('Conta inválida ou inativa para baixa', 400)
  }
  return conta
}

async function criar(companyId: string, dados: DadosParaCriarConta, usuarioId: string) {
  const normalizado = normalizarDadosContaParaGravacao(dados)
  await garantirUnicidade(companyId, normalizado)
  const registro = await repositorioDeContas.criar(companyId, normalizado)

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'ContaEmpresa',
    entidadeId: registro.id,
    valoresDepois: { nome: registro.nome, tipo: registro.tipo, ativo: registro.ativo },
  })

  return registro
}

async function editar(
  companyId: string,
  id: string,
  dados: DadosParaEditarConta,
  usuarioId: string
) {
  const existente = await repositorioDeContas.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Conta não encontrada', 404)

  const normalizado = normalizarDadosContaParaGravacao(dados)
  await garantirUnicidade(companyId, normalizado, id)
  const registro = await repositorioDeContas.atualizar(companyId, id, normalizado)
  if (!registro) throw new ErroDaAplicacao('Conta não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'ContaEmpresa',
    entidadeId: registro.id,
    valoresAntes: { nome: existente.nome, tipo: existente.tipo, ativo: existente.ativo },
    valoresDepois: { nome: registro.nome, tipo: registro.tipo, ativo: registro.ativo },
  })

  return registro
}

async function alterarStatus(
  companyId: string,
  id: string,
  ativo: boolean,
  usuarioId: string
) {
  const existente = await repositorioDeContas.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Conta não encontrada', 404)

  const registro = await repositorioDeContas.alterarStatus(companyId, id, ativo)
  if (!registro) throw new ErroDaAplicacao('Conta não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'ContaEmpresa',
    entidadeId: registro.id,
    valoresAntes: { ativo: existente.ativo },
    valoresDepois: { ativo: registro.ativo },
  })

  return registro
}

export const servicoDeContas = {
  listar,
  obter,
  obterContaAtivaParaBaixa,
  criar,
  editar,
  alterarStatus,
}
