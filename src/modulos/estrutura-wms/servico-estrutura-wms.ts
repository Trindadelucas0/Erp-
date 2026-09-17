import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import {
  FILHO_DO_NIVEL,
  montarCodigoEnderecoWms,
  validarCodigoNivelEstruturaWms,
  type NivelHierarquiaWms,
} from '../enderecos-wms/nomenclatura-endereco-wms.js'
import { repositorioDeEnderecosWms } from '../enderecos-wms/repositorio-enderecos-wms.js'
import {
  contarProdutosNosCodigos,
  MSG_PRODUTO_VINCULADO_NIVEL,
} from '../enderecos-wms/vinculo-produto-endereco-wms.js'
import { repositorioDeEstruturaWms } from './repositorio-estrutura-wms.js'
import type {
  DadosParaCriarNivelWms,
  DadosParaEditarNivelWms,
  DadosParaGerarEstruturaWms,
  DadosParaMoverNivelWms,
  NivelEstruturaWms,
} from './esquema-estrutura-wms.js'
import { calcularFaixasGeracao, exemplosCodigoGeracao } from './gerar-estrutura-wms.js'
import { paiAposMovimento, validarMovimento } from './logica-mover-nivel-wms.js'
import {
  mensagemIndisponivelPorAncestral,
  statusParaAtivo,
  type StatusEnderecoWms,
} from './status-efetivo-wms.js'

const MSG_DUPLICADO = 'Código já cadastrado neste nível da estrutura'

function nomeOuCodigo(nome: string | undefined, codigo: string): string {
  const n = String(nome ?? '').trim()
  return n.length > 0 ? n : codigo
}

function codigoOu400(nivel: string, bruto: string): string {
  try {
    return validarCodigoNivelEstruturaWms(nivel, bruto)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Código inválido'
    throw new ErroDaAplicacao(mensagem, 400)
  }
}

function statusDeDados(dados: { status?: string; ativo?: boolean }): StatusEnderecoWms {
  if (dados.status) return dados.status as StatusEnderecoWms
  if (dados.ativo === false) return 'inativo'
  return 'ativo'
}

export type NoArvoreWms = {
  id: string
  nivel: string
  codigo: string
  nome: string
  parentId: string | null
  sequencia: number
  status: string
  ativo: boolean
  qtdApartamentos: number
  filhos: NoArvoreWms[]
}

async function caminhoComponentes(companyId: string, noId: string) {
  const no = await repositorioDeEstruturaWms.buscarPorId(companyId, noId)
  if (!no) throw new ErroDaAplicacao('Item da estrutura WMS não encontrado', 404)
  const ancestrais = await repositorioDeEstruturaWms.ancestrais(companyId, noId)
  const cadeia = [...ancestrais].reverse().concat(no)
  const mapa: Record<string, string> = {}
  for (const item of cadeia) mapa[item.nivel] = item.codigo
  return {
    local: mapa.local ?? '',
    area: mapa.area ?? '',
    rua: mapa.rua ?? '',
    bloco: mapa.bloco ?? '',
    andar: mapa.andar ?? '',
    no,
    cadeia,
  }
}

async function statusEfetivoBloqueante(companyId: string, id: string): Promise<string | null> {
  const proprio = await repositorioDeEstruturaWms.buscarPorId(companyId, id)
  if (!proprio) return null
  if (proprio.status === 'bloqueado' || proprio.status === 'inativo') return proprio.nivel
  const ancestrais = await repositorioDeEstruturaWms.ancestrais(companyId, id)
  const bloqueado = ancestrais.find((a) => a.status === 'bloqueado' || a.status === 'inativo')
  return bloqueado?.nivel ?? null
}

async function recalcularApartamentosDaSubarvore(companyId: string, raizId: string) {
  const ids = await repositorioDeEstruturaWms.coletarIdsSubarvore(companyId, raizId)
  const niveis = await repositorioDeEstruturaWms.listarPorEmpresa(companyId, {
    incluirInativos: true,
  })
  const porId = new Map(niveis.map((n) => [n.id, n]))
  const andarIds = niveis.filter((n) => ids.includes(n.id) && n.nivel === 'andar').map((n) => n.id)
  const aps = await repositorioDeEnderecosWms.listarPorAndares(companyId, andarIds)
  const updates = []
  for (const ap of aps) {
    const andar = porId.get(ap.andarId)
    if (!andar) continue
    const caminho = await caminhoComponentes(companyId, andar.id)
    const codigoCompleto = montarCodigoEnderecoWms({
      local: caminho.local,
      area: caminho.area,
      rua: caminho.rua,
      bloco: caminho.bloco,
      andar: caminho.andar,
      posicao: ap.codigo,
    })
    updates.push({
      id: ap.id,
      codigoCompleto,
      local: caminho.local,
      area: caminho.area,
      rua: caminho.rua,
      bloco: caminho.bloco,
      andar: caminho.andar,
    })
  }
  if (updates.length > 0) {
    await repositorioDeEnderecosWms.atualizarCodigoCompletoEmLote(updates)
  }
}

