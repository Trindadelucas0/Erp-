import type { FastifyReply, FastifyRequest } from 'fastify'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { esquemaAjusteInventario } from './esquema-estoque.js'
import { servicoDeEstoque } from './servico-estoque.js'
import { tipoEstoqueVisaoEhValido, type TipoEstoqueVisao } from './tipos-estoque.js'

function companyId(requisicao: FastifyRequest) {
  return requisicao.empresaAtivaId || ''
}

function parseDataInicio(valor: string): Date {
  const d = new Date(valor.includes('T') ? valor : `${valor}T00:00:00.000`)
  if (Number.isNaN(d.getTime())) {
    throw new ErroDaAplicacao('Data "de" inválida', 400)
  }
  return d
}

function parseDataFim(valor: string): Date {
  const d = new Date(valor.includes('T') ? valor : `${valor}T23:59:59.999`)
  if (Number.isNaN(d.getTime())) {
    throw new ErroDaAplicacao('Data "ate" inválida', 400)
  }
  return d
}

async function listarEstoque(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = requisicao.query as { q?: string; limite?: string }
  const limite = query.limite ? Number(query.limite) : undefined
  const resultado = await servicoDeEstoque.listarResumo(
    companyId(requisicao),
    query.q,
    Number.isFinite(limite) ? limite : undefined
  )
  return resposta.send(resultado)
}

async function obterKardex(requisicao: FastifyRequest, resposta: FastifyReply) {
  const query = requisicao.query as {
    produtoId?: string
    de?: string
    ate?: string
    tipoEstoque?: string
  }

  if (!query.produtoId?.trim()) {
    throw new ErroDaAplicacao('produtoId é obrigatório', 400)
  }
  if (!query.de?.trim() || !query.ate?.trim()) {
    throw new ErroDaAplicacao('Período de/ate é obrigatório', 400)
  }

  const tipoEstoque = (query.tipoEstoque?.trim() || 'fisico') as TipoEstoqueVisao
  if (!tipoEstoqueVisaoEhValido(tipoEstoque)) {
    throw new ErroDaAplicacao(
      'tipoEstoque inválido (disponivel|fisico|fiscal)',
      400
    )
  }

  const kardex = await servicoDeEstoque.obterKardex({
    companyId: companyId(requisicao),
    produtoId: query.produtoId.trim(),
    de: parseDataInicio(query.de.trim()),
    ate: parseDataFim(query.ate.trim()),
    tipoEstoque,
  })
  return resposta.send(kardex)
}

async function obterSaldosProduto(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { produtoId } = requisicao.params as { produtoId: string }
  const resultado = await servicoDeEstoque.obterSaldosAtuais(
    companyId(requisicao),
    produtoId
  )
  return resposta.send(resultado)
}

async function ajusteInventario(requisicao: FastifyRequest, resposta: FastifyReply) {
  const { produtoId } = requisicao.params as { produtoId: string }
  const parsed = esquemaAjusteInventario.safeParse(requisicao.body)
  if (!parsed.success) {
    throw new ErroDaAplicacao(parsed.error.errors[0]?.message || 'Dados inválidos', 400)
  }

  const resultado = await servicoDeEstoque.ajusteInventario({
    companyId: companyId(requisicao),
    produtoId,
    usuarioId: requisicao.idDoUsuario!,
    observacao: parsed.data.observacao,
    quantidadeNova: parsed.data.quantidadeNova,
    delta: parsed.data.delta,
    fornecedorPessoaId: parsed.data.fornecedorPessoaId,
    precoCusto: parsed.data.precoCusto,
  })
  return resposta.status(201).send(resultado)
}

export const controladorDeEstoque = {
  listarEstoque,
  obterKardex,
  obterSaldosProduto,
  ajusteInventario,
}
