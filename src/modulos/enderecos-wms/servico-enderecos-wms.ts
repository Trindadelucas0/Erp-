import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import {
  montarCodigoEnderecoWms,
  MSG_DUPLICATA_AP,
  resolverTakeListagemEnderecoWms,
  validarCodigoNivelEstruturaWms,
} from './nomenclatura-endereco-wms.js'
import { repositorioDeEnderecosWms } from './repositorio-enderecos-wms.js'
import { servicoDeEstruturaWms } from '../estrutura-wms/servico-estrutura-wms.js'
import { mensagemIndisponivelPorAncestral } from '../estrutura-wms/status-efetivo-wms.js'
import type {
  DadosParaCriarEnderecoWms,
  DadosParaEditarEnderecoWms,
  DadosParaMoverEnderecoWms,
} from './esquema-enderecos-wms.js'

function codigoApOu400(bruto: string): string {
  try {
    return validarCodigoNivelEstruturaWms('apartamento', bruto)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Apartamento inválido'
    throw new ErroDaAplicacao(mensagem, 400)
  }
}

function tipoOu400(bruto: string): string {
  const tipo = String(bruto ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(tipo)) {
    throw new ErroDaAplicacao('Tipo de endereço deve ter 2 letras', 400)
  }
  return tipo
}

function statusDeDados(dados: { status?: string; ativo?: boolean }, fallback = 'ativo') {
  if (dados.status) return dados.status
  if (dados.ativo === false) return 'inativo'
  if (dados.ativo === true) return 'ativo'
  return fallback
}

async function listar(
  companyId: string,
  opcoes?: {
    q?: string
    andarId?: string
    incluirInativos?: boolean
    status?: string
    take?: number
  }
) {
  const take = resolverTakeListagemEnderecoWms(opcoes)
  return repositorioDeEnderecosWms.listarPorEmpresa(companyId, { ...opcoes, take })
}

async function buscarPorId(companyId: string, id: string) {
  const endereco = await repositorioDeEnderecosWms.buscarPorId(companyId, id)
  if (!endereco) throw new ErroDaAplicacao('Endereço WMS não encontrado', 404)
  return endereco
}

async function criarEndereco(
  companyId: string,
  dados: DadosParaCriarEnderecoWms,
  idDoAutor: string
) {
  const andar = await servicoDeEstruturaWms.buscarPorId(companyId, dados.andarId)
  if (andar.nivel !== 'andar') {
    throw new ErroDaAplicacao('Informe um andar da estrutura', 400)
  }
  const bloqueante = await servicoDeEstruturaWms.statusEfetivoBloqueante(companyId, andar.id)
  if (bloqueante) throw new ErroDaAplicacao(mensagemIndisponivelPorAncestral(bloqueante), 400)

  const codigo = codigoApOu400(dados.codigo)
  const tipoEndereco = tipoOu400(dados.tipoEndereco)
  const duplicado = await repositorioDeEnderecosWms.buscarPorAndarCodigo(
    companyId,
    andar.id,
    codigo
  )
  if (duplicado) throw new ErroDaAplicacao(MSG_DUPLICATA_AP(codigo), 409)

  const caminho = await servicoDeEstruturaWms.caminhoComponentes(companyId, andar.id)
  const codigoCompleto = montarCodigoEnderecoWms({
    local: caminho.local,
    area: caminho.area,
    rua: caminho.rua,
    bloco: caminho.bloco,
    andar: caminho.andar,
    posicao: codigo,
  })
  const status = statusDeDados(dados)
  const sequencia = await repositorioDeEnderecosWms.proximaSequencia(companyId, andar.id)

  try {
    const endereco = await repositorioDeEnderecosWms.criar(companyId, {
      andarId: andar.id,
      codigo,
      codigoCompleto,
      local: caminho.local,
      area: caminho.area,
      rua: caminho.rua,
      bloco: caminho.bloco,
      andar: caminho.andar,
      posicao: codigo,
      tipoEndereco,
      sequencia,
      status,
      ativo: status !== 'inativo',
    })
    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'criar',
      entidade: 'endereco_wms',
      entidadeId: endereco.id,
      valoresDepois: { codigoCompleto },
    })
    return endereco
  } catch (erro) {
    if (repositorioDeEnderecosWms.ehUnicidadePrisma(erro)) {
      throw new ErroDaAplicacao(MSG_DUPLICATA_AP(codigo), 409)
    }
    throw erro
  }
}

