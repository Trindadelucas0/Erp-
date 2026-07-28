-- Override parcial de recursos (Ver nota / XML / PDF) por empresa.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "recursosEntradaNotasJson" JSONB;
