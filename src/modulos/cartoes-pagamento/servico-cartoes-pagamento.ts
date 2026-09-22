import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import type {
  DadosParaCriarCartao,
  DadosParaEditarCartao,
} from './esquema-cartoes-pagamento.js'
import { repositorioDeCartoesPagamento } from './repositorio-cartoes-pagamento.js'

async function validarAdquirente(
  companyId: string,
  adquirenteId: string,
  exigirAtivo: boolean
) {
  const adquirente = await clientePrisma.adquirente.findFirst({
    where: { id: adquirenteId, companyId },
    select: { id: true, ativo: true, nome: true },
  })
  if (!adquirente) {
    throw new ErroDaAplicacao('Adquirente não encontrada nesta empresa', 400)
  }
  if (exigirAtivo && !adquirente.ativo) {
    throw new ErroDaAplicacao('Selecione uma adquirente ativa', 400)
  }
  return adquirente
}

function normalizarTaxas(
  dados: DadosParaCriarCartao | DadosParaEditarCartao
): DadosParaCriarCartao['taxas'] {
  if (dados.tipo === 'debito') {
    const unica = dados.taxas[0]
    return [
      {
        numeroParcelas: 1,
        taxaPercentual: unica?.taxaPercentual ?? 0,
        prazoDias: unica?.prazoDias ?? 30,
        valorFixo: unica?.valorFixo ?? 0,
      },
    ]
  }
  if (!dados.permitirParcelamento) {
    const aVista = dados.taxas.find((t) => t.numeroParcelas === 1) ?? dados.taxas[0]
    return [
      {
        numeroParcelas: 1,
        taxaPercentual: aVista?.taxaPercentual ?? 0,
        prazoDias: aVista?.prazoDias ?? 30,
        valorFixo: aVista?.valorFixo ?? 0,
      },
    ]
  }
  return [...dados.taxas].sort((a, b) => a.numeroParcelas - b.numeroParcelas)
}

function payloadPersistencia(dados: DadosParaCriarCartao | DadosParaEditarCartao) {
  return {
    adquirenteId: dados.adquirenteId,
    bandeira: dados.bandeira,
    tipo: dados.tipo,
    nomeExibicao: dados.nomeExibicao,
    ativo: dados.ativo,
    permitirParcelamento: dados.tipo === 'debito' ? false : dados.permitirParcelamento,
    taxas: normalizarTaxas(dados),
  }
}

async function garantirUnicidade(
  companyId: string,
  adquirenteId: string,
  bandeira: string,
  tipo: string,
  excluirId?: string
) {
  const duplicada = await repositorioDeCartoesPagamento.buscarDuplicata(
    companyId,
    adquirenteId,
    bandeira,
    tipo,
    excluirId
  )
  if (duplicada) {
    throw new ErroDaAplicacao(
      'Já existe um cartão com esta bandeira e tipo para a adquirente selecionada',
      400
    )
  }
}

async function listar(
  companyId: string,
  filtro: {
    q?: string
    incluirInativos?: boolean
    adquirenteId?: string
    bandeira?: string
    tipo?: string
  }
) {
  return repositorioDeCartoesPagamento.listar(companyId, filtro)
}

async function obter(companyId: string, id: string) {
  const registro = await repositorioDeCartoesPagamento.buscarPorId(companyId, id)
  if (!registro) throw new ErroDaAplicacao('Cartão de pagamento não encontrado', 404)
  return registro
}

async function criar(companyId: string, dados: DadosParaCriarCartao, usuarioId: string) {
  await validarAdquirente(companyId, dados.adquirenteId, true)
  await garantirUnicidade(companyId, dados.adquirenteId, dados.bandeira, dados.tipo)

  const registro = await repositorioDeCartoesPagamento.criar(
    companyId,
    payloadPersistencia(dados)
  )

  await registrarAuditoria({
    usuarioId,
    acao: 'criar',
    entidade: 'CartaoPagamento',
    entidadeId: registro.id,
    valoresDepois: {
      bandeira: registro.bandeira,
      tipo: registro.tipo,
      nomeExibicao: registro.nomeExibicao,
      adquirenteId: registro.adquirenteId,
      ativo: registro.ativo,
    },
  })

  return registro
}

async function editar(
  companyId: string,
  id: string,
  dados: DadosParaEditarCartao,
  usuarioId: string
) {
  const existente = await repositorioDeCartoesPagamento.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Cartão de pagamento não encontrado', 404)

  const mesmaAdquirente = existente.adquirenteId === dados.adquirenteId
  await validarAdquirente(companyId, dados.adquirenteId, !mesmaAdquirente)
  await garantirUnicidade(companyId, dados.adquirenteId, dados.bandeira, dados.tipo, id)

  const registro = await repositorioDeCartoesPagamento.atualizar(
    companyId,
    id,
    payloadPersistencia(dados)
  )
  if (!registro) throw new ErroDaAplicacao('Cartão de pagamento não encontrado', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'CartaoPagamento',
    entidadeId: registro.id,
    valoresAntes: {
      bandeira: existente.bandeira,
      tipo: existente.tipo,
      nomeExibicao: existente.nomeExibicao,
      adquirenteId: existente.adquirenteId,
      ativo: existente.ativo,
    },
    valoresDepois: {
      bandeira: registro.bandeira,
      tipo: registro.tipo,
      nomeExibicao: registro.nomeExibicao,
      adquirenteId: registro.adquirenteId,
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
  const existente = await repositorioDeCartoesPagamento.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Cartão de pagamento não encontrado', 404)

  const registro = await repositorioDeCartoesPagamento.alterarStatus(companyId, id, ativo)
  if (!registro) throw new ErroDaAplicacao('Cartão de pagamento não encontrado', 404)

  await registrarAuditoria({
    usuarioId,
    acao: 'editar',
    entidade: 'CartaoPagamento',
    entidadeId: registro.id,
    valoresAntes: { ativo: existente.ativo },
    valoresDepois: { ativo: registro.ativo },
  })

  return registro
}

export const servicoDeCartoesPagamento = {
  listar,
  obter,
  criar,
  editar,
  alterarStatus,
}
