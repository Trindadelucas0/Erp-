-- AlterTable
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "fornecedorPessoaId" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "analiseJson" JSONB;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "prazoPagamentoXml" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "prazoPagamentoTexto" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "NfeRecebidaItem" (
    "id" TEXT NOT NULL,
    "nfeRecebidaId" TEXT NOT NULL,
    "nItem" INTEGER NOT NULL,
    "descricao" TEXT,
    "gtin" TEXT,
    "codigoProduto" TEXT,
    "ncm" TEXT,
    "cfop" TEXT,
    "cst" TEXT,
    "origem" TEXT,
    "quantidade" DECIMAL(18,4),
    "valorUnitario" DECIMAL(18,4),
    "valorTotal" DECIMAL(18,2),
    "produtoId" TEXT,
    "vinculoModo" TEXT,
    "criticaCadastro" BOOLEAN NOT NULL DEFAULT false,
    "criticaFiscal" BOOLEAN NOT NULL DEFAULT false,
    "criticaNegociacao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeRecebidaItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NfeRecebidaItem_nfeRecebidaId_nItem_key" ON "NfeRecebidaItem"("nfeRecebidaId", "nItem");
CREATE INDEX IF NOT EXISTS "NfeRecebidaItem_nfeRecebidaId_idx" ON "NfeRecebidaItem"("nfeRecebidaId");
CREATE INDEX IF NOT EXISTS "NfeRecebidaItem_produtoId_idx" ON "NfeRecebidaItem"("produtoId");
CREATE INDEX IF NOT EXISTS "NfeRecebida_companyId_fornecedorPessoaId_idx" ON "NfeRecebida"("companyId", "fornecedorPessoaId");

ALTER TABLE "NfeRecebida" DROP CONSTRAINT IF EXISTS "NfeRecebida_fornecedorPessoaId_fkey";
ALTER TABLE "NfeRecebida" ADD CONSTRAINT "NfeRecebida_fornecedorPessoaId_fkey" FOREIGN KEY ("fornecedorPessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NfeRecebidaItem" DROP CONSTRAINT IF EXISTS "NfeRecebidaItem_nfeRecebidaId_fkey";
ALTER TABLE "NfeRecebidaItem" ADD CONSTRAINT "NfeRecebidaItem_nfeRecebidaId_fkey" FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NfeRecebidaItem" DROP CONSTRAINT IF EXISTS "NfeRecebidaItem_produtoId_fkey";
ALTER TABLE "NfeRecebidaItem" ADD CONSTRAINT "NfeRecebidaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
