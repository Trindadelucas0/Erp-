CREATE TABLE "RegraFiscal" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "mercadoriaModo" TEXT NOT NULL DEFAULT 'nota',
  "mercadoriaAliquota" DECIMAL(7,4),
  "transporteModo" TEXT NOT NULL DEFAULT 'nota',
  "transporteAliquota" DECIMAL(7,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegraFiscal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegraFiscal_mercadoria_check" CHECK (
    ("mercadoriaModo" = 'nota' AND "mercadoriaAliquota" IS NULL) OR
    ("mercadoriaModo" = 'pre_definida' AND "mercadoriaAliquota" IS NOT NULL AND "mercadoriaAliquota" BETWEEN 0 AND 100)),
  CONSTRAINT "RegraFiscal_transporte_check" CHECK (
    ("transporteModo" = 'nota' AND "transporteAliquota" IS NULL) OR
    ("transporteModo" = 'pre_definida' AND "transporteAliquota" IS NOT NULL AND "transporteAliquota" BETWEEN 0 AND 100))
);
CREATE UNIQUE INDEX "RegraFiscal_companyId_key" ON "RegraFiscal"("companyId");
ALTER TABLE "RegraFiscal" ADD CONSTRAINT "RegraFiscal_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
