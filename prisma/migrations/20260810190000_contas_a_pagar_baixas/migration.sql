-- Baixas de Contas a Pagar (Fase B)

CREATE TABLE "ContaPagarBaixa" (
    "id" TEXT NOT NULL,
    "contaPagarParcelaId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pagoEm" TIMESTAMP(3) NOT NULL,
    "valorPrincipal" DECIMAL(18,2) NOT NULL,
    "valorJuros" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorMulta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorDesconto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "usuarioId" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaPagarBaixa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContaPagarBaixa_contaPagarParcelaId_idx" ON "ContaPagarBaixa"("contaPagarParcelaId");
CREATE INDEX "ContaPagarBaixa_companyId_pagoEm_idx" ON "ContaPagarBaixa"("companyId", "pagoEm");

ALTER TABLE "ContaPagarBaixa" ADD CONSTRAINT "ContaPagarBaixa_contaPagarParcelaId_fkey" FOREIGN KEY ("contaPagarParcelaId") REFERENCES "ContaPagarParcela"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaPagarBaixa" ADD CONSTRAINT "ContaPagarBaixa_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContaPagarBaixa" ADD CONSTRAINT "ContaPagarBaixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