async function editarEndereco(
  companyId: string,
  id: string,
  dados: DadosParaEditarEnderecoWms,
  idDoAutor: string
) {
  const existente = await buscarPorId(companyId, id)
  const codigo = codigoApOu400(dados.codigo)
  const tipoEndereco = tipoOu400(dados.tipoEndereco)
  const status = statusDeDados(dados, existente.status)

  if (codigo !== existente.codigo) {
    const dup = await repositorioDeEnderecosWms.buscarPorAndarCodigo(
      companyId,
      existente.andarId,
      codigo,
      id
    )
    if (dup) throw new ErroDaAplicacao(MSG_DUPLICATA_AP(codigo), 409)
  }

  const caminho = await servicoDeEstruturaWms.caminhoComponentes(companyId, existente.andarId)
  const codigoCompleto = montarCodigoEnderecoWms({
    local: caminho.local,
    area: caminho.area,
    rua: caminho.rua,
    bloco: caminho.bloco,
    andar: caminho.andar,
    posicao: codigo,
  })

  try {
    const endereco = await repositorioDeEnderecosWms.atualizar(companyId, id, {
      codigo,
      codigoCompleto,
      posicao: codigo,
      tipoEndereco,
      status,
      local: caminho.local,
      area: caminho.area,
      rua: caminho.rua,
      bloco: caminho.bloco,
      andar: caminho.andar,
    })
    if (!endereco) throw new ErroDaAplicacao('Endereço WMS não encontrado', 404)
    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'editar',
      entidade: 'endereco_wms',
      entidadeId: id,
      valoresAntes: { codigoCompleto: existente.codigoCompleto, status: existente.status },
      valoresDepois: { codigoCompleto, status },
    })
    return endereco
  } catch (erro) {
    if (repositorioDeEnderecosWms.ehUnicidadePrisma(erro)) {
      throw new ErroDaAplicacao(MSG_DUPLICATA_AP(codigo), 409)
    }
    throw erro
  }
}

async function moverEndereco(
  companyId: string,
  id: string,
  dados: DadosParaMoverEnderecoWms,
  idDoAutor: string
) {
  const arrastado = await buscarPorId(companyId, id)
  const alvo = await buscarPorId(companyId, dados.alvoId)
  if (arrastado.andarId !== alvo.andarId) {
    throw new ErroDaAplicacao('Só é possível reordenar apartamentos do mesmo andar', 400)
  }
  const irmaos = (await repositorioDeEnderecosWms.listarPorAndar(companyId, arrastado.andarId, true))
    .filter((a) => a.id !== id)
    .sort((a, b) => a.sequencia - b.sequencia || a.codigo.localeCompare(b.codigo))
  const ids = irmaos.map((i) => i.id)
  const idx = ids.indexOf(alvo.id)
  ids.splice(dados.posicao === 'antes' ? idx : idx + 1, 0, id)
  for (let i = 0; i < ids.length; i++) {
    await repositorioDeEnderecosWms.atualizar(companyId, ids[i]!, { sequencia: i })
  }
  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'endereco_wms',
    entidadeId: id,
    valoresDepois: { posicao: dados.posicao },
  })
  return buscarPorId(companyId, id)
}

async function excluirEndereco(companyId: string, id: string, idDoAutor: string) {
  const existente = await buscarPorId(companyId, id)
  const apagou = await repositorioDeEnderecosWms.excluir(companyId, id)
  if (!apagou) throw new ErroDaAplicacao('Endereço WMS não encontrado', 404)
  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'excluir',
    entidade: 'endereco_wms',
    entidadeId: id,
    valoresAntes: { codigoCompleto: existente.codigoCompleto },
  })
}

export const servicoDeEnderecosWms = {
  listar,
  buscarPorId,
  criarEndereco,
  editarEndereco,
  moverEndereco,
  excluirEndereco,
}