async function listar(
  companyId: string,
  opcoes?: { q?: string; status?: string; incluirInativos?: boolean }
) {
  await repositorioDeEstruturaWms.garantirCatalogoPadrao(companyId)
  const niveis = await repositorioDeEstruturaWms.listarPorEmpresa(companyId, {
    incluirInativos: true,
    status: opcoes?.status && opcoes.status !== 'todos' ? opcoes.status : undefined,
  })
  const andarIds = niveis.filter((n) => n.nivel === 'andar').map((n) => n.id)
  const contagem = await repositorioDeEnderecosWms.contarPorAndares(companyId, andarIds)
  const mapa = new Map<string, NoArvoreWms>()
  const raizes: NoArvoreWms[] = []
  for (const n of niveis) {
    mapa.set(n.id, {
      ...n,
      qtdApartamentos: n.nivel === 'andar' ? (contagem.get(n.id) ?? 0) : 0,
      filhos: [],
    })
  }
  for (const n of niveis) {
    const no = mapa.get(n.id)!
    if (n.parentId && mapa.has(n.parentId)) {
      mapa.get(n.parentId)!.filhos.push(no)
    } else if (!n.parentId) {
      raizes.push(no)
    }
  }
  function somar(no: NoArvoreWms): number {
    let total = no.qtdApartamentos
    for (const filho of no.filhos) total += somar(filho)
    no.qtdApartamentos = total
    no.filhos.sort((a, b) => a.sequencia - b.sequencia || a.codigo.localeCompare(b.codigo))
    return total
  }
  for (const r of raizes) somar(r)
  raizes.sort((a, b) => a.sequencia - b.sequencia || a.codigo.localeCompare(b.codigo))
  return raizes
}

async function buscarPorId(companyId: string, id: string) {
  const item = await repositorioDeEstruturaWms.buscarPorId(companyId, id)
  if (!item) throw new ErroDaAplicacao('Item da estrutura WMS não encontrado', 404)
  return item
}

async function criarNivel(companyId: string, dados: DadosParaCriarNivelWms, idDoAutor: string) {
  await repositorioDeEstruturaWms.garantirCatalogoPadrao(companyId)
  let nivel: NivelEstruturaWms
  let parentId: string | null = dados.parentId?.trim() || null

  if (parentId) {
    const pai = await repositorioDeEstruturaWms.buscarPorId(companyId, parentId)
    if (!pai) throw new ErroDaAplicacao('Nível pai não encontrado', 404)
    const filho = FILHO_DO_NIVEL[pai.nivel as NivelHierarquiaWms]
    if (!filho) throw new ErroDaAplicacao('Este nível não pode ter filhos na estrutura', 400)
    nivel = filho
    const bloqueante = await statusEfetivoBloqueante(companyId, pai.id)
    if (bloqueante) throw new ErroDaAplicacao(mensagemIndisponivelPorAncestral(bloqueante), 400)
  } else {
    nivel = (dados.nivel as NivelEstruturaWms) || 'local'
    if (nivel !== 'local') throw new ErroDaAplicacao('Informe o nível pai', 400)
    parentId = null
  }

  const codigo = codigoOu400(nivel, dados.codigo)
  const nome = nomeOuCodigo(dados.nome, codigo)
  const status = statusDeDados(dados)
  const sequencia = await repositorioDeEstruturaWms.proximaSequencia(companyId, parentId)

  const duplicado = await repositorioDeEstruturaWms.buscarFilhoPorCodigo(
    companyId,
    parentId,
    codigo
  )
  if (duplicado) throw new ErroDaAplicacao(MSG_DUPLICADO, 409)

  try {
    const item = await repositorioDeEstruturaWms.criar(companyId, {
      nivel,
      codigo,
      nome,
      parentId,
      sequencia,
      status,
    })
    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'criar',
      entidade: 'nivel_endereco_wms',
      entidadeId: item.id,
      valoresDepois: { nivel, codigo, nome, parentId, status },
    })
    return item
  } catch (erro) {
    if (repositorioDeEstruturaWms.ehUnicidadePrisma(erro)) {
      throw new ErroDaAplicacao(MSG_DUPLICADO, 409)
    }
    throw erro
  }
}

