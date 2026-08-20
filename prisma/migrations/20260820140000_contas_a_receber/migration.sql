-- Contas a Receber (cadastro manual, baixas, anexos)

CREATE TABLE "ContaReceberCodigoSeq" (
    "companyId" TEXT NOT NULL,
    "proximo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ContaReceberCodigoSeq_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE "ContaReceber" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pessoaId" TEXT,
    "planoFinanceiroId" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "numeroDocumento" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "valorTotal" DECIMAL(18,2) NOT NULL,
    "valorDesconto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorJuros" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorMulta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorComissao" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaReceber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContaReceberParcela" (
    "id" TEXT NOT NULL,
    "contaReceberId" TEXT NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "numeroDocumento" TEXT,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "valorPago" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "pagoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaReceberParcela_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContaReceberBaixa" (
    "id" TEXT NOT NULL,
    "contaReceberParcelaId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pagoEm" TIMESTAMP(3) NOT NULL,
    "valorPrincipal" DECIMAL(18,2) NOT NULL,
    "valorJuros" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorMulta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorDesconto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "usuarioId" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaReceberBaixa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContaReceberAnexo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contaReceberId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaReceberAnexo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContaReceber_companyId_codigo_key" ON "ContaReceber"("companyId", "codigo");
CREATE INDEX "ContaReceber_companyId_status_idx" ON "ContaReceber"("companyId", "status");
CREATE INDEX "ContaReceber_companyId_tipo_idx" ON "ContaReceber"("companyId", "tipo");
CREATE INDEX "ContaReceber_pessoaId_idx" ON "ContaReceber"("pessoaId");
CREATE INDEX "ContaReceber_planoFinanceiroId_idx" ON "ContaReceber"("planoFinanceiroId");

CREATE UNIQUE INDEX "ContaReceberParcela_contaReceberId_numeroParcela_key" ON "ContaReceberParcela"("contaReceberId", "numeroParcela");
CREATE INDEX "ContaReceberParcela_vencimento_idx" ON "ContaReceberParcela"("vencimento");
CREATE INDEX "ContaReceberParcela_status_idx" ON "ContaReceberParcela"("status");

CREATE INDEX "ContaReceberBaixa_contaReceberParcelaId_idx" ON "ContaReceberBaixa"("contaReceberParcelaId");
CREATE INDEX "ContaReceberBaixa_companyId_pagoEm_idx" ON "ContaReceberBaixa"("companyId", "pagoEm");

CREATE INDEX "ContaReceberAnexo_contaReceberId_idx" ON "ContaReceberAnexo"("contaReceberId");
CREATE INDEX "ContaReceberAnexo_companyId_idx" ON "ContaReceberAnexo"("companyId");

ALTER TABLE "ContaReceberCodigoSeq" ADD CONSTRAINT "ContaReceberCodigoSeq_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_planoFinanceiroId_fkey" FOREIGN KEY ("planoFinanceiroId") REFERENCES "PlanoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContaReceberParcela" ADD CONSTRAINT "ContaReceberParcela_contaReceberId_fkey" FOREIGN KEY ("contaReceberId") REFERENCES "ContaReceber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContaReceberBaixa" ADD CONSTRAINT "ContaReceberBaixa_contaReceberParcelaId_fkey" FOREIGN KEY ("contaReceberParcelaId") REFERENCES "ContaReceberParcela"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaReceberBaixa" ADD CONSTRAINT "ContaReceberBaixa_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaReceberBaixa" ADD CONSTRAINT "ContaReceberBaixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContaReceberAnexo" ADD CONSTRAINT "ContaReceberAnexo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaReceberAnexo" ADD CONSTRAINT "ContaReceberAnexo_contaReceberId_fkey" FOREIGN KEY ("contaReceberId") REFERENCES "ContaReceber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaReceberAnexo" ADD CONSTRAINT "ContaReceberAnexo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
