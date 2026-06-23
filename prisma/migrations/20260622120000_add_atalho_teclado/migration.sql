-- CreateTable
CREATE TABLE "AtalhoTeclado" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "tecla" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtalhoTeclado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtalhoTeclado_acao_key" ON "AtalhoTeclado"("acao");
