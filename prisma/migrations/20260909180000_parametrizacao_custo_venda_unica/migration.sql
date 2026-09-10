-- Determinante permanente: um ParametrizacaoCustoVenda por empresa.
-- Mantém a linha com updatedAt mais recente e remove competência.

DELETE FROM "ParametrizacaoCustoVenda" AS a
USING "ParametrizacaoCustoVenda" AS b
WHERE a."companyId" = b."companyId"
  AND a."id" <> b."id"
  AND (
    a."updatedAt" < b."updatedAt"
    OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id")
  );

ALTER TABLE "ParametrizacaoCustoVenda" DROP CONSTRAINT IF EXISTS "ParametrizacaoCustoVenda_companyId_competencia_key";
DROP INDEX IF EXISTS "ParametrizacaoCustoVenda_companyId_competencia_key";
DROP INDEX IF EXISTS "ParametrizacaoCustoVenda_companyId_idx";

ALTER TABLE "ParametrizacaoCustoVenda" DROP COLUMN IF EXISTS "competencia";

CREATE UNIQUE INDEX IF NOT EXISTS "ParametrizacaoCustoVenda_companyId_key" ON "ParametrizacaoCustoVenda"("companyId");
