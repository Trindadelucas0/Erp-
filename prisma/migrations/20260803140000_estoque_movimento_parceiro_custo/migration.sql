-- Kardex profissional: parceiro + snapshot de preço de custo no movimento
ALTER TABLE "EstoqueMovimento" ADD COLUMN IF NOT EXISTS "precoCusto" DECIMAL(15,4);
ALTER TABLE "EstoqueMovimento" ADD COLUMN IF NOT EXISTS "pessoaId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EstoqueMovimento_pessoaId_fkey'
  ) THEN
    ALTER TABLE "EstoqueMovimento"
      ADD CONSTRAINT "EstoqueMovimento_pessoaId_fkey"
      FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EstoqueMovimento_pessoaId_idx" ON "EstoqueMovimento"("pessoaId");
