-- Fase 1: resolução administrativa da divergência de contagem (bloqueio de itens)
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "divergenciaDesfecho" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "divergenciaResolvidaEm" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "NfeRecebidaAnexo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeRecebidaId" TEXT NOT NULL,
    "tipoAnexo" TEXT NOT NULL DEFAULT 'ressalva_divergencia',
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfeRecebidaAnexo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NfeRecebidaAnexo_companyId_nfeRecebidaId_idx"
  ON "NfeRecebidaAnexo"("companyId", "nfeRecebidaId");

DO $$ BEGIN
  ALTER TABLE "NfeRecebidaAnexo"
    ADD CONSTRAINT "NfeRecebidaAnexo_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NfeRecebidaAnexo"
    ADD CONSTRAINT "NfeRecebidaAnexo_nfeRecebidaId_fkey"
    FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NfeRecebidaAnexo"
    ADD CONSTRAINT "NfeRecebidaAnexo_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
