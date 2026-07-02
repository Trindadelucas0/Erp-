-- DropForeignKey
ALTER TABLE "DadosFornecedor" DROP CONSTRAINT IF EXISTS "DadosFornecedor_cfopSugestaoXmlId_fkey";
ALTER TABLE "DadosFornecedor" DROP CONSTRAINT IF EXISTS "DadosFornecedor_planoFinanceiroAlternativoId_fkey";

-- AlterTable
ALTER TABLE "DadosFornecedor" DROP COLUMN IF EXISTS "cfopSugestaoXmlId";
ALTER TABLE "DadosFornecedor" DROP COLUMN IF EXISTS "planoFinanceiroAlternativoId";
