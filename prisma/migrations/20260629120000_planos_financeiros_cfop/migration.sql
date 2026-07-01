-- PlanoFinanceiro: expandir schema + hierarquia
ALTER TABLE "PlanoFinanceiro" RENAME COLUMN "descricao" TO "nome";

ALTER TABLE "PlanoFinanceiro" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'receita';
ALTER TABLE "PlanoFinanceiro" ADD COLUMN "classificacao" TEXT;
ALTER TABLE "PlanoFinanceiro" ADD COLUMN "mostrarNaDre" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlanoFinanceiro" ADD COLUMN "permiteLancamentoManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanoFinanceiro" ADD COLUMN "exigeAnexoLancamento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanoFinanceiro" ADD COLUMN "permiteUsoConsumo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanoFinanceiro" ADD COLUMN "parentId" TEXT;

CREATE INDEX "PlanoFinanceiro_parentId_idx" ON "PlanoFinanceiro"("parentId");
CREATE INDEX "PlanoFinanceiro_companyId_tipo_idx" ON "PlanoFinanceiro"("companyId", "tipo");

ALTER TABLE "PlanoFinanceiro" ADD CONSTRAINT "PlanoFinanceiro_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "PlanoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cfop: nome + descricao + tipoCfop
ALTER TABLE "Cfop" ADD COLUMN "nome" TEXT;
ALTER TABLE "Cfop" ADD COLUMN "tipoCfop" TEXT NOT NULL DEFAULT '01';

UPDATE "Cfop" SET "nome" = "descricao" WHERE "nome" IS NULL;
ALTER TABLE "Cfop" ALTER COLUMN "nome" SET NOT NULL;

-- DadosFornecedor: CFOP sugestão XML + plano alternativo
ALTER TABLE "DadosFornecedor" ADD COLUMN "cfopSugestaoXmlId" TEXT;
ALTER TABLE "DadosFornecedor" ADD COLUMN "planoFinanceiroAlternativoId" TEXT;

ALTER TABLE "DadosFornecedor" ADD CONSTRAINT "DadosFornecedor_cfopSugestaoXmlId_fkey"
  FOREIGN KEY ("cfopSugestaoXmlId") REFERENCES "Cfop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DadosFornecedor" ADD CONSTRAINT "DadosFornecedor_planoFinanceiroAlternativoId_fkey"
  FOREIGN KEY ("planoFinanceiroAlternativoId") REFERENCES "PlanoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