async function editarNivel(
  companyId: string,
  id: string,
  dados: DadosParaEditarNivelWms,
  idDoAutor: string
) {
  const existente = await buscarPorId(companyId, id)
  const codigo = codigoOu400(existente.nivel, dados.codigo)
  const nome = nomeOuCodigo(dados.nome, codigo)
  const status = dados.status ?? (dados.ativo === false ? 'inativo' : existente.status)

  if (codigo !== existente.codigo) {
    const duplicado = await repositorioDeEstruturaWms.buscarFilhoPorCodigo(
      companyId,
      existente.parentId,
      codigo
    )
    if (duplicado && duplicado.id !== id) throw new ErroDaAplicacao(MSG_DUPLICADO, 409)
  }

  try {
    const item = await repositorioDeEstruturaWms.atualizar(companyId, id, {
      codigo,
      nome,
      status,
    })
    if (!item) throw new ErroDaAplicacao('Item da estrutura WMS não encontrado', 404)
    if (codigo !== existente.codigo) {
      await recalcularApartamentosDaSubarvore(companyId, id)
    }
    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'editar',
      entidade: 'nivel_endereco_wms',
      entidadeId: item.id,
      valoresAntes: { codigo: existente.codigo, nome: existente.nome, status: existente.status },
      valoresDepois: { codigo: item.codigo, nome: item.nome, status: item.status },
    })
    return item
  } catch (erro) {
    if (repositorioDeEstruturaWms.ehUnicidadePrisma(erro)) {
      throw new ErroDaAplicacao(MSG_DUPLICADO, 409)
    }
    throw erro
  }
}

async function excluirNivel(companyId: string, id: string, idDoAutor: string) {
  const existente = await buscarPorId(companyId, id)
  const idsSub = await repositorioDeEstruturaWms.coletarIdsSubarvore(companyId, id)
  const niveis = await repositorioDeEstruturaWms.listarPorEmpresa(companyId, {
    incluirInativos: true,
  })
  const nos = niveis.filter((n) => idsSub.includes(n.id))
  const andarIds = nos.filter((n) => n.nivel === 'andar').map((n) => n.id)
  const aps = await repositorioDeEnderecosWms.listarPorAndares(companyId, andarIds)
  const vinculados = await contarProdutosNosCodigos(
    companyId,
    aps.map((ap) => ap.codigoCompleto)
  )
  if (vinculados > 0) {
    throw new ErroDaAplicacao(MSG_PRODUTO_VINCULADO_NIVEL, 409, {
      detalhes: { quantidade: vinculados },
    })
  }
  await repositorioDeEstruturaWms.excluirSubarvore(companyId, nos, andarIds)
  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'excluir',
    entidade: 'nivel_endereco_wms',
    entidadeId: id,
    valoresAntes: {
      nivel: existente.nivel,
      codigo: existente.codigo,
      niveis: nos.length,
      apartamentos: aps.length,
    },
  })
}

async function moverNivel(
  companyId: string,
  id: string,
  dados: DadosParaMoverNivelWms,
  idDoAutor: string
) {
  const arrastado = await buscarPorId(companyId, id)
  const alvo = await buscarPorId(companyId, dados.alvoId)
  const sub = new Set(await repositorioDeEstruturaWms.coletarIdsSubarvore(companyId, id))
  const erro = validarMovimento({
    arrastadoId: id,
    alvoId: dados.alvoId,
    posicao: dados.posicao,
    nivelArrastado: arrastado.nivel,
    nivelAlvo: alvo.nivel,
    idsSubarvore: sub,
  })
  if (erro) throw new ErroDaAplicacao(erro, 400)

  const novoPaiId = paiAposMovimento({
    posicao: dados.posicao,
    alvoParentId: alvo.parentId,
    alvoId: alvo.id,
  })
  if (novoPaiId) {
    const pai = await repositorioDeEstruturaWms.buscarPorId(companyId, novoPaiId)
    if (!pai || pai.companyId === undefined) {
      /* company already scoped */
    }
    if (!pai) throw new ErroDaAplicacao('Nível pai não encontrado', 404)
  }

  const irmaos = (await repositorioDeEstruturaWms.listarPorEmpresa(companyId, { incluirInativos: true }))
    .filter((n) => n.parentId === novoPaiId && n.id !== id)
    .sort((a, b) => a.sequencia - b.sequencia || a.codigo.localeCompare(b.codigo))

  const listaIds = irmaos.map((i) => i.id)
  if (dados.posicao === 'dentro') {
    listaIds.push(id)
  } else {
    const idx = listaIds.indexOf(alvo.id)
    const insertAt = dados.posicao === 'antes' ? idx : idx + 1
    listaIds.splice(Math.max(0, insertAt), 0, id)
  }

  const paiMudou = (novoPaiId ?? null) !== (arrastado.parentId ?? null)
  if (paiMudou) {
    const dup = await repositorioDeEstruturaWms.buscarFilhoPorCodigo(
      companyId,
      novoPaiId,
      arrastado.codigo
    )
    if (dup && dup.id !== id) throw new ErroDaAplicacao(MSG_DUPLICADO, 409)
  }

  await repositorioDeEstruturaWms.atualizar(companyId, id, {
    parentId: novoPaiId,
    sequencia: listaIds.indexOf(id),
  })
  for (let i = 0; i < listaIds.length; i++) {
    if (listaIds[i] === id) continue
    await repositorioDeEstruturaWms.atualizar(companyId, listaIds[i]!, { sequencia: i })
  }

  if (paiMudou) await recalcularApartamentosDaSubarvore(companyId, id)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'nivel_endereco_wms',
    entidadeId: id,
    valoresAntes: { parentId: arrastado.parentId, sequencia: arrastado.sequencia },
    valoresDepois: { parentId: novoPaiId, posicao: dados.posicao },
  })
  return buscarPorId(companyId, id)
}

