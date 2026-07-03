-- AlterTable Produto: novos flags e campos doc
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "flagEntrega";
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "embalagemMaster";
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "pallet";
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "enderecoWms";

ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "entregaNoAto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "entregaARetirar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "entregar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "entregaPorEncomenda" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "bloqueadoCompra" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "bloqueadoVenda" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "desativarAoZerarEstoque" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "capacidadeEmpilhamento" INTEGER;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "normaPalete" TEXT;

-- CreateTable ProdutoEmbalagemMaster
CREATE TABLE IF NOT EXISTS "ProdutoEmbalagemMaster" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(15,4) NOT NULL,
    "codigoBarras" TEXT,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProdutoEmbalagemMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProdutoEnderecoEstoque
CREATE TABLE IF NOT EXISTS "ProdutoEnderecoEstoque" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "apelido" TEXT,
    "endereco" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProdutoEnderecoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProdutoSimilar
CREATE TABLE IF NOT EXISTS "ProdutoSimilar" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "similarProdutoId" TEXT NOT NULL,
    CONSTRAINT "ProdutoSimilar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProdutoSimilar_produtoId_similarProdutoId_key" ON "ProdutoSimilar"("produtoId", "similarProdutoId");

ALTER TABLE "ProdutoEmbalagemMaster" DROP CONSTRAINT IF EXISTS "ProdutoEmbalagemMaster_produtoId_fkey";
ALTER TABLE "ProdutoEmbalagemMaster" ADD CONSTRAINT "ProdutoEmbalagemMaster_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProdutoEnderecoEstoque" DROP CONSTRAINT IF EXISTS "ProdutoEnderecoEstoque_produtoId_fkey";
ALTER TABLE "ProdutoEnderecoEstoque" ADD CONSTRAINT "ProdutoEnderecoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProdutoSimilar" DROP CONSTRAINT IF EXISTS "ProdutoSimilar_produtoId_fkey";
ALTER TABLE "ProdutoSimilar" ADD CONSTRAINT "ProdutoSimilar_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProdutoSimilar" DROP CONSTRAINT IF EXISTS "ProdutoSimilar_similarProdutoId_fkey";
ALTER TABLE "ProdutoSimilar" ADD CONSTRAINT "ProdutoSimilar_similarProdutoId_fkey" FOREIGN KEY ("similarProdutoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PedidoCompra: vínculo com crédito
ALTER TABLE "PedidoCompra" ADD COLUMN IF NOT EXISTS "creditoFornecedorId" TEXT;

ALTER TABLE "PedidoCompra" DROP CONSTRAINT IF EXISTS "PedidoCompra_creditoFornecedorId_fkey";
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_creditoFornecedorId_fkey" FOREIGN KEY ("creditoFornecedorId") REFERENCES "CreditoFornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
