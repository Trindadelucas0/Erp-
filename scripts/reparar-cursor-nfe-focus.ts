/**
 * Repara cursor DistDFe NFe quando ultimaVersaoNfeRecebida avançou além
 * das notas persistidas (bug antigo do x-max-version no lote incompleto).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const companies = await prisma.configuracaoFocusNfe.findMany({
    where: { ativo: true },
    select: {
      companyId: true,
      ultimaVersaoNfeRecebida: true,
      ultimaVersaoNfseRecebida: true,
      ultimaVersaoCteRecebida: true,
    },
  })

  for (const cfg of companies) {
    const maxNfe = await prisma.nfeRecebida.aggregate({
      where: { companyId: cfg.companyId, tipoDocumento: 'nfe55' },
      _max: { versaoFocus: true },
      _count: true,
    })
    const maxSalvo = maxNfe._max.versaoFocus ?? 0
    const cursor = cfg.ultimaVersaoNfeRecebida ?? 0

    if (cursor > maxSalvo && maxNfe._count > 0) {
      await prisma.configuracaoFocusNfe.update({
        where: { companyId: cfg.companyId },
        data: { ultimaVersaoNfeRecebida: maxSalvo },
      })
      console.log(
        `reparado companyId=${cfg.companyId} nfe cursor ${cursor} → ${maxSalvo} (notas=${maxNfe._count})`
      )
    } else {
      console.log(
        `ok companyId=${cfg.companyId} nfe cursor=${cursor} maxSalvo=${maxSalvo} notas=${maxNfe._count}`
      )
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
