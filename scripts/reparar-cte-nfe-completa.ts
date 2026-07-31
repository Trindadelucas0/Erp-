/**
 * Corrige nfeCompleta=false em CT-e/NFS-e que já têm XML (efeito colateral do BUSCAR antigo).
 * Uso: npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/reparar-cte-nfe-completa.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const r = await prisma.nfeRecebida.updateMany({
    where: {
      tipoDocumento: { in: ['cte', 'nfse'] },
      nfeCompleta: false,
      xmlConteudo: { not: null },
    },
    data: { nfeCompleta: true },
  })
  console.log(`atualizados=${r.count} (cte/nfse com XML → nfeCompleta=true)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