type NoGeracao = {
  id: string
  nivel: string
  codigo: string
  nome: string
  parentId: string | null
}

async function garantirFilho(
  companyId: string,
  parentId: string | null,
  nivel: NivelEstruturaWms,
  codigo: string,
  nome?: string
) {
  const existente = await repositorioDeEstruturaWms.buscarFilhoPorCodigo(
    companyId,
    parentId,
    codigo
  )
  if (existente) return existente
  const sequencia = await repositorioDeEstruturaWms.proximaSequencia(companyId, parentId)
  return repositorioDeEstruturaWms.criar(companyId, {
    nivel,
    codigo,
    nome: nomeOuCodigo(nome, codigo),
    parentId,
    sequencia,
    status: 'ativo',
  })
}

async function resolverLocalGeracao(
  companyId: string,
  dados: DadosParaGerarEstruturaWms,
  persistir: boolean
): Promise<NoGeracao> {
  if (dados.localId) {
    const local = await buscarPorId(companyId, dados.localId)
    if (local.nivel !== 'local') throw new ErroDaAplicacao('Local e área inválidos', 400)
    return local
  }
  const codigo = codigoOu400('local', dados.localCodigo ?? '')
  const existente = await repositorioDeEstruturaWms.buscarFilhoPorCodigo(companyId, null, codigo)
  if (existente) {
    if (existente.nivel !== 'local') throw new ErroDaAplicacao('Local e área inválidos', 400)
    return existente
  }
  if (!persistir) {
    return { id: '', nivel: 'local', codigo, nome: nomeOuCodigo(dados.localNome, codigo), parentId: null }
  }
  return garantirFilho(companyId, null, 'local', codigo, dados.localNome)
}

async function resolverAreaGeracao(
  companyId: string,
  dados: DadosParaGerarEstruturaWms,
  local: NoGeracao,
  persistir: boolean
): Promise<NoGeracao> {
  if (dados.areaId) {
    const area = await buscarPorId(companyId, dados.areaId)
    if (area.nivel !== 'area') throw new ErroDaAplicacao('Local e área inválidos', 400)
    if (!local.id || area.parentId !== local.id) {
      throw new ErroDaAplicacao('Área não pertence ao local selecionado', 400)
    }
    return area
  }
  const codigo = codigoOu400('area', dados.areaCodigo ?? '')
  if (local.id) {
    const existente = await repositorioDeEstruturaWms.buscarFilhoPorCodigo(
      companyId,
      local.id,
      codigo
    )
    if (existente) {
      if (existente.nivel !== 'area') throw new ErroDaAplicacao('Local e área inválidos', 400)
      return existente
    }
  }
  if (!persistir) {
    return {
      id: '',
      nivel: 'area',
      codigo,
      nome: nomeOuCodigo(dados.areaNome, codigo),
      parentId: local.id || null,
    }
  }
  if (!local.id) throw new ErroDaAplicacao('Local obrigatório', 400)
  return garantirFilho(companyId, local.id, 'area', codigo, dados.areaNome)
}

