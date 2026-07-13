-- AlterTable
ALTER TABLE "Produto" ADD COLUMN "multiploVenda" DECIMAL(15,4) NOT NULL DEFAULT 1;
ALTER TABLE "Produto" ADD COLUMN "permiteVendaFracionada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Produto" ADD COLUMN "unidadeEntregaMultiploVenda" TEXT;
