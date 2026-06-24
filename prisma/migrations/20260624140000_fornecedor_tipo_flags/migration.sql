-- AlterTable DadosFornecedor: substituir tipoOperacao por flags booleanas
ALTER TABLE "DadosFornecedor" ADD COLUMN "tipoRevenda"           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DadosFornecedor" ADD COLUMN "tipoConsumo"           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DadosFornecedor" ADD COLUMN "tipoPrestadorServico"  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DadosFornecedor" ADD COLUMN "permitirVinculoManual" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DadosFornecedor" ADD COLUMN "exigirItensEntrada"    BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrar valores existentes
UPDATE "DadosFornecedor" SET "tipoRevenda"          = TRUE WHERE "tipoOperacao" = 'revenda';
UPDATE "DadosFornecedor" SET "tipoConsumo"          = TRUE WHERE "tipoOperacao" = 'consumo';
UPDATE "DadosFornecedor" SET "tipoPrestadorServico" = TRUE WHERE "tipoOperacao" = 'prestador_servico';

-- Remover coluna antiga
ALTER TABLE "DadosFornecedor" DROP COLUMN "tipoOperacao";
