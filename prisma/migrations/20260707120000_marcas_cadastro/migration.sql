-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Marca_companyId_ativo_idx" ON "Marca"("companyId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_companyId_nome_key" ON "Marca"("companyId", "nome");

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migra marcas já usadas em produtos
INSERT INTO "Marca" ("id", "companyId", "nome", "ativo", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    sub."companyId",
    sub.nome,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        "companyId",
        UPPER(TRIM("marca")) AS nome
    FROM "Produto"
    WHERE TRIM("marca") <> ''
) sub
ON CONFLICT ("companyId", "nome") DO NOTHING;
