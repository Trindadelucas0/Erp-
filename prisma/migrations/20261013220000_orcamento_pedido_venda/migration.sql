UPDATE "Orcamento"
SET
  "status" = 'em_aberto',
  "condicaoPagamento" = CASE
    WHEN "condicaoPagamento" IN ('a_vista', '30_dias', '60_dias') THEN "condicaoPagamento"
    ELSE 'a_vista'
  END;

ALTER TABLE "Orcamento" ALTER COLUMN "status" SET DEFAULT 'em_aberto';

ALTER TABLE "OrcamentoItem"
  ADD COLUMN "produtoId" TEXT,
  ADD COLUMN "marca" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "valorSt" DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE TABLE "PedidoVenda" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "orcamentoId" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "clienteCodigo" TEXT NOT NULL DEFAULT '',
  "clienteNome" TEXT NOT NULL,
  "condicaoPagamento" TEXT NOT NULL DEFAULT '',
  "descontoTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valorFrete" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "outrasDespesas" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalSt" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PedidoVenda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PedidoVendaItem" (
  "id" TEXT NOT NULL,
  "pedidoVendaId" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "produtoId" TEXT,
  "codigo" TEXT NOT NULL DEFAULT '',
  "descricao" TEXT NOT NULL,
  "marca" TEXT NOT NULL DEFAULT '',
  "quantidade" DECIMAL(15,4) NOT NULL,
  "unidade" TEXT NOT NULL DEFAULT 'UN',
  "precoUnitario" DECIMAL(15,4) NOT NULL,
  "percentualDesconto" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "valorSt" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(15,2) NOT NULL,
  CONSTRAINT "PedidoVendaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrcamentoAnexo" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "orcamentoId" TEXT NOT NULL,
  "nomeArquivo" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "caminhoArquivo" TEXT NOT NULL,
  "tamanhoBytes" INTEGER NOT NULL,
  "usuarioId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrcamentoAnexo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrcamentoHistorico" (
  "id" TEXT NOT NULL,
  "orcamentoId" TEXT NOT NULL,
  "usuarioId" TEXT,
  "acao" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "dadosJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrcamentoHistorico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PedidoVenda_orcamentoId_key" ON "PedidoVenda"("orcamentoId");
CREATE UNIQUE INDEX "PedidoVenda_companyId_numero_key" ON "PedidoVenda"("companyId", "numero");
CREATE INDEX "PedidoVenda_companyId_createdAt_idx" ON "PedidoVenda"("companyId", "createdAt");
CREATE INDEX "PedidoVendaItem_pedidoVendaId_idx" ON "PedidoVendaItem"("pedidoVendaId");
CREATE INDEX "PedidoVendaItem_produtoId_idx" ON "PedidoVendaItem"("produtoId");
CREATE INDEX "OrcamentoItem_produtoId_idx" ON "OrcamentoItem"("produtoId");
CREATE INDEX "OrcamentoAnexo_companyId_idx" ON "OrcamentoAnexo"("companyId");
CREATE INDEX "OrcamentoAnexo_orcamentoId_idx" ON "OrcamentoAnexo"("orcamentoId");
CREATE INDEX "OrcamentoHistorico_orcamentoId_createdAt_idx" ON "OrcamentoHistorico"("orcamentoId", "createdAt");

ALTER TABLE "OrcamentoItem"
  ADD CONSTRAINT "OrcamentoItem_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PedidoVenda"
  ADD CONSTRAINT "PedidoVenda_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PedidoVenda"
  ADD CONSTRAINT "PedidoVenda_orcamentoId_fkey"
  FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PedidoVendaItem"
  ADD CONSTRAINT "PedidoVendaItem_pedidoVendaId_fkey"
  FOREIGN KEY ("pedidoVendaId") REFERENCES "PedidoVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PedidoVendaItem"
  ADD CONSTRAINT "PedidoVendaItem_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrcamentoAnexo"
  ADD CONSTRAINT "OrcamentoAnexo_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrcamentoAnexo"
  ADD CONSTRAINT "OrcamentoAnexo_orcamentoId_fkey"
  FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrcamentoAnexo"
  ADD CONSTRAINT "OrcamentoAnexo_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrcamentoHistorico"
  ADD CONSTRAINT "OrcamentoHistorico_orcamentoId_fkey"
  FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrcamentoHistorico"
  ADD CONSTRAINT "OrcamentoHistorico_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
