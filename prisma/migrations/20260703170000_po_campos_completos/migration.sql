-- Campos legado e prazos no pedido de compra
ALTER TABLE "PedidoCompra" ADD COLUMN "observacoesInternas" TEXT;
ALTER TABLE "PedidoCompra" ADD COLUMN "tipoCompra" TEXT NOT NULL DEFAULT 'revenda';
ALTER TABLE "PedidoCompra" ADD COLUMN "dataFaturamento" TIMESTAMP(3);
ALTER TABLE "PedidoCompra" ADD COLUMN "previsaoEntrega" TIMESTAMP(3);
ALTER TABLE "PedidoCompra" ADD COLUMN "valorFrete" DECIMAL(15,2);
ALTER TABLE "PedidoCompra" ADD COLUMN "valorFreteSugerido" DECIMAL(15,2);
ALTER TABLE "PedidoCompra" ADD COLUMN "prazosPagamento" JSONB;
ALTER TABLE "PedidoCompra" ADD COLUMN "rateioParcelas" TEXT NOT NULL DEFAULT 'igual';

-- Campos legado nos itens
ALTER TABLE "PedidoCompraItem" ADD COLUMN "codigoOriginal" TEXT;
ALTER TABLE "PedidoCompraItem" ADD COLUMN "percentualDesconto" DECIMAL(15,4);
ALTER TABLE "PedidoCompraItem" ADD COLUMN "valorDesconto" DECIMAL(15,2);
ALTER TABLE "PedidoCompraItem" ADD COLUMN "outrasDespesas" DECIMAL(15,4);
ALTER TABLE "PedidoCompraItem" ADD COLUMN "totalLiquido" DECIMAL(15,2);
ALTER TABLE "PedidoCompraItem" ADD COLUMN "previsaoEntrega" TIMESTAMP(3);

-- Pedido de venda mínimo (encomenda)
CREATE TABLE "PedidoVenda" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "sobEncomenda" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoVenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PedidoVenda_companyId_numero_key" ON "PedidoVenda"("companyId", "numero");
CREATE INDEX "PedidoVenda_companyId_sobEncomenda_idx" ON "PedidoVenda"("companyId", "sobEncomenda");

ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_pedidoVendaId_fkey" FOREIGN KEY ("pedidoVendaId") REFERENCES "PedidoVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
