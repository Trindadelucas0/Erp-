-- Contagem de entrada cega (sessão multi-NF)

CREATE TABLE "ContagemEntrada" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "usuarioId" TEXT,
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContagemEntrada_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContagemEntradaNota" (
    "id" TEXT NOT NULL,
    "contagemEntradaId" TEXT NOT NULL,
    "nfeRecebidaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContagemEntradaNota_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContagemEntradaItem" (
    "id" TEXT NOT NULL,
    "contagemEntradaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nomeExibicao" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "codigoOriginal" TEXT,
    "marca" TEXT,
    "unidade" TEXT,
    "qtdEmbalagemPadrao" DECIMAL(18,4),
    "qtdEsperada" DECIMAL(18,4) NOT NULL,
    "qtdContada" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "statusItem" TEXT NOT NULL DEFAULT 'pendente',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContagemEntradaItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContagemEntrada_companyId_status_idx" ON "ContagemEntrada"("companyId", "status");
CREATE INDEX "ContagemEntrada_companyId_createdAt_idx" ON "ContagemEntrada"("companyId", "createdAt");
CREATE INDEX "ContagemEntradaNota_nfeRecebidaId_idx" ON "ContagemEntradaNota"("nfeRecebidaId");
CREATE UNIQUE INDEX "ContagemEntradaNota_contagemEntradaId_nfeRecebidaId_key" ON "ContagemEntradaNota"("contagemEntradaId", "nfeRecebidaId");
CREATE INDEX "ContagemEntradaItem_contagemEntradaId_idx" ON "ContagemEntradaItem"("contagemEntradaId");
CREATE INDEX "ContagemEntradaItem_produtoId_idx" ON "ContagemEntradaItem"("produtoId");
CREATE UNIQUE INDEX "ContagemEntradaItem_contagemEntradaId_produtoId_key" ON "ContagemEntradaItem"("contagemEntradaId", "produtoId");

ALTER TABLE "ContagemEntrada" ADD CONSTRAINT "ContagemEntrada_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContagemEntrada" ADD CONSTRAINT "ContagemEntrada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContagemEntradaNota" ADD CONSTRAINT "ContagemEntradaNota_contagemEntradaId_fkey" FOREIGN KEY ("contagemEntradaId") REFERENCES "ContagemEntrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContagemEntradaNota" ADD CONSTRAINT "ContagemEntradaNota_nfeRecebidaId_fkey" FOREIGN KEY ("nfeRecebidaId") REFERENCES "NfeRecebida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContagemEntradaItem" ADD CONSTRAINT "ContagemEntradaItem_contagemEntradaId_fkey" FOREIGN KEY ("contagemEntradaId") REFERENCES "ContagemEntrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContagemEntradaItem" ADD CONSTRAINT "ContagemEntradaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
