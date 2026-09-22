-- CreateTable
CREATE TABLE "Adquirente" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adquirente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartaoPagamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "adquirenteId" TEXT NOT NULL,
    "bandeira" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nomeExibicao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "permitirParcelamento" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartaoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartaoPagamentoTaxa" (
    "id" TEXT NOT NULL,
    "cartaoPagamentoId" TEXT NOT NULL,
    "numeroParcelas" INTEGER NOT NULL,
    "taxaPercentual" DECIMAL(7,4) NOT NULL,
    "prazoDias" INTEGER NOT NULL DEFAULT 30,
    "valorFixo" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CartaoPagamentoTaxa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Adquirente_companyId_ativo_idx" ON "Adquirente"("companyId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Adquirente_companyId_nome_key" ON "Adquirente"("companyId", "nome");

-- CreateIndex
CREATE INDEX "CartaoPagamento_companyId_ativo_idx" ON "CartaoPagamento"("companyId", "ativo");

-- CreateIndex
CREATE INDEX "CartaoPagamento_adquirenteId_idx" ON "CartaoPagamento"("adquirenteId");

-- CreateIndex
CREATE UNIQUE INDEX "CartaoPagamento_companyId_adquirenteId_bandeira_tipo_key" ON "CartaoPagamento"("companyId", "adquirenteId", "bandeira", "tipo");

-- CreateIndex
CREATE INDEX "CartaoPagamentoTaxa_cartaoPagamentoId_idx" ON "CartaoPagamentoTaxa"("cartaoPagamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "CartaoPagamentoTaxa_cartaoPagamentoId_numeroParcelas_key" ON "CartaoPagamentoTaxa"("cartaoPagamentoId", "numeroParcelas");

-- AddForeignKey
ALTER TABLE "Adquirente" ADD CONSTRAINT "Adquirente_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartaoPagamento" ADD CONSTRAINT "CartaoPagamento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartaoPagamento" ADD CONSTRAINT "CartaoPagamento_adquirenteId_fkey" FOREIGN KEY ("adquirenteId") REFERENCES "Adquirente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartaoPagamentoTaxa" ADD CONSTRAINT "CartaoPagamentoTaxa_cartaoPagamentoId_fkey" FOREIGN KEY ("cartaoPagamentoId") REFERENCES "CartaoPagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
