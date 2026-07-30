-- AlterTable NfeRecebida: CFOP de entrada sugerido/escolhido no documento CT-e (aba Frete/CT-e)
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "cfopEntradaId" TEXT;

CREATE INDEX IF NOT EXISTS "NfeRecebida_cfopEntradaId_idx" ON "NfeRecebida"("cfopEntradaId");

ALTER TABLE "NfeRecebida" DROP CONSTRAINT IF EXISTS "NfeRecebida_cfopEntradaId_fkey";
ALTER TABLE "NfeRecebida" ADD CONSTRAINT "NfeRecebida_cfopEntradaId_fkey"
  FOREIGN KEY ("cfopEntradaId") REFERENCES "Cfop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
