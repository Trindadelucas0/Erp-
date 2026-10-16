ALTER TABLE "Orcamento"
  ADD COLUMN "parametroBoletoId" TEXT,
  ADD COLUMN "prazosBoleto" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "parcelasCredito" INTEGER;

ALTER TABLE "PedidoVenda"
  ADD COLUMN "parametroBoletoId" TEXT,
  ADD COLUMN "parametroBoletoNome" TEXT,
  ADD COLUMN "prazosBoleto" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "parcelasCredito" INTEGER,
  ADD COLUMN "parcelasPagamento" JSONB;
