-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "chaveDedupe" TEXT,
    "payloadJson" JSONB,
    "resultadoJson" JSONB,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "mensagem" TEXT,
    "logResumo" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "maxTentativas" INTEGER NOT NULL DEFAULT 1,
    "recuperacoes" INTEGER NOT NULL DEFAULT 0,
    "agendadoPara" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedPor" TEXT,
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_agendadoPara_idx" ON "Job"("status", "agendadoPara");

-- CreateIndex
CREATE INDEX "Job_companyId_tipo_status_idx" ON "Job"("companyId", "tipo", "status");

-- CreateIndex
CREATE INDEX "Job_companyId_createdAt_idx" ON "Job"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
