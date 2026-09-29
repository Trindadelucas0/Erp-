-- CreateTable
CREATE TABLE "TipoVeiculo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pesoMaximoKg" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoVeiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TipoVeiculo_companyId_ativo_idx" ON "TipoVeiculo"("companyId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "TipoVeiculo_companyId_nome_key" ON "TipoVeiculo"("companyId", "nome");

-- AddForeignKey
ALTER TABLE "TipoVeiculo" ADD CONSTRAINT "TipoVeiculo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "DadosTransportadora" DROP COLUMN "tipoVeiculo",
ADD COLUMN "tipoVeiculoId" TEXT;

-- CreateIndex
CREATE INDEX "DadosTransportadora_tipoVeiculoId_idx" ON "DadosTransportadora"("tipoVeiculoId");

-- AddForeignKey
ALTER TABLE "DadosTransportadora" ADD CONSTRAINT "DadosTransportadora_tipoVeiculoId_fkey" FOREIGN KEY ("tipoVeiculoId") REFERENCES "TipoVeiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
