-- CreateTable
CREATE TABLE "ConfiguracaoFocusNfe" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "homologacao" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaVersaoNfeRecebida" INTEGER NOT NULL DEFAULT 0,
    "regrasFiscaisJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoFocusNfe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusNfeJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "mensagem" TEXT,
    "logResumo" TEXT,
    "payloadJson" JSONB,
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusNfeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NfeRecebida" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chaveNfe" TEXT NOT NULL,
    "nomeEmitente" TEXT,
    "documentoEmitente" TEXT,
    "cnpjDestinatario" TEXT,
    "valorTotal" DECIMAL(18,2),
    "dataEmissao" TIMESTAMP(3),
    "situacao" TEXT,
    "manifestacaoDestinatario" TEXT,
    "nfeCompleta" BOOLEAN NOT NULL DEFAULT false,
    "tipoNfe" TEXT,
    "versaoFocus" INTEGER NOT NULL DEFAULT 0,
    "statusEntrada" TEXT NOT NULL DEFAULT 'pendente',
    "origem" TEXT NOT NULL DEFAULT 'focus',
    "origemLancamento" TEXT,
    "xmlConteudo" TEXT,
    "observacaoContato" TEXT,
    "criticasLiberadas" BOOLEAN NOT NULL DEFAULT false,
    "pedidoCompraId" TEXT,
    "etapaAtual" TEXT NOT NULL DEFAULT 'cadastro',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfeRecebida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoFocusNfe_companyId_key" ON "ConfiguracaoFocusNfe"("companyId");

-- CreateIndex
CREATE INDEX "FocusNfeJob_companyId_status_idx" ON "FocusNfeJob"("companyId", "status");

-- CreateIndex
CREATE INDEX "FocusNfeJob_companyId_createdAt_idx" ON "FocusNfeJob"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NfeRecebida_companyId_chaveNfe_key" ON "NfeRecebida"("companyId", "chaveNfe");

-- CreateIndex
CREATE INDEX "NfeRecebida_companyId_statusEntrada_idx" ON "NfeRecebida"("companyId", "statusEntrada");

-- CreateIndex
CREATE INDEX "NfeRecebida_companyId_versaoFocus_idx" ON "NfeRecebida"("companyId", "versaoFocus");

-- AddForeignKey
ALTER TABLE "ConfiguracaoFocusNfe" ADD CONSTRAINT "ConfiguracaoFocusNfe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusNfeJob" ADD CONSTRAINT "FocusNfeJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfeRecebida" ADD CONSTRAINT "NfeRecebida_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
