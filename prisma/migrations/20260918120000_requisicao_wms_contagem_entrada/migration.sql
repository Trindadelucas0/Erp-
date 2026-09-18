-- AlterTable
ALTER TABLE "RequisicaoWms" ADD COLUMN "nfeRecebidaId" TEXT;

-- AddForeignKey
ALTER TABLE "RequisicaoWms" ADD CONSTRAINT "RequisicaoWms_nfeRecebidaId_fkey" FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RequisicaoWms_companyId_nfeRecebidaId_idx" ON "RequisicaoWms"("companyId", "nfeRecebidaId");
