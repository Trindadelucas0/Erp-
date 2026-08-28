-- AlterTable
ALTER TABLE "NfeRecebida" ADD COLUMN "planoFinanceiroId" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN "parcelasFinanceiras" JSONB;

-- AddForeignKey
ALTER TABLE "NfeRecebida" ADD CONSTRAINT "NfeRecebida_planoFinanceiroId_fkey" FOREIGN KEY ("planoFinanceiroId") REFERENCES "PlanoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "NfeRecebida_planoFinanceiroId_idx" ON "NfeRecebida"("planoFinanceiroId");

-- Migrar NFS-e documentais que estavam em entrada_contagem para pronta_para_consolidar
UPDATE "NfeRecebida"
SET "statusEntrada" = 'pronta_para_consolidar'
WHERE "statusEntrada" = 'entrada_contagem'
  AND "tipoDocumento" = 'nfse';

-- NFe consumo/prestador (modo documental) legadas em entrada_contagem
UPDATE "NfeRecebida" n
SET "statusEntrada" = 'pronta_para_consolidar'
FROM "Pessoa" p
JOIN "PessoaPapel" pp ON pp."pessoaId" = p.id AND pp."papel" = 'fornecedor' AND pp."ativo" = true
JOIN "DadosFornecedor" df ON df."papelId" = pp.id
WHERE n."statusEntrada" = 'entrada_contagem'
  AND n."tipoDocumento" = 'nfe55'
  AND n."fornecedorPessoaId" = p.id
  AND (df."tipoConsumo" = true OR df."tipoPrestadorServico" = true)
  AND df."tipoRevenda" = false
  AND COALESCE(df."exigirItensEntrada", false) = false;
