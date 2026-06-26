-- CreateTable: GrupoEconomico
CREATE TABLE "GrupoEconomico" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupoEconomico_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FornecedorParPlanoCfopPadrao
CREATE TABLE "FornecedorParPlanoCfopPadrao" (
    "id" TEXT NOT NULL,
    "dadosFornecedorId" TEXT NOT NULL,
    "planoFinanceiroId" TEXT NOT NULL,
    "cfopId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FornecedorParPlanoCfopPadrao_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add grupoEconomicoId to DadosFornecedor
ALTER TABLE "DadosFornecedor" ADD COLUMN "grupoEconomicoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GrupoEconomico_companyId_nome_key" ON "GrupoEconomico"("companyId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "FornecedorParPlanoCfopPadrao_dadosFornecedorId_planoFinanceiroId_cfopId_key" ON "FornecedorParPlanoCfopPadrao"("dadosFornecedorId", "planoFinanceiroId", "cfopId");

-- AddForeignKey
ALTER TABLE "GrupoEconomico" ADD CONSTRAINT "GrupoEconomico_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FornecedorParPlanoCfopPadrao" ADD CONSTRAINT "FornecedorParPlanoCfopPadrao_dadosFornecedorId_fkey" FOREIGN KEY ("dadosFornecedorId") REFERENCES "DadosFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FornecedorParPlanoCfopPadrao" ADD CONSTRAINT "FornecedorParPlanoCfopPadrao_planoFinanceiroId_fkey" FOREIGN KEY ("planoFinanceiroId") REFERENCES "PlanoFinanceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FornecedorParPlanoCfopPadrao" ADD CONSTRAINT "FornecedorParPlanoCfopPadrao_cfopId_fkey" FOREIGN KEY ("cfopId") REFERENCES "Cfop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadosFornecedor" ADD CONSTRAINT "DadosFornecedor_grupoEconomicoId_fkey" FOREIGN KEY ("grupoEconomicoId") REFERENCES "GrupoEconomico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
