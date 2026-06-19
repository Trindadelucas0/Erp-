-- CreateTable
CREATE TABLE "DadosFornecedor" (
    "id" TEXT NOT NULL,
    "papelId" TEXT NOT NULL,
    "condicaoPagamento" TEXT,
    "prazoEntrega" INTEGER,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DadosFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DadosTransportadora" (
    "id" TEXT NOT NULL,
    "papelId" TEXT NOT NULL,
    "antt" TEXT,
    "tipoVeiculo" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DadosTransportadora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DadosFornecedor_papelId_key" ON "DadosFornecedor"("papelId");

-- CreateIndex
CREATE UNIQUE INDEX "DadosTransportadora_papelId_key" ON "DadosTransportadora"("papelId");

-- AddForeignKey
ALTER TABLE "DadosFornecedor" ADD CONSTRAINT "DadosFornecedor_papelId_fkey" FOREIGN KEY ("papelId") REFERENCES "PessoaPapel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadosTransportadora" ADD CONSTRAINT "DadosTransportadora_papelId_fkey" FOREIGN KEY ("papelId") REFERENCES "PessoaPapel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
