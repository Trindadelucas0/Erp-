-- Conferência por IA: relatório salvo ao solicitar ajuste, exibido como PDF no portal do fornecedor
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD COLUMN "relatorioConferenciaJson" JSONB;
