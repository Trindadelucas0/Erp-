-- Contas a Pagar (cadastro + visualização; baixas em fase futura)

CREATE TABLE "ContaPagarCodigoSeq" (
    "companyId" TEXT NOT NULL,
    "proximo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ContaPagarCodigoSeq_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE "ContaPagar" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tipoTributo" TEXT,
    "codigoReceita" TEXT,
    "numeroReferencia" TEXT,
    "pessoaId" TEXT,
    "planoFinanceiroId" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "nfeRecebidaId" TEXT,
    "despesaEntradaId" TEXT,
    "numeroDocumento" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "valorTotal" DECIMAL(18,2) NOT NULL,
    "valorDesconto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorJuros" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorMulta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorImpostoRetido" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaPagar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContaPagarParcela" (
    "id" TEXT NOT NULL,
    "contaPagarId" TEXT NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "numeroDocumento" TEXT,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "valorPago" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "pagoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaPagarParcela_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContaPagar_despesaEntradaId_key" ON "ContaPagar"("despesaEntradaId");
CREATE UNIQUE INDEX "ContaPagar_companyId_codigo_key" ON "ContaPagar"("companyId", "codigo");
CREATE INDEX "ContaPagar_companyId_status_idx" ON "ContaPagar"("companyId", "status");
CREATE INDEX "ContaPagar_companyId_tipo_idx" ON "ContaPagar"("companyId", "tipo");
CREATE INDEX "ContaPagar_pessoaId_idx" ON "ContaPagar"("pessoaId");
CREATE INDEX "ContaPagar_nfeRecebidaId_idx" ON "ContaPagar"("nfeRecebidaId");
CREATE INDEX "ContaPagar_planoFinanceiroId_idx" ON "ContaPagar"("planoFinanceiroId");

CREATE UNIQUE INDEX "ContaPagarParcela_contaPagarId_numeroParcela_key" ON "ContaPagarParcela"("contaPagarId", "numeroParcela");
CREATE INDEX "ContaPagarParcela_vencimento_idx" ON "ContaPagarParcela"("vencimento");
CREATE INDEX "ContaPagarParcela_status_idx" ON "ContaPagarParcela"("status");

ALTER TABLE "ContaPagarCodigoSeq" ADD CONSTRAINT "ContaPagarCodigoSeq_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_planoFinanceiroId_fkey" FOREIGN KEY ("planoFinanceiroId") REFERENCES "PlanoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_nfeRecebidaId_fkey" FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_despesaEntradaId_fkey" FOREIGN KEY ("despesaEntradaId") REFERENCES "DespesaEntradaDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContaPagarParcela" ADD CONSTRAINT "ContaPagarParcela_contaPagarId_fkey" FOREIGN KEY ("contaPagarId") REFERENCES "ContaPagar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
