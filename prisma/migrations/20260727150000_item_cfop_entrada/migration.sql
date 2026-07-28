-- AlterTable NfeRecebidaItem: CFOP de entrada sugerido/escolhido por item na aba Fiscal
ALTER TABLE "NfeRecebidaItem" ADD COLUMN IF NOT EXISTS "cfopEntradaId" TEXT;

CREATE INDEX IF NOT EXISTS "NfeRecebidaItem_cfopEntradaId_idx" ON "NfeRecebidaItem"("cfopEntradaId");

ALTER TABLE "NfeRecebidaItem" DROP CONSTRAINT IF EXISTS "NfeRecebidaItem_cfopEntradaId_fkey";
ALTER TABLE "NfeRecebidaItem" ADD CONSTRAINT "NfeRecebidaItem_cfopEntradaId_fkey"
  FOREIGN KEY ("cfopEntradaId") REFERENCES "Cfop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
