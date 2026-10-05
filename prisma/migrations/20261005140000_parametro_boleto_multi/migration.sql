-- DropIndex
DROP INDEX "ConfiguracaoBoleto_companyId_key";

-- AlterTable
ALTER TABLE "ConfiguracaoBoleto" ADD COLUMN "nome" TEXT;
ALTER TABLE "ConfiguracaoBoleto" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ConfiguracaoBoleto" ADD COLUMN "padrao" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ConfiguracaoBoleto" SET "nome" = 'Padrão', "ativo" = true, "padrao" = true WHERE "nome" IS NULL;

ALTER TABLE "ConfiguracaoBoleto" ALTER COLUMN "nome" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoBoleto_companyId_nome_key" ON "ConfiguracaoBoleto"("companyId", "nome");

-- CreateIndex
CREATE INDEX "ConfiguracaoBoleto_companyId_ativo_idx" ON "ConfiguracaoBoleto"("companyId", "ativo");
