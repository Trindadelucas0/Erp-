-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "validade" DATE,
    "status" TEXT NOT NULL DEFAULT 'em_elaboracao',
    "vendedorId" TEXT NOT NULL DEFAULT '',
    "clienteCodigo" TEXT NOT NULL DEFAULT '',
    "clienteNome" TEXT NOT NULL DEFAULT '',
    "cnpj" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "contato" TEXT NOT NULL DEFAULT '',
    "condicaoPagamento" TEXT NOT NULL DEFAULT '',
    "prazoEntrega" TEXT NOT NULL DEFAULT '',
    "frete" TEXT NOT NULL DEFAULT '',
    "mensagem" TEXT NOT NULL DEFAULT '',
    "descontoTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valorFrete" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "outrasDespesas" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "converterEmPedido" BOOLEAN NOT NULL DEFAULT false,
    "cep" TEXT NOT NULL DEFAULT '',
    "logradouro" TEXT NOT NULL DEFAULT '',
    "numeroEndereco" TEXT NOT NULL DEFAULT '',
    "bairro" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "uf" TEXT NOT NULL DEFAULT '',
    "complementares" TEXT NOT NULL DEFAULT '',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrcamentoItem" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "codigo" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "ncm" TEXT NOT NULL DEFAULT '',
    "quantidade" DECIMAL(15,4) NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    "precoUnitario" DECIMAL(15,4) NOT NULL,
    "percentualDesconto" DECIMAL(15,4) NOT NULL DEFAULT 0,

    CONSTRAINT "OrcamentoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Orcamento_companyId_updatedAt_idx" ON "Orcamento"("companyId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_companyId_numero_key" ON "Orcamento"("companyId", "numero");

-- CreateIndex
CREATE INDEX "OrcamentoItem_orcamentoId_idx" ON "OrcamentoItem"("orcamentoId");

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrcamentoItem" ADD CONSTRAINT "OrcamentoItem_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
