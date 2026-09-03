-- Cadastro mestre de endereços WMS (A-RC-CH-20-2-05), isolado por empresa.
CREATE TABLE "EnderecoWms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "local" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "rua" TEXT NOT NULL,
    "andar" TEXT NOT NULL,
    "posicao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnderecoWms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnderecoWms_companyId_codigo_key" ON "EnderecoWms"("companyId", "codigo");

CREATE INDEX "EnderecoWms_companyId_local_area_tipo_idx" ON "EnderecoWms"("companyId", "local", "area", "tipo");

ALTER TABLE "EnderecoWms" ADD CONSTRAINT "EnderecoWms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
