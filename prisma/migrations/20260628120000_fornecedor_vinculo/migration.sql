-- CreateTable: FornecedorVinculo
CREATE TABLE "FornecedorVinculo" (
    "id" TEXT NOT NULL,
    "fornecedorAId" TEXT NOT NULL,
    "fornecedorBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FornecedorVinculo_pkey" PRIMARY KEY ("id")
);

-- Migrate GrupoEconomico members to clique edges (ordered pair)
INSERT INTO "FornecedorVinculo" ("id", "fornecedorAId", "fornecedorBId", "createdAt")
SELECT
    gen_random_uuid()::text,
    CASE WHEN f1.id < f2.id THEN f1.id ELSE f2.id END,
    CASE WHEN f1.id < f2.id THEN f2.id ELSE f1.id END,
    NOW()
FROM "DadosFornecedor" f1
INNER JOIN "DadosFornecedor" f2
    ON f1."grupoEconomicoId" = f2."grupoEconomicoId"
    AND f1.id < f2.id
WHERE f1."grupoEconomicoId" IS NOT NULL;

-- DropForeignKey and column grupoEconomicoId
ALTER TABLE "DadosFornecedor" DROP CONSTRAINT IF EXISTS "DadosFornecedor_grupoEconomicoId_fkey";
ALTER TABLE "DadosFornecedor" DROP COLUMN "grupoEconomicoId";

-- DropTable GrupoEconomico
DROP TABLE "GrupoEconomico";

-- CreateIndex
CREATE UNIQUE INDEX "FornecedorVinculo_fornecedorAId_fornecedorBId_key" ON "FornecedorVinculo"("fornecedorAId", "fornecedorBId");

-- AddForeignKey
ALTER TABLE "FornecedorVinculo" ADD CONSTRAINT "FornecedorVinculo_fornecedorAId_fkey" FOREIGN KEY ("fornecedorAId") REFERENCES "DadosFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FornecedorVinculo" ADD CONSTRAINT "FornecedorVinculo_fornecedorBId_fkey" FOREIGN KEY ("fornecedorBId") REFERENCES "DadosFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
