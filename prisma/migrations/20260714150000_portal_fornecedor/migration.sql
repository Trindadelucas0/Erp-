-- Portal do fornecedor: liberação do pedido, sessão de acesso e anexos recebidos
ALTER TABLE "PedidoCompra" ADD COLUMN "portalLiberadoEm" TIMESTAMP(3);

CREATE TABLE "PedidoCompraAcessoPortal" (
    "id" TEXT NOT NULL,
    "pedidoCompraId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    CONSTRAINT "PedidoCompraAcessoPortal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PedidoCompraAcessoPortal_token_key" ON "PedidoCompraAcessoPortal"("token");
CREATE INDEX "PedidoCompraAcessoPortal_pedidoCompraId_idx" ON "PedidoCompraAcessoPortal"("pedidoCompraId");

CREATE TABLE "PedidoCompraAnexoFornecedor" (
    "id" TEXT NOT NULL,
    "pedidoCompraId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PedidoCompraAnexoFornecedor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PedidoCompraAnexoFornecedor_pedidoCompraId_idx" ON "PedidoCompraAnexoFornecedor"("pedidoCompraId");

ALTER TABLE "PedidoCompraAcessoPortal" ADD CONSTRAINT "PedidoCompraAcessoPortal_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD CONSTRAINT "PedidoCompraAnexoFornecedor_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
