-- AlterTable NfeRecebida
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "modFrete" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "chaveNfeReferenciada" TEXT;

CREATE INDEX IF NOT EXISTS "NfeRecebida_companyId_chaveNfeReferenciada_idx"
  ON "NfeRecebida"("companyId", "chaveNfeReferenciada");

-- AlterTable NfeRecebidaItem
ALTER TABLE "NfeRecebidaItem" ADD COLUMN IF NOT EXISTS "pesoKg" DECIMAL(18,4);
ALTER TABLE "NfeRecebidaItem" ADD COLUMN IF NOT EXISTS "custoFreteRateado" DECIMAL(18,4);

-- AlterTable DadosFornecedor
ALTER TABLE "DadosFornecedor" ADD COLUMN IF NOT EXISTS "regraRateioFrete" TEXT NOT NULL DEFAULT 'valor';

-- CreateTable NfeCteVinculo
CREATE TABLE IF NOT EXISTS "NfeCteVinculo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeRecebidaId" TEXT NOT NULL,
    "cteRecebidaId" TEXT NOT NULL,
    "chaveNfeReferenciada" TEXT,
    "origemVinculo" TEXT NOT NULL DEFAULT 'automatico',
    "valorFrete" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeCteVinculo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NfeCteVinculo_cteRecebidaId_key" ON "NfeCteVinculo"("cteRecebidaId");
CREATE INDEX IF NOT EXISTS "NfeCteVinculo_companyId_nfeRecebidaId_idx" ON "NfeCteVinculo"("companyId", "nfeRecebidaId");
CREATE INDEX IF NOT EXISTS "NfeCteVinculo_companyId_chaveNfeReferenciada_idx" ON "NfeCteVinculo"("companyId", "chaveNfeReferenciada");

ALTER TABLE "NfeCteVinculo" DROP CONSTRAINT IF EXISTS "NfeCteVinculo_nfeRecebidaId_fkey";
ALTER TABLE "NfeCteVinculo" ADD CONSTRAINT "NfeCteVinculo_nfeRecebidaId_fkey"
  FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NfeCteVinculo" DROP CONSTRAINT IF EXISTS "NfeCteVinculo_cteRecebidaId_fkey";
ALTER TABLE "NfeCteVinculo" ADD CONSTRAINT "NfeCteVinculo_cteRecebidaId_fkey"
  FOREIGN KEY ("cteRecebidaId") REFERENCES "NfeRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable DespesaEntradaDocumento
CREATE TABLE IF NOT EXISTS "DespesaEntradaDocumento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeRecebidaId" TEXT NOT NULL,
    "pessoaId" TEXT,
    "planoFinanceiroId" TEXT,
    "valor" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "origem" TEXT NOT NULL DEFAULT 'cte',
    "vencimento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DespesaEntradaDocumento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DespesaEntradaDocumento_nfeRecebidaId_origem_key"
  ON "DespesaEntradaDocumento"("nfeRecebidaId", "origem");
CREATE INDEX IF NOT EXISTS "DespesaEntradaDocumento_companyId_status_idx"
  ON "DespesaEntradaDocumento"("companyId", "status");
CREATE INDEX IF NOT EXISTS "DespesaEntradaDocumento_pessoaId_idx"
  ON "DespesaEntradaDocumento"("pessoaId");

ALTER TABLE "DespesaEntradaDocumento" DROP CONSTRAINT IF EXISTS "DespesaEntradaDocumento_companyId_fkey";
ALTER TABLE "DespesaEntradaDocumento" ADD CONSTRAINT "DespesaEntradaDocumento_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DespesaEntradaDocumento" DROP CONSTRAINT IF EXISTS "DespesaEntradaDocumento_nfeRecebidaId_fkey";
ALTER TABLE "DespesaEntradaDocumento" ADD CONSTRAINT "DespesaEntradaDocumento_nfeRecebidaId_fkey"
  FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DespesaEntradaDocumento" DROP CONSTRAINT IF EXISTS "DespesaEntradaDocumento_pessoaId_fkey";
ALTER TABLE "DespesaEntradaDocumento" ADD CONSTRAINT "DespesaEntradaDocumento_pessoaId_fkey"
  FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DespesaEntradaDocumento" DROP CONSTRAINT IF EXISTS "DespesaEntradaDocumento_planoFinanceiroId_fkey";
ALTER TABLE "DespesaEntradaDocumento" ADD CONSTRAINT "DespesaEntradaDocumento_planoFinanceiroId_fkey"
  FOREIGN KEY ("planoFinanceiroId") REFERENCES "PlanoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
