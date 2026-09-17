-- AlterTable
ALTER TABLE "RequisicaoWms" ADD COLUMN "qtdExecutada" DECIMAL(18,4);
ALTER TABLE "RequisicaoWms" ADD COLUMN "conferidoOrigemEm" TIMESTAMP(3);
ALTER TABLE "RequisicaoWms" ADD COLUMN "conferidoProdutoEm" TIMESTAMP(3);
ALTER TABLE "RequisicaoWms" ADD COLUMN "conferidoDestinoEm" TIMESTAMP(3);
ALTER TABLE "RequisicaoWms" ADD COLUMN "conferidoOrigemValor" TEXT;
ALTER TABLE "RequisicaoWms" ADD COLUMN "conferidoProdutoValor" TEXT;
ALTER TABLE "RequisicaoWms" ADD COLUMN "conferidoDestinoValor" TEXT;
