-- AlterTable
ALTER TABLE "ZapsignDocumento" ADD COLUMN     "clientePessoaId" TEXT;

-- AddForeignKey
ALTER TABLE "ZapsignDocumento" ADD CONSTRAINT "ZapsignDocumento_clientePessoaId_fkey" FOREIGN KEY ("clientePessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
