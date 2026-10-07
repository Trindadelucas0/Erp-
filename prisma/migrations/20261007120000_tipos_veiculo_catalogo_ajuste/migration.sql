-- Tipos de veículo: retirar Van, Carreta, Bicicleta, Ônibus do catálogo ativo; limpar ícones removidos; Utilitário → Pick up.

UPDATE "TipoVeiculo"
SET "ativo" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("nome")) IN ('van', 'carreta', 'bicicleta', 'onibus', 'ônibus');

UPDATE "TipoVeiculo"
SET "icone" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "icone" IN ('van', 'carreta', 'bicicleta', 'onibus');

UPDATE "TipoVeiculo" u
SET "nome" = 'Pick up',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim(u."nome")) IN ('utilitário', 'utilitario')
  AND NOT EXISTS (
    SELECT 1
    FROM "TipoVeiculo" p
    WHERE p."companyId" = u."companyId"
      AND p."id" <> u."id"
      AND lower(trim(p."nome")) = 'pick up'
  );
