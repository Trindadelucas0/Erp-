-- AlterTable
ALTER TABLE "PedidoVenda" ADD COLUMN "observacoes" TEXT;
ALTER TABLE "PedidoVenda" ADD COLUMN "totalLiquido" DECIMAL(15,2) NOT NULL DEFAULT 0;

UPDATE "PedidoVenda" SET "status" = 'rascunho' WHERE "status" = 'aberto';
ALTER TABLE "PedidoVenda" ALTER COLUMN "status" SET DEFAULT 'rascunho';

CREATE INDEX "PedidoVenda_companyId_status_idx" ON "PedidoVenda"("companyId", "status");

-- CreateTable
CREATE TABLE "PedidoVendaItem" (
    "id" TEXT NOT NULL,
    "pedidoVendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "modoQuantidade" TEXT NOT NULL,
    "quantidadeInformada" DECIMAL(15,4) NOT NULL,
    "quantidadeUnidadeVenda" DECIMAL(15,4) NOT NULL,
    "itensPorEmbalagem" DECIMAL(15,4) NOT NULL,
    "unidade" TEXT NOT NULL,
    "precoUnitario" DECIMAL(15,4) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoVendaItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PedidoVendaItem_pedidoVendaId_idx" ON "PedidoVendaItem"("pedidoVendaId");
CREATE INDEX "PedidoVendaItem_produtoId_idx" ON "PedidoVendaItem"("produtoId");

ALTER TABLE "PedidoVendaItem" ADD CONSTRAINT "PedidoVendaItem_pedidoVendaId_fkey" FOREIGN KEY ("pedidoVendaId") REFERENCES "PedidoVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PedidoVendaItem" ADD CONSTRAINT "PedidoVendaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
