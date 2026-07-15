-- Conferência por IA: aprovar/solicitar ajuste do documento enviado pelo fornecedor
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD COLUMN "statusConferencia" TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD COLUMN "motivoAjuste" TEXT;
ALTER TABLE "PedidoCompraAnexoFornecedor" ADD COLUMN "decididoEm" TIMESTAMP(3);