async function previewGerar(companyId: string, dados: DadosParaGerarEstruturaWms) {
  const local = await resolverLocalGeracao(companyId, dados, false)
  const area = await resolverAreaGeracao(companyId, dados, local, false)
  const faixas = calcularFaixasGeracao(dados)
  let ruasCodigos: string[]
  if (dados.ruaId) {
    if (!area.id) {
      throw new ErroDaAplicacao('Selecione uma área já cadastrada para usar uma rua existente', 400)
    }
    const rua = await buscarPorId(companyId, dados.ruaId)
    if (rua.nivel !== 'rua' || rua.parentId !== area.id) {
      throw new ErroDaAplicacao('Rua não pertence à área selecionada', 400)
    }
    ruasCodigos = [rua.codigo]
  } else {
    ruasCodigos = faixas.ruas ?? []
  }
  const exemplos = exemplosCodigoGeracao({
    local: local.codigo,
    area: area.codigo,
    ruas: ruasCodigos,
    blocos: faixas.blocos,
    andares: faixas.andares,
    aps: faixas.aps,
  })
  return { total: faixas.total, exemplos, avisos: [] as string[] }
}

async function gerarEstrutura(companyId: string, dados: DadosParaGerarEstruturaWms, idDoAutor: string) {
  const preview = await previewGerar(companyId, dados)
  const local = await resolverLocalGeracao(companyId, dados, true)
  const area = await resolverAreaGeracao(companyId, dados, local, true)
  if (!area.id) throw new ErroDaAplicacao('Área obrigatória', 400)
  const bloqueante = await statusEfetivoBloqueante(companyId, area.id)
  if (bloqueante) throw new ErroDaAplicacao(mensagemIndisponivelPorAncestral(bloqueante), 400)

  const faixas = calcularFaixasGeracao(dados)
  const tipoPadrao = dados.tipoPadrao.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(tipoPadrao)) {
    throw new ErroDaAplicacao('Tipo padrão deve ter 2 letras', 400)
  }

  const idsParaExpandir = new Set<string>([local.id, area.id].filter(Boolean))
  const andarIds = new Set<string>()

  let ruasAlvo = dados.ruaId ? [await buscarPorId(companyId, dados.ruaId)] : []

  let criados = 0
  let pulados = 0

  if (!dados.ruaId) {
    ruasAlvo = []
    for (const codigo of faixas.ruas ?? []) {
      ruasAlvo.push(await garantirFilho(companyId, area.id, 'rua', codigo))
    }
  }
  for (const rua of ruasAlvo) {
    idsParaExpandir.add(rua.id)
    for (const blocoCod of faixas.blocos) {
      const bloco = await garantirFilho(companyId, rua.id, 'bloco', blocoCod)
      idsParaExpandir.add(bloco.id)
      for (const andarCod of faixas.andares) {
        const andar = await garantirFilho(companyId, bloco.id, 'andar', andarCod)
        idsParaExpandir.add(andar.id)
        andarIds.add(andar.id)
        const caminho = await caminhoComponentes(companyId, andar.id)
        const seqBase = await repositorioDeEnderecosWms.proximaSequencia(companyId, andar.id)
        let offset = 0
        for (const apCod of faixas.aps) {
          const ja = await repositorioDeEnderecosWms.buscarPorAndarCodigo(companyId, andar.id, apCod)
          if (ja) {
            pulados += 1
            continue
          }
          const codigoCompleto = montarCodigoEnderecoWms({
            local: caminho.local,
            area: caminho.area,
            rua: caminho.rua,
            bloco: caminho.bloco,
            andar: caminho.andar,
            posicao: apCod,
          })
          await repositorioDeEnderecosWms.criar(companyId, {
            andarId: andar.id,
            codigo: apCod,
            codigoCompleto,
            local: caminho.local,
            area: caminho.area,
            rua: caminho.rua,
            bloco: caminho.bloco,
            andar: caminho.andar,
            posicao: apCod,
            tipoEndereco: tipoPadrao,
            sequencia: seqBase + offset,
            status: 'ativo',
            ativo: true,
          })
          offset += 1
          criados += 1
        }
      }
    }
  }

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'endereco_wms',
    entidadeId: area.id,
    valoresDepois: { gerados: criados, pulados, total: preview.total },
  })

  return {
    criados,
    pulados,
    exemplos: preview.exemplos,
    idsParaExpandir: [...idsParaExpandir],
    andarIds: [...andarIds],
  }
}

export const servicoDeEstruturaWms = {
  listar,
  buscarPorId,
  criarNivel,
  editarNivel,
  excluirNivel,
  moverNivel,
  previewGerar,
  gerarEstrutura,
  caminhoComponentes,
  statusEfetivoBloqueante,
  statusParaAtivo,
}
