-- AlterTable
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD COLUMN "tipoAnexo" TEXT NOT NULL DEFAULT 'documento_fornecedor';
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD COLUMN "anexoOrigemId" TEXT;
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD COLUMN "conferidoEm" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PedidoCompraAnexoFornecedor_anexoOrigemId_idx" ON "PedidoCompraAnexoFornecedor"("anexoOrigemId");
