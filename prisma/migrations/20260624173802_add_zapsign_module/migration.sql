-- CreateTable
CREATE TABLE "ConfiguracaoZapsign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoZapsign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZapsignDocumento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tokenZapsign" TEXT NOT NULL,
    "nomeDocumento" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "signatarioNome" TEXT,
    "signatarioEmail" TEXT,
    "linkAssinatura" TEXT,
    "assinadoEm" TIMESTAMP(3),
    "recusadoEm" TIMESTAMP(3),
    "motivoRecusa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZapsignDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoZapsign_companyId_key" ON "ConfiguracaoZapsign"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ZapsignDocumento_tokenZapsign_key" ON "ZapsignDocumento"("tokenZapsign");

-- AddForeignKey
ALTER TABLE "ConfiguracaoZapsign" ADD CONSTRAINT "ConfiguracaoZapsign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZapsignDocumento" ADD CONSTRAINT "ZapsignDocumento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
