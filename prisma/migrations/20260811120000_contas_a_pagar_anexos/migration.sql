-- CreateTable
CREATE TABLE IF NOT EXISTS "ContaPagarAnexo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contaPagarId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaPagarAnexo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContaPagarAnexo_contaPagarId_idx" ON "ContaPagarAnexo"("contaPagarId");
CREATE INDEX IF NOT EXISTS "ContaPagarAnexo_companyId_idx" ON "ContaPagarAnexo"("companyId");

ALTER TABLE "ContaPagarAnexo"
  DROP CONSTRAINT IF EXISTS "ContaPagarAnexo_companyId_fkey";
ALTER TABLE "ContaPagarAnexo"
  ADD CONSTRAINT "ContaPagarAnexo_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContaPagarAnexo"
  DROP CONSTRAINT IF EXISTS "ContaPagarAnexo_contaPagarId_fkey";
ALTER TABLE "ContaPagarAnexo"
  ADD CONSTRAINT "ContaPagarAnexo_contaPagarId_fkey"
  FOREIGN KEY ("contaPagarId") REFERENCES "ContaPagar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContaPagarAnexo"
  DROP CONSTRAINT IF EXISTS "ContaPagarAnexo_usuarioId_fkey";
ALTER TABLE "ContaPagarAnexo"
  ADD CONSTRAINT "ContaPagarAnexo_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
