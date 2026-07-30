-- Stub financeiro frete: N duplicatas/parcelas (JSON)
ALTER TABLE "DespesaEntradaDocumento" ADD COLUMN IF NOT EXISTS "parcelas" JSONB;
