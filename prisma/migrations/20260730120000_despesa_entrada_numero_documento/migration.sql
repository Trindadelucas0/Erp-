-- Stub financeiro frete (prévia contas a pagar): número do documento
ALTER TABLE "DespesaEntradaDocumento" ADD COLUMN IF NOT EXISTS "numeroDocumento" TEXT;
