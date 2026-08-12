-- AlterTable
ALTER TABLE "Cfop" ADD COLUMN "planoFinanceiroPadraoId" TEXT;

-- AddForeignKey
ALTER TABLE "Cfop" ADD CONSTRAINT "Cfop_planoFinanceiroPadraoId_fkey" FOREIGN KEY ("planoFinanceiroPadraoId") REFERENCES "PlanoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
