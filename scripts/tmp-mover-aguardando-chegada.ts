import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  // Preferência: nota já em contagem/análise com pedido revenda
  const candidatas = await p.nfeRecebida.findMany({
    where: {
      tipoDocumento: { in: ['nfe55', null as unknown as string] },
      OR: [{ tipoDocumento: 'nfe55' }, { tipoDocumento: null }],
      pedidoCompraId: { not: null },
      statusEntrada: {
        notIn: ['cancelada', 'entrada_consolidada'],
      },
      pedidoCompra: { tipoCompra: 'revenda' },
      itens: { some: { produtoId: { not: null } } },
    },
    select: {
      id: true,
      companyId: true,
      chaveNfe: true,
      numero: true,
      serie: true,
      nomeEmitente: true,
      statusEntrada: true,
      pedidoCompraId: true,
      pedidoCompra: { select: { numero: true, tipoCompra: true, status: true } },
      _count: { select: { itens: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 15,
  })

  // Fallback sem filtro de tipoDocumento null quirk
  const lista =
    candidatas.length > 0
      ? candidatas
      : await p.nfeRecebida.findMany({
          where: {
            pedidoCompraId: { not: null },
            statusEntrada: { notIn: ['cancelada'] },
            pedidoCompra: { tipoCompra: 'revenda' },
          },
          select: {
            id: true,
            companyId: true,
            chaveNfe: true,
            numero: true,
            serie: true,
            nomeEmitente: true,
            statusEntrada: true,
            pedidoCompraId: true,
            pedidoCompra: { select: { numero: true, tipoCompra: true, status: true } },
            _count: { select: { itens: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        })

  console.log('candidatas', lista.length)
  for (const n of lista) {
    console.log(
      JSON.stringify({
        id: n.id,
        numero: n.numero,
        serie: n.serie,
        emitente: n.nomeEmitente,
        status: n.statusEntrada,
        pedido: n.pedidoCompra?.numero,
        tipoCompra: n.pedidoCompra?.tipoCompra,
        itens: n._count.itens,
        companyId: n.companyId,
      })
    )
  }

  const alvo =
    lista.find((n) => n.statusEntrada !== 'aguardando_chegada') ?? lista[0]

  if (!alvo) {
    console.error('Nenhuma NFe com pedido revenda encontrada.')
    process.exit(1)
  }

  const antes = alvo.statusEntrada
  await p.nfeRecebida.update({
    where: { id: alvo.id },
    data: {
      statusEntrada: 'aguardando_chegada',
      etapaAtual: 'lancamento',
    },
  })

  console.log('---')
  console.log(
    JSON.stringify({
      ok: true,
      id: alvo.id,
      numero: alvo.numero,
      serie: alvo.serie,
      emitente: alvo.nomeEmitente,
      pedido: alvo.pedidoCompra?.numero,
      statusAntes: antes,
      statusDepois: 'aguardando_chegada',
      url: `/entrada-notas/${alvo.id}`,
      painel: 'Aguardando chegada',
    })
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await p.$disconnect()
  })
