-- Bloco 1 — Cadastro Unificado (Pessoa)
-- Migração: Cliente → Pessoa + PessoaPapel + DadosCliente + PessoaContato + PessoaEndereco
-- Os dados existentes são preservados. O id da Pessoa é o mesmo id do Cliente anterior.

-- ─── 1. Criar novas tabelas ───────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "Pessoa" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "cpf" TEXT,
    "rg" TEXT,
    "dataNascimento" TEXT,
    "cnpj" TEXT,
    "nomeFantasia" TEXT,
    "cnae" TEXT,
    "dataFundacao" TEXT,
    "ie" TEXT,
    "im" TEXT,
    "suframa" TEXT,
    "simplesNacional" BOOLEAN NOT NULL DEFAULT false,
    "observacaoNF" TEXT,
    "nome" TEXT NOT NULL,
    "indicadorIe" TEXT NOT NULL DEFAULT '9',
    "observacoes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PessoaPapel" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PessoaPapel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DadosCliente" (
    "id" TEXT NOT NULL,
    "papelId" TEXT NOT NULL,
    "aceitaNFe55" BOOLEAN NOT NULL DEFAULT true,
    "calculaComissao" BOOLEAN NOT NULL DEFAULT false,
    "vendedorId" TEXT,
    "statusAprovacao" TEXT NOT NULL DEFAULT 'ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DadosCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PessoaContato" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PessoaContato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PessoaEndereco" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "apelido" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "codigoIbge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PessoaEndereco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pessoa_cpf_companyId_key" ON "Pessoa"("cpf", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Pessoa_cnpj_companyId_key" ON "Pessoa"("cnpj", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PessoaPapel_pessoaId_papel_key" ON "PessoaPapel"("pessoaId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "DadosCliente_papelId_key" ON "DadosCliente"("papelId");

-- AddForeignKey
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaPapel" ADD CONSTRAINT "PessoaPapel_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadosCliente" ADD CONSTRAINT "DadosCliente_papelId_fkey" FOREIGN KEY ("papelId") REFERENCES "PessoaPapel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaContato" ADD CONSTRAINT "PessoaContato_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaEndereco" ADD CONSTRAINT "PessoaEndereco_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 2. Migrar dados existentes de Cliente → nova estrutura ───────────────────

-- 2a. Copiar registros para Pessoa (mantém o mesmo id para preservar referências em auditoria)
INSERT INTO "Pessoa" (
    "id", "tipo", "ativo",
    "cpf", "rg", "dataNascimento",
    "cnpj", "nomeFantasia", "ie", "im", "suframa",
    "nome", "indicadorIe", "observacoes",
    "companyId", "createdAt", "updatedAt"
)
SELECT
    "id", "tipo", "ativo",
    "cpf", "rg", "dataNascimento",
    "cnpj", "nomeFantasia", "ie", "im", "suframa",
    "nome", "indicadorIe", "observacoes",
    "companyId", "createdAt", "updatedAt"
FROM "Cliente";

-- 2b. Criar PessoaPapel para cada cliente migrado
INSERT INTO "PessoaPapel" ("id", "pessoaId", "papel", "ativo", "createdAt")
SELECT
    gen_random_uuid(),
    "id",
    'cliente',
    "ativo",
    "createdAt"
FROM "Cliente";

-- 2c. Criar DadosCliente para cada papel criado
INSERT INTO "DadosCliente" ("id", "papelId", "aceitaNFe55", "calculaComissao", "statusAprovacao", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    pp."id",
    true,
    false,
    'ativo',
    NOW(),
    NOW()
FROM "PessoaPapel" pp
WHERE pp."papel" = 'cliente';

-- 2d. Migrar email principal como PessoaContato
INSERT INTO "PessoaContato" ("id", "pessoaId", "tipo", "valor", "principal", "createdAt")
SELECT
    gen_random_uuid(),
    "id",
    'email',
    "email",
    true,
    "createdAt"
FROM "Cliente"
WHERE "email" IS NOT NULL AND trim("email") != '';

-- 2e. Migrar telefone como PessoaContato
INSERT INTO "PessoaContato" ("id", "pessoaId", "tipo", "valor", "principal", "createdAt")
SELECT
    gen_random_uuid(),
    "id",
    'telefone',
    "telefone",
    true,
    "createdAt"
FROM "Cliente"
WHERE "telefone" IS NOT NULL AND trim("telefone") != '';

-- 2f. Migrar celular como PessoaContato (apenas se diferente do telefone)
INSERT INTO "PessoaContato" ("id", "pessoaId", "tipo", "valor", "whatsapp", "createdAt")
SELECT
    gen_random_uuid(),
    "id",
    'telefone',
    "celular",
    false,
    "createdAt"
FROM "Cliente"
WHERE "celular" IS NOT NULL
  AND trim("celular") != ''
  AND ("telefone" IS NULL OR "celular" != "telefone");

-- 2g. Migrar endereço principal como PessoaEndereco
INSERT INTO "PessoaEndereco" ("id", "pessoaId", "tipo", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "codigoIbge", "createdAt")
SELECT
    gen_random_uuid(),
    "id",
    'principal',
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "codigoIbge",
    "createdAt"
FROM "Cliente"
WHERE "cep" IS NOT NULL OR "logradouro" IS NOT NULL;

-- ─── 3. Remover tabela antiga ─────────────────────────────────────────────────

-- DropForeignKey
ALTER TABLE "Cliente" DROP CONSTRAINT "Cliente_companyId_fkey";

-- DropTable
DROP TABLE "Cliente";
