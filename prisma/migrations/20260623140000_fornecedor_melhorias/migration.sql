-- PessoaDadosBancario
CREATE TABLE "PessoaDadosBancario" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "apelido" TEXT,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "tipoConta" TEXT,
    "pix" TEXT,
    "favorecido" TEXT,
    "documentoFavorecido" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PessoaDadosBancario_pkey" PRIMARY KEY ("id")
);

-- PessoaCnae
CREATE TABLE "PessoaCnae" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PessoaCnae_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PessoaCnae_pessoaId_codigo_key" ON "PessoaCnae"("pessoaId", "codigo");

-- PlanoFinanceiro
CREATE TABLE "PlanoFinanceiro" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanoFinanceiro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanoFinanceiro_codigo_companyId_key" ON "PlanoFinanceiro"("codigo", "companyId");

-- Cfop
CREATE TABLE "Cfop" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'entrada',
    "companyId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cfop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cfop_codigo_companyId_key" ON "Cfop"("codigo", "companyId");

-- FornecedorPlanoFinanceiro
CREATE TABLE "FornecedorPlanoFinanceiro" (
    "dadosFornecedorId" TEXT NOT NULL,
    "planoFinanceiroId" TEXT NOT NULL,
    CONSTRAINT "FornecedorPlanoFinanceiro_pkey" PRIMARY KEY ("dadosFornecedorId","planoFinanceiroId")
);

-- FornecedorCfopEntrada
CREATE TABLE "FornecedorCfopEntrada" (
    "dadosFornecedorId" TEXT NOT NULL,
    "cfopId" TEXT NOT NULL,
    CONSTRAINT "FornecedorCfopEntrada_pkey" PRIMARY KEY ("dadosFornecedorId","cfopId")
);

-- DadosFornecedor: novos campos
ALTER TABLE "DadosFornecedor" ADD COLUMN "tipoOperacao" TEXT NOT NULL DEFAULT 'revenda';
ALTER TABLE "DadosFornecedor" ADD COLUMN "prazoPagamento1" INTEGER;
ALTER TABLE "DadosFornecedor" ADD COLUMN "prazoPagamento2" INTEGER;
ALTER TABLE "DadosFornecedor" ADD COLUMN "prazoPagamento3" INTEGER;
ALTER TABLE "DadosFornecedor" ADD COLUMN "prazoPagamento4" INTEGER;
ALTER TABLE "DadosFornecedor" ADD COLUMN "prazoPagamento5" INTEGER;
ALTER TABLE "DadosFornecedor" ADD COLUMN "prazoPagamento6" INTEGER;

-- Migrar cnae legado para PessoaCnae
INSERT INTO "PessoaCnae" ("id", "pessoaId", "codigo", "descricao", "principal", "createdAt")
SELECT gen_random_uuid()::text, "id", "cnae", NULL, true, NOW()
FROM "Pessoa"
WHERE "cnae" IS NOT NULL AND "cnae" <> '';

-- Remover colunas antigas de DadosFornecedor
ALTER TABLE "DadosFornecedor" DROP COLUMN IF EXISTS "condicaoPagamento";
ALTER TABLE "DadosFornecedor" DROP COLUMN IF EXISTS "prazoEntrega";

-- Foreign keys
ALTER TABLE "PessoaDadosBancario" ADD CONSTRAINT "PessoaDadosBancario_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PessoaCnae" ADD CONSTRAINT "PessoaCnae_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanoFinanceiro" ADD CONSTRAINT "PlanoFinanceiro_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cfop" ADD CONSTRAINT "Cfop_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FornecedorPlanoFinanceiro" ADD CONSTRAINT "FornecedorPlanoFinanceiro_dadosFornecedorId_fkey" FOREIGN KEY ("dadosFornecedorId") REFERENCES "DadosFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FornecedorPlanoFinanceiro" ADD CONSTRAINT "FornecedorPlanoFinanceiro_planoFinanceiroId_fkey" FOREIGN KEY ("planoFinanceiroId") REFERENCES "PlanoFinanceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FornecedorCfopEntrada" ADD CONSTRAINT "FornecedorCfopEntrada_dadosFornecedorId_fkey" FOREIGN KEY ("dadosFornecedorId") REFERENCES "DadosFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FornecedorCfopEntrada" ADD CONSTRAINT "FornecedorCfopEntrada_cfopId_fkey" FOREIGN KEY ("cfopId") REFERENCES "Cfop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
