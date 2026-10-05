-- CreateTable
CREATE TABLE "ConfiguracaoBoleto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "valorMinimo" DECIMAL(18,2),
    "valorMaximo" DECIMAL(18,2),
    "prazoMedioMaximoDias" INTEGER,
    "permitirParcelamento" BOOLEAN NOT NULL DEFAULT false,
    "quantidadeMaximaParcelas" INTEGER,
    "multaAtrasoPercentual" DECIMAL(9,4),
    "jurosAtrasoPercentualDia" DECIMAL(9,4),
    "permitirPagamentoAposVencimento" BOOLEAN NOT NULL DEFAULT false,
    "diasMaximosAposVencimento" INTEGER,
    "negativarAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "diasParaNegativar" INTEGER,
    "banco" TEXT,
    "ambiente" TEXT,
    "tipoIntegracao" TEXT DEFAULT 'api',
    "urlApi" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "certificadoNome" TEXT,
    "certificadoCaminho" TEXT,
    "certificadoMime" TEXT,
    "ultimoTesteEm" TIMESTAMP(3),
    "ultimoTesteSucesso" BOOLEAN,
    "ultimoTesteMensagem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoBoleto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoBoleto_companyId_key" ON "ConfiguracaoBoleto"("companyId");

-- AddForeignKey
ALTER TABLE "ConfiguracaoBoleto" ADD CONSTRAINT "ConfiguracaoBoleto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
