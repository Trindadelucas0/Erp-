-- AlterTable
ALTER TABLE "DadosCliente" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Pessoa" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cargo" TEXT DEFAULT '';
