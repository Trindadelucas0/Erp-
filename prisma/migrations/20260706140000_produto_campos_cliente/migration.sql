-- Campos do cadastro de produto conforme documento do cliente
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "tipoEntrega" TEXT;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "diasParaEntrega" INTEGER;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "dataValidadePreco" TIMESTAMP(3);
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "agruparSimilaresRuptura" BOOLEAN NOT NULL DEFAULT false;
