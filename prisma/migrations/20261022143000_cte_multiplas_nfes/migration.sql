DROP INDEX IF EXISTS "NfeCteVinculo_cteRecebidaId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "NfeCteVinculo_cteRecebidaId_nfeRecebidaId_key"
  ON "NfeCteVinculo"("cteRecebidaId", "nfeRecebidaId");

CREATE INDEX IF NOT EXISTS "NfeCteVinculo_companyId_cteRecebidaId_idx"
  ON "NfeCteVinculo"("companyId", "cteRecebidaId");
