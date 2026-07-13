-- Remove vínculo de encomenda e tabelas de pedido de venda.

ALTER TABLE "PedidoCompra" DROP CONSTRAINT IF EXISTS "PedidoCompra_pedidoVendaId_fkey";

ALTER TABLE "PedidoCompra" DROP COLUMN IF EXISTS "pedidoVendaId";

DROP TABLE IF EXISTS "PedidoVendaItem";

DROP TABLE IF EXISTS "PedidoVenda";
