CREATE TABLE "ExtratoBancario" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contaEmpresaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtratoBancario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtratoBancarioLinha" (
    "id" TEXT NOT NULL,
    "extratoId" TEXT NOT NULL,
    "contaEmpresaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "historico" TEXT NOT NULL,
    "documento" TEXT,
    "valor" DECIMAL(18,2) NOT NULL,
    "chaveUnica" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtratoBancarioLinha_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConciliacaoBancaria" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contaEmpresaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "usuarioId" TEXT NOT NULL,
    "concluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desfeitaEm" TIMESTAMP(3),
    CONSTRAINT "ConciliacaoBancaria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConciliacaoBancariaLinha" (
    "id" TEXT NOT NULL,
    "conciliacaoId" TEXT NOT NULL,
    "linhaId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ConciliacaoBancariaLinha_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConciliacaoBancariaBaixa" (
    "id" TEXT NOT NULL,
    "conciliacaoId" TEXT NOT NULL,
    "contaPagarBaixaId" TEXT,
    "contaReceberBaixaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ConciliacaoBancariaBaixa_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConciliacaoBancariaBaixa_origem_check"
      CHECK (("contaPagarBaixaId" IS NOT NULL) <> ("contaReceberBaixaId" IS NOT NULL))
);

CREATE TABLE "ConciliacaoBancariaEvento" (
    "id" TEXT NOT NULL,
    "conciliacaoId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "detalhe" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConciliacaoBancariaEvento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtratoBancarioLinha_contaEmpresaId_chaveUnica_key" ON "ExtratoBancarioLinha"("contaEmpresaId", "chaveUnica");
CREATE INDEX "ExtratoBancario_companyId_contaEmpresaId_createdAt_idx" ON "ExtratoBancario"("companyId", "contaEmpresaId", "createdAt");
CREATE INDEX "ExtratoBancarioLinha_data_idx" ON "ExtratoBancarioLinha"("data");
CREATE INDEX "ConciliacaoBancaria_companyId_contaEmpresaId_status_idx" ON "ConciliacaoBancaria"("companyId", "contaEmpresaId", "status");
CREATE INDEX "ConciliacaoBancariaLinha_linhaId_ativo_idx" ON "ConciliacaoBancariaLinha"("linhaId", "ativo");
CREATE INDEX "ConciliacaoBancariaLinha_conciliacaoId_idx" ON "ConciliacaoBancariaLinha"("conciliacaoId");
CREATE INDEX "ConciliacaoBancariaBaixa_contaPagarBaixaId_ativo_idx" ON "ConciliacaoBancariaBaixa"("contaPagarBaixaId", "ativo");
CREATE INDEX "ConciliacaoBancariaBaixa_contaReceberBaixaId_ativo_idx" ON "ConciliacaoBancariaBaixa"("contaReceberBaixaId", "ativo");
CREATE INDEX "ConciliacaoBancariaBaixa_conciliacaoId_idx" ON "ConciliacaoBancariaBaixa"("conciliacaoId");
CREATE INDEX "ConciliacaoBancariaEvento_conciliacaoId_criadoEm_idx" ON "ConciliacaoBancariaEvento"("conciliacaoId", "criadoEm");

CREATE UNIQUE INDEX "ConciliacaoBancariaLinha_linhaId_ativa_key"
  ON "ConciliacaoBancariaLinha"("linhaId") WHERE "ativo" = true;
CREATE UNIQUE INDEX "ConciliacaoBancariaBaixa_pagar_ativa_key"
  ON "ConciliacaoBancariaBaixa"("contaPagarBaixaId")
  WHERE "ativo" = true AND "contaPagarBaixaId" IS NOT NULL;
CREATE UNIQUE INDEX "ConciliacaoBancariaBaixa_receber_ativa_key"
  ON "ConciliacaoBancariaBaixa"("contaReceberBaixaId")
  WHERE "ativo" = true AND "contaReceberBaixaId" IS NOT NULL;

ALTER TABLE "ExtratoBancario" ADD CONSTRAINT "ExtratoBancario_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtratoBancario" ADD CONSTRAINT "ExtratoBancario_contaEmpresaId_fkey" FOREIGN KEY ("contaEmpresaId") REFERENCES "ContaEmpresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtratoBancario" ADD CONSTRAINT "ExtratoBancario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExtratoBancarioLinha" ADD CONSTRAINT "ExtratoBancarioLinha_extratoId_fkey" FOREIGN KEY ("extratoId") REFERENCES "ExtratoBancario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancaria" ADD CONSTRAINT "ConciliacaoBancaria_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancaria" ADD CONSTRAINT "ConciliacaoBancaria_contaEmpresaId_fkey" FOREIGN KEY ("contaEmpresaId") REFERENCES "ContaEmpresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancaria" ADD CONSTRAINT "ConciliacaoBancaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancariaLinha" ADD CONSTRAINT "ConciliacaoBancariaLinha_conciliacaoId_fkey" FOREIGN KEY ("conciliacaoId") REFERENCES "ConciliacaoBancaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancariaLinha" ADD CONSTRAINT "ConciliacaoBancariaLinha_linhaId_fkey" FOREIGN KEY ("linhaId") REFERENCES "ExtratoBancarioLinha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancariaBaixa" ADD CONSTRAINT "ConciliacaoBancariaBaixa_conciliacaoId_fkey" FOREIGN KEY ("conciliacaoId") REFERENCES "ConciliacaoBancaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancariaBaixa" ADD CONSTRAINT "ConciliacaoBancariaBaixa_contaPagarBaixaId_fkey" FOREIGN KEY ("contaPagarBaixaId") REFERENCES "ContaPagarBaixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancariaBaixa" ADD CONSTRAINT "ConciliacaoBancariaBaixa_contaReceberBaixaId_fkey" FOREIGN KEY ("contaReceberBaixaId") REFERENCES "ContaReceberBaixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancariaEvento" ADD CONSTRAINT "ConciliacaoBancariaEvento_conciliacaoId_fkey" FOREIGN KEY ("conciliacaoId") REFERENCES "ConciliacaoBancaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConciliacaoBancariaEvento" ADD CONSTRAINT "ConciliacaoBancariaEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
