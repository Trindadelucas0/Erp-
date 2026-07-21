-- Cache DANFE/DANFSe em disco + status local (evita reconsultar Focus)
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "danfeCaminho" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "danfeStatus" TEXT;
ALTER TABLE "NfeRecebida" ADD COLUMN IF NOT EXISTS "danfeAtualizadoEm" TIMESTAMP(3);
