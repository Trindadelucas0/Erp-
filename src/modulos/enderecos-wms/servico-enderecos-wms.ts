import { Prisma } from '@prisma/client'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import {
  montarCodigoEnderecoWms,
  validarComponentesEnderecoWms,
} from './nomenclatura-endereco-wms.js'
import { repositorioDeEnderecosWms } from './repositorio-enderecos-wms.js'
import type {
  DadosParaCriarEnderecoWms,
  DadosParaEditarEnderecoWms,
} from './esquema-enderecos-wms.js'

const MSG_DUPLICADO = 'Código de endereço já cadastrado nesta empresa'

function ehUnicidadePrisma(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002'
}

function componentesOu400(dados: {
  local: string
  area: string
  tipo: string
  rua: string
  andar: string
  posicao: string
}) {
  try {
    const componentes = validarComponentesEnderecoWms(dados)
    return { componentes, codigo: montarCodigoEnderecoWms(componentes) }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Endereço WMS inválido'
    throw new ErroDaAplicacao(mensagem, 400)
  }
}

async function listar(
  companyId: string,
  opcoes?: {
    q?: string
    local?: string
    area?: string
    tipo?: string
    incluirInativos?: boolean
  }
) {
  return repositorioDeEnderecosWms.listarPorEmpresa(companyId, opcoes)
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
  const { componentes, codigo } = componentesOu400(dados)

  const duplicado = await repositorioDeEnderecosWms.buscarPorCodigo(companyId, codigo)
  if (duplicado) throw new ErroDaAplicacao(MSG_DUPLICADO, 409)

  try {
    const endereco = await repositorioDeEnderecosWms.criar(companyId, {
      ...componentes,
      codigo,
      ativo: dados.ativo ?? true,
    })

    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'criar',
      entidade: 'endereco_wms',
      entidadeId: endereco.id,
      valoresDepois: { codigo: endereco.codigo },
    })

    return endereco
  } catch (erro) {
    if (ehUnicidadePrisma(erro)) throw new ErroDaAplicacao(MSG_DUPLICADO, 409)
    throw erro
  }
}

async function editarEndereco(
  companyId: string,
  id: string,
  dados: DadosParaEditarEnderecoWms,
  idDoAutor: string
) {
  const existente = await repositorioDeEnderecosWms.buscarPorId(companyId, id)
  if (!existente) throw new ErroDaAplicacao('Endereço WMS não encontrado', 404)

  const { componentes, codigo } = componentesOu400(dados)

  const duplicado = await repositorioDeEnderecosWms.buscarPorCodigo(
    companyId,
    codigo,
    id
  )
  if (duplicado) throw new ErroDaAplicacao(MSG_DUPLICADO, 409)

  try {
    const endereco = await repositorioDeEnderecosWms.atualizar(companyId, id, {
      ...componentes,
      codigo,
      ativo: dados.ativo,
    })
    if (!endereco) throw new ErroDaAplicacao('Endereço WMS não encontrado', 404)

    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'editar',
      entidade: 'endereco_wms',
      entidadeId: endereco.id,
      valoresAntes: { codigo: existente.codigo, ativo: existente.ativo },
      valoresDepois: { codigo: endereco.codigo, ativo: endereco.ativo },
    })

    return endereco
  } catch (erro) {
    if (ehUnicidadePrisma(erro)) throw new ErroDaAplicacao(MSG_DUPLICADO, 409)
    throw erro
  }
}

export const servicoDeEnderecosWms = {
  listar,
  buscarPorId,
  criarEndereco,
  editarEndereco,
}
