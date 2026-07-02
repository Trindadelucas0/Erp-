-- AlterTable
ALTER TABLE "Cfop" ADD COLUMN "cfopSugestaoEntradaId" TEXT;

-- AddForeignKey
ALTER TABLE "Cfop" ADD CONSTRAINT "Cfop_cfopSugestaoEntradaId_fkey" FOREIGN KEY ("cfopSugestaoEntradaId") REFERENCES "Cfop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
