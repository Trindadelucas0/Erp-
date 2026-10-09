-- AlterTable
ALTER TABLE "VendaCaixa" ADD COLUMN "numeroParcelas" INTEGER,
ADD COLUMN "cartaoPagamentoId" TEXT;

-- CreateIndex
CREATE INDEX "VendaCaixa_cartaoPagamentoId_idx" ON "VendaCaixa"("cartaoPagamentoId");

-- AddForeignKey
ALTER TABLE "VendaCaixa" ADD CONSTRAINT "VendaCaixa_cartaoPagamentoId_fkey" FOREIGN KEY ("cartaoPagamentoId") REFERENCES "CartaoPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
