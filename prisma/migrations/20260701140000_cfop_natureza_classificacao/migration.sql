-- AlterTable
ALTER TABLE "Cfop" ADD COLUMN "natureza" TEXT NOT NULL DEFAULT 'entrada';
ALTER TABLE "Cfop" ADD COLUMN "abrangencia" TEXT;
ALTER TABLE "Cfop" ADD COLUMN "subtipoCfop" TEXT;

-- Backfill natureza e abrangencia a partir do prefixo do codigo
UPDATE "Cfop" SET
  "natureza" = CASE SUBSTRING(REPLACE("codigo", '.', ''), 1, 1)
    WHEN '1' THEN 'entrada'
    WHEN '2' THEN 'entrada'
    WHEN '3' THEN 'importacao'
    WHEN '5' THEN 'saida'
    WHEN '6' THEN 'saida'
    WHEN '7' THEN 'exportacao'
    ELSE 'entrada'
  END,
  "abrangencia" = CASE SUBSTRING(REPLACE("codigo", '.', ''), 1, 1)
    WHEN '1' THEN 'estadual'
    WHEN '2' THEN 'interestadual'
    WHEN '5' THEN 'estadual'
    WHEN '6' THEN 'interestadual'
    ELSE NULL
  END;

-- Backfill subtipoCfop a partir de tipoCfop antigo (03-06)
UPDATE "Cfop" SET "subtipoCfop" = "tipoCfop"
WHERE "tipoCfop" IN ('03', '04', '05', '06');

-- Normalizar tipoCfop base para registros que tinham 03-06 como subtipo
UPDATE "Cfop" SET "tipoCfop" = CASE
  WHEN "natureza" IN ('entrada', 'importacao') THEN '01'
  ELSE '02'
END
WHERE "tipoCfop" IN ('03', '04', '05', '06');

-- Atualizar tipo legado entrada/saida
UPDATE "Cfop" SET "tipo" = CASE
  WHEN "natureza" IN ('entrada', 'importacao') THEN 'entrada'
  ELSE 'saida'
END;
