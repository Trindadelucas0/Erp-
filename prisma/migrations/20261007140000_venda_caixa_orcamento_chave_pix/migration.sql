-- AlterTable
ALTER TABLE "ParametrizacaoCustoVenda" ADD COLUMN "chavePix" TEXT;

-- AlterTable
ALTER TABLE "VendaCaixa" ADD COLUMN "orcamentoId" TEXT,
ADD COLUMN "valorRecebido" DECIMAL(15,2),
ADD COLUMN "observacao" TEXT;

-- CreateIndex
CREATE INDEX "VendaCaixa_orcamentoId_idx" ON "VendaCaixa"("orcamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "VendaCaixa_companyId_orcamentoId_key" ON "VendaCaixa"("companyId", "orcamentoId");

-- AddForeignKey
ALTER TABLE "VendaCaixa" ADD CONSTRAINT "VendaCaixa_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
