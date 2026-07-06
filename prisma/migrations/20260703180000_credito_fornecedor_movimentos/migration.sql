-- Crédito fornecedor: movimentos e reservas de pedido de compra

CREATE TABLE "CreditoFornecedorMovimento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "creditoFornecedorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "saldoAnterior" DECIMAL(15,2) NOT NULL,
    "saldoDepois" DECIMAL(15,2) NOT NULL,
    "motivo" TEXT,
    "pedidoCompraId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditoFornecedorMovimento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditoReservaPedido" (
    "id" TEXT NOT NULL,
    "creditoFornecedorId" TEXT NOT NULL,
    "pedidoCompraId" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditoReservaPedido_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditoReservaPedido_pedidoCompraId_key" ON "CreditoReservaPedido"("pedidoCompraId");

CREATE INDEX "CreditoFornecedorMovimento_creditoFornecedorId_createdAt_idx" ON "CreditoFornecedorMovimento"("creditoFornecedorId", "createdAt");

CREATE INDEX "CreditoFornecedorMovimento_companyId_pedidoCompraId_idx" ON "CreditoFornecedorMovimento"("companyId", "pedidoCompraId");

CREATE INDEX "CreditoReservaPedido_creditoFornecedorId_status_idx" ON "CreditoReservaPedido"("creditoFornecedorId", "status");

ALTER TABLE "CreditoFornecedorMovimento" ADD CONSTRAINT "CreditoFornecedorMovimento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditoFornecedorMovimento" ADD CONSTRAINT "CreditoFornecedorMovimento_creditoFornecedorId_fkey" FOREIGN KEY ("creditoFornecedorId") REFERENCES "CreditoFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditoFornecedorMovimento" ADD CONSTRAINT "CreditoFornecedorMovimento_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditoReservaPedido" ADD CONSTRAINT "CreditoReservaPedido_creditoFornecedorId_fkey" FOREIGN KEY ("creditoFornecedorId") REFERENCES "CreditoFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditoReservaPedido" ADD CONSTRAINT "CreditoReservaPedido_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
