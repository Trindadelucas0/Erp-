import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { validarCodigoNivelEstruturaWms } from '../enderecos-wms/nomenclatura-endereco-wms.js'
import { repositorioDeEstruturaWms } from './repositorio-estrutura-wms.js'
import type {
  DadosParaCriarNivelWms,
  DadosParaEditarNivelWms,
  NivelEstruturaWms,
} from './esquema-estrutura-wms.js'

const MSG_DUPLICADO = 'Código já cadastrado neste nível da estrutura'
const MSG_RUA_SEM_AREA = 'Rua deve estar vinculada a uma área'
const MSG_AREA_CATALOGO = 'Área não cadastrada na estrutura do depósito'
const MSG_RUA_AREA = 'Rua não pertence à área selecionada'

const ROTULO_NIVEL: Record<NivelEstruturaWms, string> = {
  area: 'Área',
  tipo: 'Tipo de endereço',
  rua: 'Rua',
  andar: 'Andar',
}

function nomeOuCodigo(nome: string | undefined, codigo: string): string {
  const n = String(nome ?? '').trim()
  return n.length > 0 ? n : codigo
}

function codigoOu400(nivel: NivelEstruturaWms, bruto: string): string {
  try {
    return validarCodigoNivelEstruturaWms(nivel, bruto)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Código inválido'
    throw new ErroDaAplicacao(mensagem, 400)
  }
}

async function resolverPaiDaRua(
  companyId: string,
  nivel: string,
  paiBruto: string | undefined,
  paiExistente?: string | null
): Promise<string | null> {
  if (nivel !== 'rua') return null
  const pai = String(paiBruto ?? '').trim().toUpperCase()
  if (!pai) throw new ErroDaAplicacao(MSG_RUA_SEM_AREA, 400)

  const area = await repositorioDeEstruturaWms.buscarPorNivelCodigo(companyId, 'area', pai)
  if (!area) throw new ErroDaAplicacao(MSG_AREA_CATALOGO, 400)
  const mesmoPai = paiExistente === pai
  if (!area.ativo && !mesmoPai) throw new ErroDaAplicacao(MSG_AREA_CATALOGO, 400)
  return pai
}

async function listar(
  companyId: string,
  opcoes?: { nivel?: NivelEstruturaWms; incluirInativos?: boolean }
) {
  await repositorioDeEstruturaWms.garantirAreasETiposPadrao(companyId)
  return repositorioDeEstruturaWms.listarPorEmpresa(companyId, opcoes)
}

async function buscarPorId(companyId: string, id: string) {
  const item = await repositorioDeEstruturaWms.buscarPorId(companyId, id)
  if (!item) throw new ErroDaAplicacao('Item da estrutura WMS não encontrado', 404)
  return item
}

async function criarNivel(
  companyId: string,
  dados: DadosParaCriarNivelWms,
  idDoAutor: string
) {
  await repositorioDeEstruturaWms.garantirAreasETiposPadrao(companyId)
  const codigo = codigoOu400(dados.nivel, dados.codigo)
  const nome = dados.nivel === 'rua' ? codigo : nomeOuCodigo(dados.nome, codigo)
  const paiCodigo = await resolverPaiDaRua(companyId, dados.nivel, dados.paiCodigo)

  try {
    const item = await repositorioDeEstruturaWms.criar(companyId, {
      nivel: dados.nivel,
      codigo,
      nome,
      paiCodigo,
      ativo: dados.ativo ?? true,
    })

    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'criar',
      entidade: 'nivel_endereco_wms',
      entidadeId: item.id,
      valoresDepois: {
        nivel: item.nivel,
        codigo: item.codigo,
        nome: item.nome,
        paiCodigo: item.paiCodigo,
      },
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
  const existente = await repositorioDeEstruturaWms.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Item da estrutura WMS não encontrado', 404)

  const codigo = codigoOu400(existente.nivel as NivelEstruturaWms, dados.codigo)
  const nome = existente.nivel === 'rua' ? codigo : nomeOuCodigo(dados.nome, codigo)
  const paiCodigo = await resolverPaiDaRua(
    companyId,
    existente.nivel,
    dados.paiCodigo,
    existente.paiCodigo
  )

  try {
    const item = await repositorioDeEstruturaWms.atualizar(companyId, id, {
      codigo,
      nome,
      paiCodigo,
      ativo: dados.ativo,
    })
    if (!item) throw new ErroDaAplicacao('Item da estrutura WMS não encontrado', 404)

    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'editar',
      entidade: 'nivel_endereco_wms',
      entidadeId: item.id,
      valoresAntes: {
        codigo: existente.codigo,
        nome: existente.nome,
        paiCodigo: existente.paiCodigo,
        ativo: existente.ativo,
      },
      valoresDepois: {
        codigo: item.codigo,
        nome: item.nome,
        paiCodigo: item.paiCodigo,
        ativo: item.ativo,
      },
    })

    return item
  } catch (erro) {
    if (repositorioDeEstruturaWms.ehUnicidadePrisma(erro)) {
      throw new ErroDaAplicacao(MSG_DUPLICADO, 409)
    }
    throw erro
  }
}

async function exigirNiveisDoCatalogo(
  companyId: string,
  componentes: { area: string; tipo: string; rua: string; andar: string },
  existentes?: { area: string; tipo: string; rua: string; andar: string }
) {
  await repositorioDeEstruturaWms.garantirAreasETiposPadrao(companyId)

  const pares: { nivel: NivelEstruturaWms; codigo: string; campo: keyof typeof componentes }[] =
    [
      { nivel: 'area', codigo: componentes.area, campo: 'area' },
      { nivel: 'tipo', codigo: componentes.tipo, campo: 'tipo' },
      { nivel: 'rua', codigo: componentes.rua, campo: 'rua' },
      { nivel: 'andar', codigo: componentes.andar, campo: 'andar' },
    ]

  let itemRua: { paiCodigo: string | null } | null = null

  for (const par of pares) {
    const item = await repositorioDeEstruturaWms.buscarPorNivelCodigo(
      companyId,
      par.nivel,
      par.codigo
    )
    const rotulo = ROTULO_NIVEL[par.nivel]
    const mesmoQueExistente = existentes?.[par.campo] === par.codigo
    if (!item) {
      throw new ErroDaAplicacao(
        `${rotulo} não cadastrad${par.nivel === 'andar' || par.nivel === 'tipo' ? 'o' : 'a'} na estrutura do depósito`,
        400
      )
    }
    if (!item.ativo && !mesmoQueExistente) {
      throw new ErroDaAplicacao(
        `${rotulo} não cadastrad${par.nivel === 'andar' || par.nivel === 'tipo' ? 'o' : 'a'} na estrutura do depósito`,
        400
      )
    }
    if (par.nivel === 'rua') itemRua = item
  }

  const ruaCombinaArea = itemRua?.paiCodigo === componentes.area
  const legadoMesmaRua =
    Boolean(existentes) &&
    existentes!.rua === componentes.rua &&
    existentes!.area === componentes.area
  if (!ruaCombinaArea && !legadoMesmaRua) {
    throw new ErroDaAplicacao(MSG_RUA_AREA, 400)
  }
}

export const servicoDeEstruturaWms = {
  listar,
  buscarPorId,
  criarNivel,
  editarNivel,
  exigirNiveisDoCatalogo,
}
