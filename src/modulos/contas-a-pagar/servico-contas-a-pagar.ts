import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarContaPagar,
  DadosParaEditarContaPagar,
  FiltroListagemContasPagar,
} from './esquema-contas-a-pagar.js'
import { repositorioDeContasAPagar, ErroBaixa } from './repositorio-contas-a-pagar.js'

function parseData(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function validarPessoa(companyId: string, pessoaId: string | null | undefined) {
  if (!pessoaId) return
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

async function validarPlano(companyId: string, planoFinanceiroId: string | null | undefined) {
  if (!planoFinanceiroId) return
  const plano = await clientePrisma.planoFinanceiro.findFirst({
    where: { id: planoFinanceiroId, companyId, ativo: true },
    select: { id: true, permiteLancamentoManual: true },
  })
  if (!plano) {
    throw new ErroDaAplicacao('Plano financeiro não encontrado ou inativo', 400)
  }
}

function normalizarDados(dados: DadosParaCriarContaPagar | DadosParaEditarContaPagar) {
  const vencimento = parseData(dados.vencimento)
  if (!vencimento) {
    throw new ErroDaAplicacao('Data de vencimento é obrigatória', 400)
  }

  const tipoTributo = dados.tipo === 'tributos' ? dados.tipoTributo ?? null : null

  return {
    tipo: dados.tipo,
    tipoTributo,
    codigoReceita: dados.tipo === 'tributos' ? dados.codigoReceita?.trim() || null : null,
    numeroReferencia: dados.tipo === 'tributos' ? dados.numeroReferencia?.trim() || null : null,
    pessoaId: dados.pessoaId ?? null,
    planoFinanceiroId: dados.planoFinanceiroId ?? null,
    numeroDocumento: dados.numeroDocumento?.trim() || null,
    dataEmissao: parseData(dados.dataEmissao ?? null),
    valorTotal: dados.valorTotal,
    valorDesconto: dados.valorDesconto ?? 0,
    valorJuros: dados.valorJuros ?? 0,
    valorMulta: dados.valorMulta ?? 0,
    valorImpostoRetido: dados.valorImpostoRetido ?? 0,
    observacao: dados.observacao?.trim() || null,
    vencimento,
  }
}

async function listar(companyId: string, filtro: FiltroListagemContasPagar) {
  return repositorioDeContasAPagar.listar(companyId, filtro)
}

async function obter(companyId: string, id: string) {
  const conta = await repositorioDeContasAPagar.buscarPorId(companyId, id)
  if (!conta) throw new ErroDaAplicacao('Conta a pagar não encontrada', 404)
  return conta
}

async function criar(companyId: string, dados: DadosParaCriarContaPagar, usuarioId: string) {
  const normalizado = normalizarDados(dados)
  await validarPessoa(companyId, normalizado.pessoaId)
  await validarPlano(companyId, normalizado.planoFinanceiroId)

  const conta = await repositorioDeContasAPagar.criar(companyId, normalizado)

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'ContaPagar',
    entidadeId: conta.id,
    valoresDepois: { codigo: conta.codigo, tipo: conta.tipo, valorTotal: conta.valorTotal },
  })

  return conta
}

async function editar(
  companyId: string,
  id: string,
  dados: DadosParaEditarContaPagar,
  usuarioId: string
) {
  const existente = await repositorioDeContasAPagar.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Conta a pagar não encontrada', 404)
  if (existente.status !== 'aberto') {
    throw new ErroDaAplicacao('Só é possível editar títulos com status aberto', 400)
  }
  if (existente.origem !== 'manual') {
    throw new ErroDaAplicacao('Só é possível editar títulos de origem manual nesta fase', 400)
  }

  const normalizado = normalizarDados(dados)
  await validarPessoa(companyId, normalizado.pessoaId)
  await validarPlano(companyId, normalizado.planoFinanceiroId)

  const conta = await repositorioDeContasAPagar.atualizar(companyId, id, normalizado)
  if (!conta) throw new ErroDaAplicacao('Conta a pagar não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'ContaPagar',
    entidadeId: id,
    valoresAntes: { codigo: existente.codigo, valorTotal: existente.valorTotal },
    valoresDepois: { codigo: conta.codigo, valorTotal: conta.valorTotal },
  })

  return conta
}

async function excluir(companyId: string, id: string, usuarioId: string) {
  const existente = await repositorioDeContasAPagar.buscarParaExcluir(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Conta a pagar não encontrada', 404)
  if (existente.status !== 'aberto') {
    throw new ErroDaAplicacao('Só é possível excluir títulos com status aberto', 400)
  }
  if (existente.origem !== 'manual') {
    throw new ErroDaAplicacao('Só é possível excluir títulos de origem manual nesta fase', 400)
  }
  const temBaixa = existente.parcelas.some((p) => p.baixas.length > 0)
  if (temBaixa) {
    throw new ErroDaAplicacao('Não é possível excluir título que já possui baixa', 400)
  }

  await repositorioDeContasAPagar.deletar(id)

  await registrarAuditoria({
    usuarioId,
    acao: 'excluir',
    entidade: 'ContaPagar',
    entidadeId: id,
    valoresAntes: { codigo: existente.codigo, tipo: existente.tipo },
  })

  return { ok: true }
}

async function listarParaBaixar(companyId: string, filtro: FiltroListagemContasPagar) {
  return repositorioDeContasAPagar.listarParaBaixar(companyId, filtro)
}

async function listarHistoricoBaixas(
  companyId: string,
  filtro: import('./esquema-contas-a-pagar.js').FiltroHistoricoBaixas
) {
  return repositorioDeContasAPagar.listarHistoricoBaixas(companyId, filtro)
}

async function baixar(
  companyId: string,
  usuarioId: string,
  dados: {
    pagoEm?: string | null
    itens: Array<{
      parcelaId: string
      valorPrincipal: number
      valorJuros?: number
      valorMulta?: number
      valorDesconto?: number
      observacao?: string | null
    }>
  }
) {
  if (!dados.itens.length) {
    throw new ErroDaAplicacao('Selecione ao menos um título para baixar', 400)
  }

  const pagoEm = parseData(dados.pagoEm ?? null) ?? new Date()

  try {
    const resultados = await repositorioDeContasAPagar.executarBaixas(
      companyId,
      usuarioId,
      pagoEm,
      dados.itens.map((i) => ({
        parcelaId: i.parcelaId,
        valorPrincipal: i.valorPrincipal,
        valorJuros: i.valorJuros ?? 0,
        valorMulta: i.valorMulta ?? 0,
        valorDesconto: i.valorDesconto ?? 0,
        observacao: i.observacao?.trim() || null,
      }))
    )

    await registrarAuditoria({
      usuarioId,
      acao: 'baixar',
      entidade: 'ContaPagarBaixa',
      entidadeId: resultados[0]?.baixaId ?? companyId,
      valoresDepois: {
        qtd: resultados.length,
        codigos: resultados.map((r) => r.codigo),
      },
    })

    return { baixas: resultados }
  } catch (e) {
    if (e instanceof ErroBaixa) {
      throw new ErroDaAplicacao(e.message, 400)
    }
    throw e
  }
}

export const servicoDeContasAPagar = {
  listar,
  listarParaBaixar,
  listarHistoricoBaixas,
  obter,
  criar,
  editar,
  excluir,
  baixar,
}
