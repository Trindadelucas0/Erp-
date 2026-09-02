-- Finalidade da entrada (NFe 55): propriedade da nota, não do fornecedor.
ALTER TABLE "NfeRecebida" ADD COLUMN "finalidadeEntrada" TEXT;

-- Backfill só de notas já lançadas/consolidadas, pela regra antiga das flags.
-- Notas em análise permanecem null (operador escolhe).
UPDATE "NfeRecebida" n
SET "finalidadeEntrada" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "PessoaPapel" pp
    INNER JOIN "DadosFornecedor" df ON df."papelId" = pp."id"
    WHERE pp."pessoaId" = n."fornecedorPessoaId"
      AND pp."papel" = 'fornecedor'
      AND COALESCE(df."tipoRevenda", false) = false
      AND (
        COALESCE(df."tipoConsumo", false) = true
        OR COALESCE(df."tipoPrestadorServico", false) = true
      )
      AND COALESCE(df."exigirItensEntrada", false) = false
  ) THEN 'uso_consumo'
  ELSE 'revenda'
END
WHERE n."tipoDocumento" = 'nfe55'
  AND n."statusEntrada" IN (
    'aguardando_chegada',
    'entrada_contagem',
    'entrada_contagem_ok',
    'entrada_contagem_divergente',
    'pronta_para_consolidar',
    'entrada_consolidada'
  );
