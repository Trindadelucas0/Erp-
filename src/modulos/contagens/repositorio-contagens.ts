/**
 * Repositório — Contagem de entrada cega.
 */
import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { STATUS_SESSAO_CONTAGEM_ATIVA } from '../entrada-notas/status-entrada-contagem.js'

async function listarNotasDisponiveis(companyId: string) {
  const emSessaoAtiva = await clientePrisma.contagemEntradaNota.findMany({
    where: {
      contagemEntrada: {
        companyId,
        status: { in: [...STATUS_SESSAO_CONTAGEM_ATIVA] },
      },
    },
    select: { nfeRecebidaId: true },
  })
  const idsOcupados = new Set(emSessaoAtiva.map((n) => n.nfeRecebidaId))

  const candidatas = await clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      statusEntrada: 'entrada_contagem',
    },
    select: {
      id: true,
      chaveNfe: true,
      nomeEmitente: true,
      documentoEmitente: true,
      dataEmissao: true,
      tipoDocumento: true,
      statusEntrada: true,
      itens: { select: { produtoId: true } },
    },
    orderBy: [{ dataEmissao: 'desc' }, { createdAt: 'desc' }],
  })

  const notas: typeof candidatas = []
  const ignoradas: Array<{
    id: string
    chaveNfe: string
    nomeEmitente: string | null
    documentoEmitente: string | null
    dataEmissao: Date | null
    tipoDocumento: string | null
    motivo: string
  }> = []

  for (const n of candidatas) {
    const base = {
      id: n.id,
      chaveNfe: n.chaveNfe,
      nomeEmitente: n.nomeEmitente,
      documentoEmitente: n.documentoEmitente,
      dataEmissao: n.dataEmissao,
      tipoDocumento: n.tipoDocumento,
    }
    if (n.tipoDocumento === 'nfse' || n.tipoDocumento === 'cte') {
      ignoradas.push({
        ...base,
        motivo: 'Documental (NFS-e/CT-e) — sem contagem física de produtos',
      })
      continue
    }
    if (idsOcupados.has(n.id)) {
      ignoradas.push({
        ...base,
        motivo: 'Já está em uma contagem em andamento',
      })
      continue
    }
    const comProduto = n.itens.some((i) => i.produtoId)
    if (!comProduto) {
      ignoradas.push({
        ...base,
        motivo:
          'Nenhum item vinculado a produto no cadastro — concilie na Entrada (aba Cadastro) e libere de novo se precisar',
      })
      continue
    }
    notas.push(n)
  }

  return { notas, ignoradas }
}

async function listarSessoesAtivas(companyId: string) {
  return clientePrisma.contagemEntrada.findMany({
    where: {
      companyId,
      status: { in: [...STATUS_SESSAO_CONTAGEM_ATIVA] },
    },
    select: {
      id: true,
      status: true,
      iniciadoEm: true,
      notas: {
        include: {
          nfeRecebida: {
            select: {
              id: true,
              chaveNfe: true,
              nomeEmitente: true,
              documentoEmitente: true,
              dataEmissao: true,
              statusEntrada: true,
            },
          },
        },
      },
    },
    orderBy: [{ iniciadoEm: 'desc' }, { createdAt: 'desc' }],
  })
}

async function buscarNotasParaSessao(companyId: string, ids: string[]) {
  return clientePrisma.nfeRecebida.findMany({
    where: {
      companyId,
      id: { in: ids },
    },
    include: {
      itens: {
        where: { produtoId: { not: null } },
        include: {
          produto: {
            include: {
              fornecedores: {
                select: {
                  fornecedorPessoaId: true,
                  multiplicadorEntrada: true,
                  codigoFornecedor: true,
                },
              },
              embalagensMaster: {
                select: {
                  quantidade: true,
                  codigoBarras: true,
                  ordem: true,
                },
                orderBy: { ordem: 'asc' },
              },
            },
          },
        },
      },
    },
  })
}

async function notasEmSessaoAtiva(companyId: string, nfeRecebidaIds: string[]) {
  return clientePrisma.contagemEntradaNota.findMany({
    where: {
      nfeRecebidaId: { in: nfeRecebidaIds },
      contagemEntrada: {
        companyId,
        status: { in: [...STATUS_SESSAO_CONTAGEM_ATIVA] },
      },
    },
    select: {
      nfeRecebidaId: true,
      contagemEntradaId: true,
    },
  })
}

