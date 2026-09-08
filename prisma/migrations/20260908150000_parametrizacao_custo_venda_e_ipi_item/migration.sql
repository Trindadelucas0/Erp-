-- IPI do item da NFe + parametrização de custos por empresa/competência.

ALTER TABLE "NfeRecebidaItem" ADD COLUMN IF NOT EXISTS "valorIpi" DECIMAL(18,4);

CREATE TABLE IF NOT EXISTS "ParametrizacaoCustoVenda" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "pis" DECIMAL(18,4),
    "cofins" DECIMAL(18,4),
    "impRendaSupSimples" DECIMAL(18,4),
    "contribuicaoSocial" DECIMAL(18,4),
    "custoFixo" DECIMAL(18,4),
    "comissao" DECIMAL(18,4),
    "jurosMensaisCustoFinanOperac" DECIMAL(18,4),
    "aliquotaCbs" DECIMAL(18,4),
    "aliquotaIbs" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametrizacaoCustoVenda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParametrizacaoCustoVenda_companyId_competencia_key" ON "ParametrizacaoCustoVenda"("companyId", "competencia");
CREATE INDEX IF NOT EXISTS "ParametrizacaoCustoVenda_companyId_idx" ON "ParametrizacaoCustoVenda"("companyId");

ALTER TABLE "ParametrizacaoCustoVenda" DROP CONSTRAINT IF EXISTS "ParametrizacaoCustoVenda_companyId_fkey";
ALTER TABLE "ParametrizacaoCustoVenda" ADD CONSTRAINT "ParametrizacaoCustoVenda_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
