-- Invalida cache de PDF (inclui PDFs auxiliares gerados do XML antes da remoção do recurso).
-- Próximo download tentará apenas a Focus (DANFE/DACTe oficial).
UPDATE "NfeRecebida"
SET "danfeCaminho" = NULL,
    "danfeStatus" = NULL,
    "danfeAtualizadoEm" = NULL;