async function criarSessao(dados: {
  companyId: string
  usuarioId: string
  nfeRecebidaIds: string[]
  itens: Array<{
    produtoId: string
    nomeExibicao: string
    codigoBarras: string | null
    codigoOriginal: string | null
    marca: string | null
    unidade: string | null
    qtdEmbalagemPadrao: number | null
    qtdEsperada: number
  }>
}) {
  return clientePrisma.$transaction(async (tx) => {
    const sessao = await tx.contagemEntrada.create({
      data: {
        companyId: dados.companyId,
        usuarioId: dados.usuarioId,
        status: 'em_andamento',
        iniciadoEm: new Date(),
        notas: {
          create: dados.nfeRecebidaIds.map((nfeRecebidaId) => ({ nfeRecebidaId })),
        },
        itens: {
          create: dados.itens.map((item) => ({
            produtoId: item.produtoId,
            nomeExibicao: item.nomeExibicao,
            codigoBarras: item.codigoBarras,
            codigoOriginal: item.codigoOriginal,
            marca: item.marca,
            unidade: item.unidade,
            qtdEmbalagemPadrao:
              item.qtdEmbalagemPadrao != null
                ? new Prisma.Decimal(item.qtdEmbalagemPadrao)
                : null,
            qtdEsperada: new Prisma.Decimal(item.qtdEsperada),
            qtdContada: new Prisma.Decimal(0),
            statusItem: 'pendente',
          })),
        },
      },
      include: {
        notas: {
          include: {
            nfeRecebida: {
              select: {
                id: true,
                chaveNfe: true,
                nomeEmitente: true,
                documentoEmitente: true,
                dataEmissao: true,
                statusEntrada: true,
              },
            },
          },
        },
        itens: { orderBy: { nomeExibicao: 'asc' } },
      },
    })
    return sessao
  })
}

async function buscarSessaoCompleta(companyId: string, id: string) {
  return clientePrisma.contagemEntrada.findFirst({
    where: { id, companyId },
    include: {
      notas: {
        include: {
          nfeRecebida: {
            select: {
              id: true,
              chaveNfe: true,
              nomeEmitente: true,
              documentoEmitente: true,
              dataEmissao: true,
              statusEntrada: true,
            },
          },
        },
      },
      itens: {
        orderBy: { nomeExibicao: 'asc' },
        include: {
          produto: {
            select: {
              id: true,
              sku: true,
              codigoBarras: true,
              embalagensMaster: {
                select: { codigoBarras: true, quantidade: true },
              },
            },
          },
        },
      },
    },
  })
}

async function atualizarQtdContada(itemId: string, qtdContada: number) {
  return clientePrisma.contagemEntradaItem.update({
    where: { id: itemId },
    data: {
      qtdContada: new Prisma.Decimal(qtdContada),
      statusItem: 'pendente',
    },
  })
}

async function finalizarSessaoOk(dados: {
  sessaoId: string
  nfeRecebidaIds: string[]
  itemUpdates: Array<{ id: string; statusItem: string }>
  observacao?: string | null
}) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.contagemEntrada.update({
      where: { id: dados.sessaoId },
      data: {
        status: 'ok',
        finalizadoEm: new Date(),
        observacao: dados.observacao ?? null,
      },
    })
    for (const item of dados.itemUpdates) {
      await tx.contagemEntradaItem.update({
        where: { id: item.id },
        data: { statusItem: item.statusItem },
      })
    }
    await tx.nfeRecebida.updateMany({
      where: { id: { in: dados.nfeRecebidaIds } },
      data: { statusEntrada: 'entrada_contagem_ok' },
    })
  })
}

async function finalizarSessaoDivergente(dados: {
  sessaoId: string
  nfeRecebidaIds: string[]
  itemUpdates: Array<{ id: string; statusItem: string }>
  observacao?: string | null
}) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.contagemEntrada.update({
      where: { id: dados.sessaoId },
      data: {
        status: 'divergente',
        finalizadoEm: new Date(),
        observacao: dados.observacao ?? null,
      },
    })
    for (const item of dados.itemUpdates) {
      await tx.contagemEntradaItem.update({
        where: { id: item.id },
        data: { statusItem: item.statusItem },
      })
    }
    await tx.nfeRecebida.updateMany({
      where: { id: { in: dados.nfeRecebidaIds } },
      data: { statusEntrada: 'entrada_contagem_divergente' },
    })
  })
}

