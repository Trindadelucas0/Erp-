-- Hierarquia WMS: parentId, bloco, código LOCAL-ÁREA-RUA-BLOCO-ANDAR-AP.

ALTER TABLE "NivelEnderecoWms" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "NivelEnderecoWms" ADD COLUMN IF NOT EXISTS "sequencia" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NivelEnderecoWms" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ativo';

UPDATE "NivelEnderecoWms" SET "status" = CASE WHEN "ativo" THEN 'ativo' ELSE 'inativo' END;

-- Garante um local por empresa que tenha catálogo sem local.
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "ativo", "status", "sequencia", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."companyId", 'local', 'A', 'Prédio principal da fábrica', true, 'ativo', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "companyId" FROM "NivelEnderecoWms") c
WHERE NOT EXISTS (
  SELECT 1 FROM "NivelEnderecoWms" l
  WHERE l."companyId" = c."companyId" AND l."nivel" = 'local'
);

-- Áreas → primeiro local da empresa.
UPDATE "NivelEnderecoWms" a
SET "parentId" = (
  SELECT l."id" FROM "NivelEnderecoWms" l
  WHERE l."companyId" = a."companyId" AND l."nivel" = 'local'
  ORDER BY l."codigo" ASC
  LIMIT 1
)
WHERE a."nivel" = 'area' AND a."parentId" IS NULL;

-- Ruas → área pelo paiCodigo (legado) ou primeira área.
UPDATE "NivelEnderecoWms" r
SET "parentId" = COALESCE(
  (
    SELECT a."id" FROM "NivelEnderecoWms" a
    WHERE a."companyId" = r."companyId" AND a."nivel" = 'area' AND a."codigo" = r."paiCodigo"
    LIMIT 1
  ),
  (
    SELECT a."id" FROM "NivelEnderecoWms" a
    WHERE a."companyId" = r."companyId" AND a."nivel" = 'area'
    ORDER BY a."codigo" ASC
    LIMIT 1
  )
)
WHERE r."nivel" = 'rua' AND r."parentId" IS NULL;

-- Bloco 01 em cada rua.
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "parentId", "ativo", "status", "sequencia", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."companyId", 'bloco', '01', '01', r."id", true, 'ativo', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "NivelEnderecoWms" r
WHERE r."nivel" = 'rua'
  AND NOT EXISTS (
    SELECT 1 FROM "NivelEnderecoWms" b
    WHERE b."parentId" = r."id" AND b."nivel" = 'bloco' AND b."codigo" = '01'
  );

-- Recria andares por combinação usada em endereços (sob o bloco 01 da rua da área).
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "parentId", "ativo", "status", "sequencia", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."companyId", 'andar', e."andar", e."andar", b."id", true, 'ativo', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "companyId", "local", "area", "rua", "andar" FROM "EnderecoWms"
) e
JOIN "NivelEnderecoWms" loc ON loc."companyId" = e."companyId" AND loc."nivel" = 'local' AND loc."codigo" = e."local"
JOIN "NivelEnderecoWms" ar ON ar."parentId" = loc."id" AND ar."nivel" = 'area' AND ar."codigo" = e."area"
JOIN "NivelEnderecoWms" ru ON ru."parentId" = ar."id" AND ru."nivel" = 'rua' AND ru."codigo" = e."rua"
JOIN "NivelEnderecoWms" b ON b."parentId" = ru."id" AND b."nivel" = 'bloco' AND b."codigo" = '01'
WHERE NOT EXISTS (
  SELECT 1 FROM "NivelEnderecoWms" an
  WHERE an."parentId" = b."id" AND an."nivel" = 'andar' AND an."codigo" = e."andar"
);

-- Andares de catálogo órfãos: liga ao primeiro bloco da empresa, se ainda sem pai.
UPDATE "NivelEnderecoWms" an
SET "parentId" = (
  SELECT b."id" FROM "NivelEnderecoWms" b
  WHERE b."companyId" = an."companyId" AND b."nivel" = 'bloco'
  ORDER BY b."codigo" ASC
  LIMIT 1
)
WHERE an."nivel" = 'andar' AND an."parentId" IS NULL;

DELETE FROM "NivelEnderecoWms" WHERE "nivel" = 'tipo';

ALTER TABLE "EnderecoWms" ADD COLUMN IF NOT EXISTS "andarId" TEXT;
ALTER TABLE "EnderecoWms" ADD COLUMN IF NOT EXISTS "codigoCompleto" TEXT;
ALTER TABLE "EnderecoWms" ADD COLUMN IF NOT EXISTS "bloco" TEXT;
ALTER TABLE "EnderecoWms" ADD COLUMN IF NOT EXISTS "tipoEndereco" TEXT;
ALTER TABLE "EnderecoWms" ADD COLUMN IF NOT EXISTS "sequencia" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EnderecoWms" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ativo';

UPDATE "EnderecoWms" SET
  "tipoEndereco" = "tipo",
  "bloco" = '01',
  "status" = CASE WHEN "ativo" THEN 'ativo' ELSE 'inativo' END,
  "codigoCompleto" = "local" || '-' || "area" || '-' || "rua" || '-01-' || "andar" || '-' || "posicao",
  "codigo" = "posicao";

UPDATE "EnderecoWms" e
SET "andarId" = an."id"
FROM "NivelEnderecoWms" loc
JOIN "NivelEnderecoWms" ar ON ar."parentId" = loc."id" AND ar."nivel" = 'area'
JOIN "NivelEnderecoWms" ru ON ru."parentId" = ar."id" AND ru."nivel" = 'rua'
JOIN "NivelEnderecoWms" b ON b."parentId" = ru."id" AND b."nivel" = 'bloco' AND b."codigo" = '01'
JOIN "NivelEnderecoWms" an ON an."parentId" = b."id" AND an."nivel" = 'andar'
WHERE loc."companyId" = e."companyId"
  AND loc."nivel" = 'local' AND loc."codigo" = e."local"
  AND ar."codigo" = e."area"
  AND ru."codigo" = e."rua"
  AND an."codigo" = e."andar";

