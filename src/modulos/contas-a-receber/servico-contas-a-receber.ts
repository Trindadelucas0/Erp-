import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarContaReceber,
  DadosParaEditarContaReceber,
  FiltroHistoricoBaixas,
  FiltroListagemContasReceber,
} from './esquema-contas-a-receber.js'
import { repositorioDeContasAReceber, ErroBaixa } from './repositorio-contas-a-receber.js'
import type { DadosUploadAnexoContaReceber } from './esquema-contas-a-receber.js'
import {
  caminhoAbsolutoAnexoContaReceber,
  removerAnexoContaReceber,
  salvarAnexoContaReceber,
} from './armazenamento-anexo-conta-receber.js'

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
      papeis: { some: { papel: 'cliente', ativo: true } },
    },
    select: { id: true },
  })
  if (!pessoa) {
    throw new ErroDaAplicacao('Cliente não encontrado nesta empresa', 400)
  }
}

async function validarPlano(companyId: string, planoFinanceiroId: string | null | undefined) {
  if (!planoFinanceiroId) return
  const plano = await clientePrisma.planoFinanceiro.findFirst({
    where: { id: planoFinanceiroId, companyId, ativo: true },
    select: { id: true },
  })
  if (!plano) {
    throw new ErroDaAplicacao('Plano financeiro não encontrado ou inativo', 400)
  }
}

function normalizarDados(dados: DadosParaCriarContaReceber | DadosParaEditarContaReceber) {
  const vencimento = parseData(dados.vencimento)
  if (!vencimento) {
    throw new ErroDaAplicacao('Data de vencimento é obrigatória', 400)
  }

  return {
    tipo: dados.tipo,
    pessoaId: dados.pessoaId ?? null,
    planoFinanceiroId: dados.planoFinanceiroId ?? null,
    numeroDocumento: dados.numeroDocumento?.trim() || null,
    dataEmissao: parseData(dados.dataEmissao ?? null),
    valorTotal: dados.valorTotal,
    valorDesconto: dados.valorDesconto ?? 0,
    valorJuros: dados.valorJuros ?? 0,
    valorMulta: dados.valorMulta ?? 0,
    valorComissao: dados.valorComissao ?? 0,
    observacao: dados.observacao?.trim() || null,
    vencimento,
  }
}

async function listar(companyId: string, filtro: FiltroListagemContasReceber) {
  return repositorioDeContasAReceber.listar(companyId, filtro)
}

async function obter(companyId: string, id: string) {
  const conta = await repositorioDeContasAReceber.buscarPorId(companyId, id)
  if (!conta) throw new ErroDaAplicacao('Conta a receber não encontrada', 404)
  return conta
}

async function criar(companyId: string, dados: DadosParaCriarContaReceber, usuarioId: string) {
  const normalizado = normalizarDados(dados)
  await validarPessoa(companyId, normalizado.pessoaId)
  await validarPlano(companyId, normalizado.planoFinanceiroId)

  const conta = await repositorioDeContasAReceber.criar(companyId, normalizado)

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'ContaReceber',
    entidadeId: conta.id,
    valoresDepois: { codigo: conta.codigo, tipo: conta.tipo, valorTotal: conta.valorTotal },
  })

  return conta
}

async function editar(
  companyId: string,
  id: string,
  dados: DadosParaEditarContaReceber,
  usuarioId: string
) {
  const existente = await repositorioDeContasAReceber.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Conta a receber não encontrada', 404)
  if (existente.status !== 'aberto') {
    throw new ErroDaAplicacao('Só é possível editar títulos com status aberto', 400)
  }
  if (existente.origem !== 'manual') {
    throw new ErroDaAplicacao('Só é possível editar títulos de origem manual nesta fase', 400)
  }

  const normalizado = normalizarDados(dados)
  await validarPessoa(companyId, normalizado.pessoaId)
  await validarPlano(companyId, normalizado.planoFinanceiroId)

  const conta = await repositorioDeContasAReceber.atualizar(companyId, id, normalizado)
  if (!conta) throw new ErroDaAplicacao('Conta a receber não encontrada', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'ContaReceber',
    entidadeId: id,
    valoresAntes: { codigo: existente.codigo, valorTotal: existente.valorTotal },
    valoresDepois: { codigo: conta.codigo, valorTotal: conta.valorTotal },
  })

  return conta
}

