-- Portal do fornecedor: bloqueio manual do acesso (só o usuário do sistema pode bloquear)
ALTER TABLE "PedidoCompra" ADD COLUMN "portalBloqueadoEm" TIMESTAMP(3);
