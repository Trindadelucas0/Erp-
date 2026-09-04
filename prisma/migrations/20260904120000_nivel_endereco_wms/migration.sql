-- Catálogo da estrutura do depósito (área, tipo, rua, andar), isolado por empresa.
CREATE TABLE "NivelEnderecoWms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NivelEnderecoWms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NivelEnderecoWms_companyId_nivel_codigo_key" ON "NivelEnderecoWms"("companyId", "nivel", "codigo");

CREATE INDEX "NivelEnderecoWms_companyId_nivel_ativo_idx" ON "NivelEnderecoWms"("companyId", "nivel", "ativo");

ALTER TABLE "NivelEnderecoWms" ADD CONSTRAINT "NivelEnderecoWms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Áreas padrão (RC / EX / CQ) em cada empresa já existente.
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "ativo", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'area', v.codigo, v.nome, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (
    VALUES
        ('RC', 'Recebimento'),
        ('EX', 'Expedição'),
        ('CQ', 'Controle de Qualidade')
) AS v(codigo, nome);

-- Tipos padrão (PP / CX / CH / BC) em cada empresa já existente.
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "ativo", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'tipo', v.codigo, v.nome, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (
    VALUES
        ('PP', 'Porta-Pallet'),
        ('CX', 'Caixa'),
        ('CH', 'Chão'),
        ('BC', 'Bancada')
) AS v(codigo, nome);

-- Ruas já usadas em endereços (para não quebrar edição).
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "ativo", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."companyId", 'rua', e.rua, e.rua, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "companyId", rua FROM "EnderecoWms") e
ON CONFLICT ("companyId", "nivel", "codigo") DO NOTHING;

-- Andares já usados em endereços (para não quebrar edição).
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "ativo", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."companyId", 'andar', e.andar, e.andar, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "companyId", andar FROM "EnderecoWms") e
ON CONFLICT ("companyId", "nivel", "codigo") DO NOTHING;
