-- AlterTable
ALTER TABLE "RecorrenciaFinanceira" ADD COLUMN "periodicidade" TEXT NOT NULL DEFAULT 'mensal';
ALTER TABLE "RecorrenciaFinanceira" ADD COLUMN "diaVencimento" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RecorrenciaFinanceira" ADD COLUMN "competenciaInicio" TEXT NOT NULL DEFAULT '2020-01';
ALTER TABLE "RecorrenciaFinanceira" ADD COLUMN "competenciaFim" TEXT;
