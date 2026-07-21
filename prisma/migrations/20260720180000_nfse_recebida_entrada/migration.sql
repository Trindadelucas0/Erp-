-- AlterTable
ALTER TABLE "ConfiguracaoFocusNfe" ADD COLUMN IF NOT EXISTS "ultimaVersaoNfseRecebida" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "tipoDocumento" TEXT NOT NULL DEFAULT 'nfe55';

CREATE INDEX IF NOT EXISTS "NfeRecebida_companyId_tipoDocumento_idx" ON "NfeRecebida"("companyId", "tipoDocumento");
