-- Painel Com problemas: status extras, desfecho e thread de tratativas
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "problemaDesfecho" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "problemaMarcadoEm" TIMESTAMP(3);
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "problemaResolvidoEm" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "NfeRecebidaTratativa" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeRecebidaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeRecebidaTratativa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NfeRecebidaTratativa_nfeRecebidaId_createdAt_idx"
  ON "NfeRecebidaTratativa"("nfeRecebidaId", "createdAt");

CREATE INDEX IF NOT EXISTS "NfeRecebidaTratativa_companyId_nfeRecebidaId_idx"
  ON "NfeRecebidaTratativa"("companyId", "nfeRecebidaId");

DO $$ BEGIN
  ALTER TABLE "NfeRecebidaTratativa"
    ADD CONSTRAINT "NfeRecebidaTratativa_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NfeRecebidaTratativa"
    ADD CONSTRAINT "NfeRecebidaTratativa_nfeRecebidaId_fkey"
    FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NfeRecebidaTratativa"
    ADD CONSTRAINT "NfeRecebidaTratativa_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
