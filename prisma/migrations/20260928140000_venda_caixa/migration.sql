-- CreateTable
CREATE TABLE "VendaCaixa" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paga',
    "pagaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendaCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendaCaixaItem" (
    "id" TEXT NOT NULL,
    "vendaCaixaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "VendaCaixaItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RequisicaoWms" ADD COLUMN "vendaCaixaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VendaCaixa_companyId_numero_key" ON "VendaCaixa"("companyId", "numero");

-- CreateIndex
CREATE INDEX "VendaCaixa_companyId_pagaEm_idx" ON "VendaCaixa"("companyId", "pagaEm");

-- CreateIndex
CREATE INDEX "VendaCaixaItem_vendaCaixaId_idx" ON "VendaCaixaItem"("vendaCaixaId");

-- CreateIndex
CREATE INDEX "VendaCaixaItem_produtoId_idx" ON "VendaCaixaItem"("produtoId");

-- CreateIndex
CREATE INDEX "RequisicaoWms_companyId_vendaCaixaId_idx" ON "RequisicaoWms"("companyId", "vendaCaixaId");

-- AddForeignKey
ALTER TABLE "VendaCaixa" ADD CONSTRAINT "VendaCaixa_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaCaixaItem" ADD CONSTRAINT "VendaCaixaItem_vendaCaixaId_fkey" FOREIGN KEY ("vendaCaixaId") REFERENCES "VendaCaixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaCaixaItem" ADD CONSTRAINT "VendaCaixaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoWms" ADD CONSTRAINT "RequisicaoWms_vendaCaixaId_fkey" FOREIGN KEY ("vendaCaixaId") REFERENCES "VendaCaixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
