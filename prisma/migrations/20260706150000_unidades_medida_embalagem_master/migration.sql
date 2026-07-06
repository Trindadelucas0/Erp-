-- Cadastro de unidades de medida e dimensões da embalagem master
CREATE TABLE IF NOT EXISTS "UnidadeMedida" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadeMedida_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UnidadeMedida_companyId_sigla_key" ON "UnidadeMedida"("companyId", "sigla");
CREATE INDEX IF NOT EXISTS "UnidadeMedida_companyId_ativo_idx" ON "UnidadeMedida"("companyId", "ativo");

ALTER TABLE "UnidadeMedida" DROP CONSTRAINT IF EXISTS "UnidadeMedida_companyId_fkey";
ALTER TABLE "UnidadeMedida" ADD CONSTRAINT "UnidadeMedida_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProdutoEmbalagemMaster" ADD COLUMN IF NOT EXISTS "alturaCm" DECIMAL(10,2);
ALTER TABLE "ProdutoEmbalagemMaster" ADD COLUMN IF NOT EXISTS "larguraCm" DECIMAL(10,2);
ALTER TABLE "ProdutoEmbalagemMaster" ADD COLUMN IF NOT EXISTS "comprimentoCm" DECIMAL(10,2);
