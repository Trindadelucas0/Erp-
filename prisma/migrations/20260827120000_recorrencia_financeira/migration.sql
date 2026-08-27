-- CreateTable
CREATE TABLE "RecorrenciaFinanceira" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fornecedorPessoaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecorrenciaFinanceira_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "NfeRecebida" ADD COLUMN "recorrenciaFinanceiraId" TEXT;

-- CreateIndex
CREATE INDEX "RecorrenciaFinanceira_companyId_fornecedorPessoaId_ativo_idx" ON "RecorrenciaFinanceira"("companyId", "fornecedorPessoaId", "ativo");

-- CreateIndex
CREATE INDEX "RecorrenciaFinanceira_companyId_ativo_idx" ON "RecorrenciaFinanceira"("companyId", "ativo");

-- CreateIndex
CREATE INDEX "RecorrenciaFinanceira_produtoId_idx" ON "RecorrenciaFinanceira"("produtoId");

-- CreateIndex
CREATE INDEX "NfeRecebida_recorrenciaFinanceiraId_idx" ON "NfeRecebida"("recorrenciaFinanceiraId");

-- AddForeignKey
ALTER TABLE "RecorrenciaFinanceira" ADD CONSTRAINT "RecorrenciaFinanceira_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecorrenciaFinanceira" ADD CONSTRAINT "RecorrenciaFinanceira_fornecedorPessoaId_fkey" FOREIGN KEY ("fornecedorPessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecorrenciaFinanceira" ADD CONSTRAINT "RecorrenciaFinanceira_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeRecebida" ADD CONSTRAINT "NfeRecebida_recorrenciaFinanceiraId_fkey" FOREIGN KEY ("recorrenciaFinanceiraId") REFERENCES "RecorrenciaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;
