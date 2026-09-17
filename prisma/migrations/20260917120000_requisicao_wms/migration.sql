-- CreateTable
CREATE TABLE "RequisicaoWms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipoOperacao" TEXT NOT NULL,
    "prioridade" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "origemEnderecoId" TEXT,
    "destinoEnderecoId" TEXT,
    "produtoId" TEXT,
    "quantidade" DECIMAL(18,4),
    "responsavelId" TEXT,
    "observacao" TEXT,
    "iniciadoEm" TIMESTAMP(3),
    "pausadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequisicaoWms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisicaoWmsEvento" (
    "id" TEXT NOT NULL,
    "requisicaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "deStatus" TEXT,
    "paraStatus" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisicaoWmsEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequisicaoWms_companyId_numero_key" ON "RequisicaoWms"("companyId", "numero");

-- CreateIndex
CREATE INDEX "RequisicaoWms_companyId_status_idx" ON "RequisicaoWms"("companyId", "status");

-- CreateIndex
CREATE INDEX "RequisicaoWms_companyId_responsavelId_status_idx" ON "RequisicaoWms"("companyId", "responsavelId", "status");

-- CreateIndex
CREATE INDEX "RequisicaoWms_companyId_prioridade_createdAt_idx" ON "RequisicaoWms"("companyId", "prioridade", "createdAt");

-- CreateIndex
CREATE INDEX "RequisicaoWmsEvento_requisicaoId_createdAt_idx" ON "RequisicaoWmsEvento"("requisicaoId", "createdAt");

-- AddForeignKey
ALTER TABLE "RequisicaoWms" ADD CONSTRAINT "RequisicaoWms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoWms" ADD CONSTRAINT "RequisicaoWms_origemEnderecoId_fkey" FOREIGN KEY ("origemEnderecoId") REFERENCES "EnderecoWms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoWms" ADD CONSTRAINT "RequisicaoWms_destinoEnderecoId_fkey" FOREIGN KEY ("destinoEnderecoId") REFERENCES "EnderecoWms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoWms" ADD CONSTRAINT "RequisicaoWms_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoWms" ADD CONSTRAINT "RequisicaoWms_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoWmsEvento" ADD CONSTRAINT "RequisicaoWmsEvento_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES "RequisicaoWms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoWmsEvento" ADD CONSTRAINT "RequisicaoWmsEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
