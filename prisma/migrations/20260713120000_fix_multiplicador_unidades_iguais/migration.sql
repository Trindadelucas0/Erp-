-- Normaliza legados: unidades efetivamente iguais com multiplicador inconsistente.
UPDATE "ProdutoFornecedor" pf
SET "multiplicadorEntrada" = 1
FROM "Produto" p
WHERE pf."produtoId" = p."id"
  AND pf."multiplicadorEntrada" IS NOT NULL
  AND pf."multiplicadorEntrada" <> 1
  AND (
    pf."unidadeEntrada" IS NULL
    OR TRIM(pf."unidadeEntrada") = ''
    OR UPPER(TRIM(pf."unidadeEntrada")) = UPPER(TRIM(p."unidade"))
  );