async function cancelarSessao(dados: {
  sessaoId: string
  nfeRecebidaIds: string[]
}) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.contagemEntrada.update({
      where: { id: dados.sessaoId },
      data: {
        status: 'cancelada',
        finalizadoEm: new Date(),
      },
    })
    await tx.nfeRecebida.updateMany({
      where: {
        id: { in: dados.nfeRecebidaIds },
        statusEntrada: { in: ['entrada_contagem', 'entrada_contagem_ok', 'entrada_contagem_divergente'] },
      },
      data: { statusEntrada: 'entrada_contagem' },
    })
  })
}

async function buscarSessaoFinalizadaDaNota(companyId: string, nfeRecebidaId: string) {
  return clientePrisma.contagemEntrada.findFirst({
    where: {
      companyId,
      status: { in: ['ok', 'divergente'] },
      notas: { some: { nfeRecebidaId } },
    },
    include: {
      notas: { select: { nfeRecebidaId: true } },
    },
    orderBy: { finalizadoEm: 'desc' },
  })
}

async function marcarSessaoBaixada(sessaoId: string) {
  return clientePrisma.contagemEntrada.update({
    where: { id: sessaoId },
    data: { baixadaEm: new Date() },
  })
}

async function reabrirSessaoAposBaixa(dados: { sessaoId: string; nfeRecebidaIds: string[] }) {
  return clientePrisma.$transaction(async (tx) => {
    await tx.contagemEntrada.update({
      where: { id: dados.sessaoId },
      data: {
        status: 'em_andamento',
        baixadaEm: null,
        finalizadoEm: null,
      },
    })
    await tx.contagemEntradaItem.updateMany({
      where: { contagemEntradaId: dados.sessaoId },
      data: { statusItem: 'pendente' },
    })
    await tx.nfeRecebida.updateMany({
      where: { id: { in: dados.nfeRecebidaIds } },
      data: { statusEntrada: 'entrada_contagem' },
    })
  })
}

async function mapaBaixadaPorNota(companyId: string, nfeRecebidaIds: string[]) {
  const ids = [...new Set(nfeRecebidaIds)]
  const mapa = new Map<string, boolean>()
  if (ids.length === 0) return mapa
  const sessoes = await clientePrisma.contagemEntrada.findMany({
    where: {
      companyId,
      status: { in: ['ok', 'divergente'] },
      notas: { some: { nfeRecebidaId: { in: ids } } },
    },
    select: {
      baixadaEm: true,
      notas: { select: { nfeRecebidaId: true } },
    },
    orderBy: { finalizadoEm: 'asc' },
  })
  for (const s of sessoes) {
    for (const n of s.notas) {
      mapa.set(n.nfeRecebidaId, Boolean(s.baixadaEm))
    }
  }
  return mapa
}

/** Notas com sessão de contagem `aberta` / `em_andamento` (para rótulo "Em contagem" na lista). */
async function mapaEmAndamentoPorNota(companyId: string, nfeRecebidaIds: string[]) {
  const ids = [...new Set(nfeRecebidaIds)]
  const mapa = new Map<string, boolean>()
  if (ids.length === 0) return mapa
  const vinculos = await notasEmSessaoAtiva(companyId, ids)
  for (const v of vinculos) {
    mapa.set(v.nfeRecebidaId, true)
  }
  return mapa
}

export const repositorioContagens = {
  listarNotasDisponiveis,
  listarSessoesAtivas,
  buscarNotasParaSessao,
  notasEmSessaoAtiva,
  criarSessao,
  buscarSessaoCompleta,
  atualizarQtdContada,
  finalizarSessaoOk,
  finalizarSessaoDivergente,
  cancelarSessao,
  buscarSessaoFinalizadaDaNota,
  marcarSessaoBaixada,
  reabrirSessaoAposBaixa,
  mapaBaixadaPorNota,
  mapaEmAndamentoPorNota,
}
