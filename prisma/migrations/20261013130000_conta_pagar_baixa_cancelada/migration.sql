ALTER TABLE "ContaPagarBaixa"
ADD COLUMN "canceladaEm" TIMESTAMP(3),
ADD COLUMN "canceladaPorId" TEXT;

CREATE INDEX "ContaPagarBaixa_canceladaEm_idx"
ON "ContaPagarBaixa"("canceladaEm");

ALTER TABLE "ContaPagarBaixa"
ADD CONSTRAINT "ContaPagarBaixa_canceladaPorId_fkey"
FOREIGN KEY ("canceladaPorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
