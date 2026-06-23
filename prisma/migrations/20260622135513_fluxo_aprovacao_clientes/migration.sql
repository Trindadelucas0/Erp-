-- AlterTable
ALTER TABLE "DadosCliente" ADD COLUMN     "aprovadoEm" TIMESTAMP(3),
ADD COLUMN     "aprovadoPorId" TEXT,
ADD COLUMN     "condicaoPagamento" TEXT,
ADD COLUMN     "limiteCredito" DECIMAL(15,2),
ADD COLUMN     "motivoReprovacao" TEXT,
ADD COLUMN     "tipoCliente" TEXT;

-- AlterTable
ALTER TABLE "DadosFornecedor" ADD COLUMN     "aceitaNFe55" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "DadosTransportadora" ADD COLUMN     "aceitaNFe55" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ClienteAssinatura" (
    "id" TEXT NOT NULL,
    "dadosClienteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "destinatario" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "visualizadoEm" TIMESTAMP(3),
    "assinadoEm" TIMESTAMP(3),
    "nomeAssinante" TEXT,
    "ipAssinante" TEXT,
    "expiraEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClienteAssinatura_token_key" ON "ClienteAssinatura"("token");

-- AddForeignKey
ALTER TABLE "ClienteAssinatura" ADD CONSTRAINT "ClienteAssinatura_dadosClienteId_fkey" FOREIGN KEY ("dadosClienteId") REFERENCES "DadosCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
