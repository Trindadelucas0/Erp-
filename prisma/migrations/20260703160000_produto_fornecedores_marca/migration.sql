-- Marca obrigatória: preenche registros existentes sem marca
UPDATE "Produto" SET "marca" = '—' WHERE "marca" IS NULL OR TRIM("marca") = '';
ALTER TABLE "Produto" ALTER COLUMN "marca" SET NOT NULL;

-- Tabela de fornecedores por produto (1:N)
CREATE TABLE "ProdutoFornecedor" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "fornecedorPessoaId" TEXT NOT NULL,
    "codigoFornecedor" TEXT,
    "multiploEntrada" DECIMAL(15,4),
    "multiplicadorEntrada" DECIMAL(15,4),
    "unidadeEntrada" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoFornecedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProdutoFornecedor_produtoId_fornecedorPessoaId_key"
    ON "ProdutoFornecedor"("produtoId", "fornecedorPessoaId");

ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey"
    FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorPessoaId_fkey"
    FOREIGN KEY ("fornecedorPessoaId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migra fornecedor único existente para a nova tabela
INSERT INTO "ProdutoFornecedor" (
    "id",
    "produtoId",
    "fornecedorPessoaId",
    "codigoFornecedor",
    "multiploEntrada",
    "unidadeEntrada",
    "ordem"
)
SELECT
    gen_random_uuid()::text,
    "id",
    "fornecedorPessoaId",
    "codigoFornecedor",
    "multiploEntrada",
    "unidadeEntrada",
    0
FROM "Produto"
WHERE "fornecedorPessoaId" IS NOT NULL;

-- Remove colunas escalares de fornecedor do Produto
ALTER TABLE "Produto" DROP CONSTRAINT IF EXISTS "Produto_fornecedorPessoaId_fkey";
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "fornecedorPessoaId";
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "codigoFornecedor";
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "multiploEntrada";
ALTER TABLE "Produto" DROP COLUMN IF EXISTS "unidadeEntrada";
