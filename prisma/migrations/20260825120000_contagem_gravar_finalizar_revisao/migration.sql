-- AlterTable
ALTER TABLE "ContagemEntrada" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ContagemEntradaRevisao" (
    "id" TEXT NOT NULL,
    "contagemEntradaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "observacao" TEXT,
    "itensJson" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContagemEntradaRevisao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContagemEntradaRevisao_contagemEntradaId_criadoEm_idx" ON "ContagemEntradaRevisao"("contagemEntradaId", "criadoEm");

-- CreateIndex
CREATE INDEX "ContagemEntradaRevisao_usuarioId_idx" ON "ContagemEntradaRevisao"("usuarioId");

-- AddForeignKey
ALTER TABLE "ContagemEntradaRevisao" ADD CONSTRAINT "ContagemEntradaRevisao_contagemEntradaId_fkey" FOREIGN KEY ("contagemEntradaId") REFERENCES "ContagemEntrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContagemEntradaRevisao" ADD CONSTRAINT "ContagemEntradaRevisao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
