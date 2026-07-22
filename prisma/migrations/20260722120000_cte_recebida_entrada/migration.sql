-- Cursor DistDFe CTe + tipoDocumento cte na Entrada de Notas
ALTER TABLE "ConfiguracaoFocusNfe" ADD COLUMN IF NOT EXISTS "ultimaVersaoCteRecebida" INTEGER NOT NULL DEFAULT 0;