async function excluir(companyId: string, id: string, usuarioId: string) {
  const existente = await repositorioDeContasAReceber.buscarParaExcluir(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Conta a receber não encontrada', 404)
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

  await repositorioDeContasAReceber.deletar(id)

  await registrarAuditoria({
    usuarioId,
    acao: 'excluir',
    entidade: 'ContaReceber',
    entidadeId: id,
    valoresAntes: { codigo: existente.codigo, tipo: existente.tipo },
  })

  return { ok: true }
}

async function listarParaBaixar(companyId: string, filtro: FiltroListagemContasReceber) {
  return repositorioDeContasAReceber.listarParaBaixar(companyId, filtro)
}

async function listarHistoricoBaixas(companyId: string, filtro: FiltroHistoricoBaixas) {
  return repositorioDeContasAReceber.listarHistoricoBaixas(companyId, filtro)
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
    const resultados = await repositorioDeContasAReceber.executarBaixas(
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
      entidade: 'ContaReceberBaixa',
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

function assertContaPermiteAnexoMutacao(conta: { status: string }) {
  if (conta.status === 'cancelado') {
    throw new ErroDaAplicacao('Não é possível anexar/excluir em título cancelado', 400)
  }
}

async function listarAnexos(companyId: string, contaId: string) {
  const anexos = await repositorioDeContasAReceber.listarAnexos(companyId, contaId)
  if (anexos == null) throw new ErroDaAplicacao('Conta a receber não encontrada', 404)
  return anexos
}

async function enviarAnexo(
  companyId: string,
  contaId: string,
  usuarioId: string,
  dados: DadosUploadAnexoContaReceber
) {
  const conta = await repositorioDeContasAReceber.buscarPorId(companyId, contaId)
  if (!conta) throw new ErroDaAplicacao('Conta a receber não encontrada', 404)
  assertContaPermiteAnexoMutacao(conta)

  const { caminhoArquivo, tamanhoBytes } = await salvarAnexoContaReceber(
    contaId,
    dados.mimeType,
    dados.base64Arquivo
  )

  const anexo = await repositorioDeContasAReceber.criarAnexo(companyId, contaId, {
    nomeArquivo: dados.nomeArquivo.trim(),
    mimeType: dados.mimeType.toLowerCase(),
    caminhoArquivo,
    tamanhoBytes,
    usuarioId,
  })

  await registrarAuditoria({
    usuarioId,
    acao: 'anexar',
    entidade: 'ContaReceberAnexo',
    entidadeId: anexo.id,
    valoresDepois: { contaId, nomeArquivo: anexo.nomeArquivo, tamanhoBytes },
  })

  return anexo
}

async function baixarAnexoArquivo(companyId: string, contaId: string, anexoId: string) {
  const anexo = await repositorioDeContasAReceber.buscarAnexo(companyId, contaId, anexoId)
  if (!anexo) throw new ErroDaAplicacao('Anexo não encontrado', 404)
  return {
    caminhoAbsoluto: caminhoAbsolutoAnexoContaReceber(anexo.caminhoArquivo),
    nomeArquivo: anexo.nomeArquivo,
    mimeType: anexo.mimeType,
  }
}

async function excluirAnexo(
  companyId: string,
  contaId: string,
  anexoId: string,
  usuarioId: string
) {
  const conta = await repositorioDeContasAReceber.buscarPorId(companyId, contaId)
  if (!conta) throw new ErroDaAplicacao('Conta a receber não encontrada', 404)
  assertContaPermiteAnexoMutacao(conta)

  const anexo = await repositorioDeContasAReceber.buscarAnexo(companyId, contaId, anexoId)
  if (!anexo) throw new ErroDaAplicacao('Anexo não encontrado', 404)

  await removerAnexoContaReceber(anexo.caminhoArquivo)
  await repositorioDeContasAReceber.deletarAnexo(anexo.id)

  await registrarAuditoria({
    usuarioId,
    acao: 'excluir_anexo',
    entidade: 'ContaReceberAnexo',
    entidadeId: anexoId,
    valoresAntes: { contaId, nomeArquivo: anexo.nomeArquivo },
  })

  return { ok: true }
}

export const servicoDeContasAReceber = {
  listar,
  listarParaBaixar,
  listarHistoricoBaixas,
  obter,
  criar,
  editar,
  excluir,
  baixar,
  listarAnexos,
  enviarAnexo,
  baixarAnexoArquivo,
  excluirAnexo,
}
