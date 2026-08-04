-- Fase 1: EstoqueSaldo + EstoqueMovimento (kardex append-only)
CREATE TABLE IF NOT EXISTS "EstoqueSaldo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "qtdFisica" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qtdReservada" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qtdBloqueada" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qtdFiscal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstoqueSaldo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EstoqueMovimento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "dimensao" TEXT NOT NULL,
    "tipoMovimento" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "saldoDepois" DECIMAL(18,4) NOT NULL,
    "origem" TEXT NOT NULL,
    "origemId" TEXT,
    "chaveIdempotencia" TEXT NOT NULL,
    "observacao" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstoqueMovimento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EstoqueSaldo_companyId_produtoId_key" ON "EstoqueSaldo"("companyId", "produtoId");
CREATE UNIQUE INDEX IF NOT EXISTS "EstoqueSaldo_produtoId_key" ON "EstoqueSaldo"("produtoId");
CREATE INDEX IF NOT EXISTS "EstoqueSaldo_companyId_idx" ON "EstoqueSaldo"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "EstoqueMovimento_companyId_chaveIdempotencia_key" ON "EstoqueMovimento"("companyId", "chaveIdempotencia");
CREATE INDEX IF NOT EXISTS "EstoqueMovimento_companyId_produtoId_createdAt_idx" ON "EstoqueMovimento"("companyId", "produtoId", "createdAt");
CREATE INDEX IF NOT EXISTS "EstoqueMovimento_origem_origemId_idx" ON "EstoqueMovimento"("origem", "origemId");

DO $$ BEGIN
  ALTER TABLE "EstoqueSaldo" ADD CONSTRAINT "EstoqueSaldo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstoqueSaldo" ADD CONSTRAINT "EstoqueSaldo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstoqueMovimento" ADD CONSTRAINT "EstoqueMovimento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstoqueMovimento" ADD CONSTRAINT "EstoqueMovimento_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstoqueMovimento" ADD CONSTRAINT "EstoqueMovimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
