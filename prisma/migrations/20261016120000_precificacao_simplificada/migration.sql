ALTER TABLE "Produto" ADD COLUMN "precoAtacado" DECIMAL(15,4);
ALTER TABLE "NfeRecebidaItem" ADD COLUMN "precificacaoParametros" JSONB,
  ADD COLUMN "precificacaoRevisao" INTEGER NOT NULL DEFAULT 0;
