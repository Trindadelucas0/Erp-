-- CreateTable
CREATE TABLE "ContaEmpresa" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "digitoAgencia" TEXT,
    "conta" TEXT,
    "digitoConta" TEXT,
    "limiteChequeEspecial" DECIMAL(18,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaEmpresa_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ContaPagarBaixa" ADD COLUMN "contaEmpresaId" TEXT;

-- AlterTable
ALTER TABLE "ContaReceberBaixa" ADD COLUMN "contaEmpresaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ContaEmpresa_companyId_nome_key" ON "ContaEmpresa"("companyId", "nome");

-- CreateIndex
CREATE INDEX "ContaEmpresa_companyId_ativo_idx" ON "ContaEmpresa"("companyId", "ativo");

-- CreateIndex
CREATE INDEX "ContaEmpresa_companyId_tipo_idx" ON "ContaEmpresa"("companyId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "ContaEmpresa_companyId_banco_agencia_conta_bancaria_key" ON "ContaEmpresa"("companyId", "banco", "agencia", "conta") WHERE "tipo" = 'bancaria';

-- CreateIndex
CREATE INDEX "ContaPagarBaixa_contaEmpresaId_idx" ON "ContaPagarBaixa"("contaEmpresaId");

-- CreateIndex
CREATE INDEX "ContaReceberBaixa_contaEmpresaId_idx" ON "ContaReceberBaixa"("contaEmpresaId");

-- AddForeignKey
ALTER TABLE "ContaEmpresa" ADD CONSTRAINT "ContaEmpresa_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagarBaixa" ADD CONSTRAINT "ContaPagarBaixa_contaEmpresaId_fkey" FOREIGN KEY ("contaEmpresaId") REFERENCES "ContaEmpresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceberBaixa" ADD CONSTRAINT "ContaReceberBaixa_contaEmpresaId_fkey" FOREIGN KEY ("contaEmpresaId") REFERENCES "ContaEmpresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