-- Duplicatas após tirar o tipo do caminho: desativa as posteriores.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "companyId", "codigoCompleto" ORDER BY "createdAt", id
  ) AS rn
  FROM "EnderecoWms"
  WHERE "codigoCompleto" IS NOT NULL
)
UPDATE "EnderecoWms" e
SET
  "codigoCompleto" = e."codigoCompleto" || '-DUP-' || substr(e.id, 1, 8),
  "status" = 'inativo',
  "ativo" = false
FROM ranked
WHERE e.id = ranked.id AND ranked.rn > 1;

-- Placeholder de andar se ainda faltar (endereço órfão).
INSERT INTO "NivelEnderecoWms" ("id", "companyId", "nivel", "codigo", "nome", "parentId", "ativo", "status", "sequencia", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."companyId", 'andar', COALESCE(NULLIF(e."andar", ''), '0'), COALESCE(NULLIF(e."andar", ''), '0'),
  (
    SELECT b."id" FROM "NivelEnderecoWms" b
    WHERE b."companyId" = e."companyId" AND b."nivel" = 'bloco'
    LIMIT 1
  ),
  true, 'ativo', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "EnderecoWms" e
WHERE e."andarId" IS NULL
  AND EXISTS (SELECT 1 FROM "NivelEnderecoWms" b WHERE b."companyId" = e."companyId" AND b."nivel" = 'bloco')
  AND NOT EXISTS (
    SELECT 1 FROM "NivelEnderecoWms" an
    WHERE an."companyId" = e."companyId" AND an."nivel" = 'andar' AND an."codigo" = COALESCE(NULLIF(e."andar", ''), '0')
      AND an."parentId" = (
        SELECT b."id" FROM "NivelEnderecoWms" b
        WHERE b."companyId" = e."companyId" AND b."nivel" = 'bloco'
        LIMIT 1
      )
  );

UPDATE "EnderecoWms" e
SET "andarId" = (
  SELECT an."id" FROM "NivelEnderecoWms" an
  WHERE an."companyId" = e."companyId" AND an."nivel" = 'andar'
  LIMIT 1
)
WHERE e."andarId" IS NULL;

DROP INDEX IF EXISTS "NivelEnderecoWms_companyId_nivel_codigo_key";
DROP INDEX IF EXISTS "NivelEnderecoWms_companyId_nivel_ativo_idx";
DROP INDEX IF EXISTS "NivelEnderecoWms_companyId_nivel_paiCodigo_idx";
DROP INDEX IF EXISTS "NivelEnderecoWms_companyId_nivel_localCodigo_idx";

ALTER TABLE "NivelEnderecoWms" DROP COLUMN IF EXISTS "paiCodigo";
ALTER TABLE "NivelEnderecoWms" DROP COLUMN IF EXISTS "localCodigo";

CREATE UNIQUE INDEX "NivelEnderecoWms_company_parent_codigo_key"
  ON "NivelEnderecoWms" ("companyId", "parentId", "codigo")
  WHERE "parentId" IS NOT NULL;
CREATE UNIQUE INDEX "NivelEnderecoWms_company_local_codigo_key"
  ON "NivelEnderecoWms" ("companyId", "codigo")
  WHERE "parentId" IS NULL AND "nivel" = 'local';
CREATE INDEX "NivelEnderecoWms_companyId_parentId_sequencia_idx"
  ON "NivelEnderecoWms" ("companyId", "parentId", "sequencia");
CREATE INDEX "NivelEnderecoWms_companyId_nivel_status_idx"
  ON "NivelEnderecoWms" ("companyId", "nivel", "status");
CREATE INDEX "NivelEnderecoWms_companyId_ativo_idx"
  ON "NivelEnderecoWms" ("companyId", "ativo");

ALTER TABLE "NivelEnderecoWms"
  ADD CONSTRAINT "NivelEnderecoWms_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "NivelEnderecoWms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "EnderecoWms_companyId_codigo_key";
DROP INDEX IF EXISTS "EnderecoWms_companyId_local_area_tipo_idx";

ALTER TABLE "EnderecoWms" DROP COLUMN IF EXISTS "tipo";

ALTER TABLE "EnderecoWms" ALTER COLUMN "andarId" SET NOT NULL;
ALTER TABLE "EnderecoWms" ALTER COLUMN "codigoCompleto" SET NOT NULL;
ALTER TABLE "EnderecoWms" ALTER COLUMN "bloco" SET NOT NULL;
ALTER TABLE "EnderecoWms" ALTER COLUMN "tipoEndereco" SET NOT NULL;

CREATE UNIQUE INDEX "EnderecoWms_companyId_codigoCompleto_key" ON "EnderecoWms"("companyId", "codigoCompleto");
CREATE UNIQUE INDEX "EnderecoWms_andarId_codigo_key" ON "EnderecoWms"("andarId", "codigo");
CREATE INDEX "EnderecoWms_companyId_andarId_idx" ON "EnderecoWms"("companyId", "andarId");
CREATE INDEX "EnderecoWms_companyId_local_area_idx" ON "EnderecoWms"("companyId", "local", "area");

ALTER TABLE "EnderecoWms"
  ADD CONSTRAINT "EnderecoWms_andarId_fkey"
  FOREIGN KEY ("andarId") REFERENCES "NivelEnderecoWms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
