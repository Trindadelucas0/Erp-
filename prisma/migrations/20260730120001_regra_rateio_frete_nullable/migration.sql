-- Regra de rateio do frete: deixa de ter default silencioso "valor".
-- Valores existentes permanecem; novos cadastros podem ficar NULL.
ALTER TABLE "DadosFornecedor" ALTER COLUMN "regraRateioFrete" DROP DEFAULT;
ALTER TABLE "DadosFornecedor" ALTER COLUMN "regraRateioFrete" DROP NOT NULL;
