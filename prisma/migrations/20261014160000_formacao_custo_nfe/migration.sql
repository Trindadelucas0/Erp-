ALTER TABLE "RegraFiscal" ADD COLUMN "baseIcms" TEXT NOT NULL DEFAULT 'bruto', ADD COLUMN "operacoes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "NfeRecebidaItem" ADD COLUMN "dadosCustoXml" JSONB, ADD COLUMN "previaCustoXml" JSONB;
CREATE TABLE "CustoEntradaAjuste" (
  "id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nfeRecebidaId" TEXT NOT NULL UNIQUE REFERENCES "NfeRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "dados" JSONB NOT NULL, "revisao" INTEGER NOT NULL DEFAULT 1, "usuarioId" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CustoEntradaAjuste_companyId_idx" ON "CustoEntradaAjuste"("companyId");
CREATE TABLE "CustoEntradaMemoria" (
  "id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nfeRecebidaId" TEXT NOT NULL REFERENCES "NfeRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "itemId" TEXT NOT NULL, "nItem" INTEGER NOT NULL, "revisao" TEXT NOT NULL, "xmlHash" TEXT NOT NULL,
  "versaoCalculo" INTEGER NOT NULL DEFAULT 1, "dados" JSONB NOT NULL, "usuarioId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CustoEntradaMemoria_companyId_nfeRecebidaId_nItem_revisao_key" ON "CustoEntradaMemoria"("companyId", "nfeRecebidaId", "nItem", "revisao");
CREATE INDEX "CustoEntradaMemoria_companyId_nfeRecebidaId_createdAt_idx" ON "CustoEntradaMemoria"("companyId", "nfeRecebidaId", "createdAt");
