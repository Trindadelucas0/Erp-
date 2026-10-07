/**
 * Regras de negócio para papéis (roles).
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  abaValidaParaPagina,
  GRUPOS_TELAS_CATALOGO,
  listarAbasDaPagina,
} from '../../compartilhado/paginas/registro-de-abas.js'
import { paginaVinculavelExiste, resolverPaginaPorChave } from '../../compartilhado/paginas/registro-de-paginas.js'
import { repositorioDeAcessoTelas } from '../acesso/repositorio-acesso-telas.js'
import { repositorioDePapeis } from './repositorio-papeis.js'

/**
 * Lista papéis para popular formulários.
 * @returns Lista de papéis com permissões
 */
function listarCatalogoTelas() {
  return GRUPOS_TELAS_CATALOGO
}

async function listarPapeis() {
  return repositorioDePapeis.listarTodos()
}

/**
 * Busca um papel pelo ID.
 * @param idDoPapel - UUID do papel
 * @returns Papel encontrado
 */
async function buscarPapelPorId(idDoPapel: string) {
  const papel = await repositorioDePapeis.buscarPorId(idDoPapel)

  if (!papel) {
    throw new ErroDaAplicacao('Papel não encontrado', 404)
  }

  return papel
}

/**
 * Salva permissões de um papel. Admin sempre mantém todas (não editável).
 * @param idDoPapel - UUID do papel
 * @param idsDasPermissoes - IDs selecionados
 * @returns Papel atualizado
 */
async function salvarPermissoesDoPapel(
  idDoPapel: string,
  idsDasPermissoes: string[]
) {
  const papel = await repositorioDePapeis.buscarPorId(idDoPapel)

  if (!papel) {
    throw new ErroDaAplicacao('Papel não encontrado', 404)
  }

  if (papel.name === 'admin') {
    throw new ErroDaAplicacao('O papel admin tem acesso total e não pode ser editado', 400)
  }

  return repositorioDePapeis.atualizarPermissoesDoPapel(
    idDoPapel,
    idsDasPermissoes
  )
}

const PAPEIS_PROTEGIDOS = ['admin']

/**
 * Cria um novo papel customizado.
 */
async function criarPapel(nome: string, descricao?: string) {
  if (PAPEIS_PROTEGIDOS.includes(nome)) {
    throw new ErroDaAplicacao(`O papel "${nome}" é reservado e não pode ser criado`, 400)
  }

  const jaExiste = await repositorioDePapeis.listarTodos().then((lista) =>
    lista.find((p) => p.name === nome)
  )

  if (jaExiste) {
    throw new ErroDaAplicacao('Já existe um papel com este nome', 400)
  }

  return repositorioDePapeis.criar(nome, descricao)
}

/**
 * Exclui um papel customizado. Papéis protegidos não podem ser excluídos.
 */
async function excluirPapel(idDoPapel: string) {
  const papel = await repositorioDePapeis.buscarPorId(idDoPapel)

  if (!papel) {
    throw new ErroDaAplicacao('Papel não encontrado', 404)
  }

  if (PAPEIS_PROTEGIDOS.includes(papel.name)) {
    throw new ErroDaAplicacao(`O papel "${papel.name}" é protegido e não pode ser excluído`, 400)
  }

  return repositorioDePapeis.excluir(idDoPapel)
}

async function salvarTelasDoPapel(
  idDoPapel: string,
  telas: Array<{ pageKey: string; abas: string[] }>
) {
  const papel = await repositorioDePapeis.buscarPorId(idDoPapel)

  if (!papel) {
    throw new ErroDaAplicacao('Papel não encontrado', 404)
  }

  if (papel.name === 'admin') {
    throw new ErroDaAplicacao('O papel admin tem acesso total e não pode ser editado', 400)
  }

  const normalizadas: Array<{ pageKey: string; abas: string[] }> = []

  for (const tela of telas) {
    const pagina = resolverPaginaPorChave(tela.pageKey)
    if (!pagina || (!paginaVinculavelExiste(tela.pageKey) && tela.pageKey !== 'pendencias')) {
      throw new ErroDaAplicacao(`Tela inválida: ${tela.pageKey}`, 400)
    }

    const abasCatalogo = listarAbasDaPagina(tela.pageKey)
    if (abasCatalogo.length > 0) {
      if (tela.abas.length === 0) continue
      for (const tabKey of tela.abas) {
        if (!abaValidaParaPagina(tela.pageKey, tabKey)) {
          throw new ErroDaAplicacao(
            `Aba inválida "${tabKey}" para ${tela.pageKey}`,
            400
          )
        }
      }
      normalizadas.push({ pageKey: tela.pageKey, abas: [...new Set(tela.abas)] })
    } else {
      normalizadas.push({ pageKey: tela.pageKey, abas: [] })
    }
  }

  await repositorioDeAcessoTelas.substituirTelasDoPapel(idDoPapel, normalizadas)
  return repositorioDePapeis.buscarPorId(idDoPapel)
}

export const servicoDePapeis = {
  listarCatalogoTelas,
  listarPapeis,
  buscarPapelPorId,
  salvarPermissoesDoPapel,
  salvarTelasDoPapel,
  criarPapel,
  excluirPapel,
}
