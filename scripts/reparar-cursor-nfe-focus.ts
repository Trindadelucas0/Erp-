/**
 * Repara cursor DistDFe quando ultimaVersao* avançou além das notas persistidas
 * (bug antigo do x-max-version no lote incompleto ou falha de XML CT-e avançando cursor).
 *
 * CT-e especial: se cursor > 0 e **zero** CT-es salvos, DistDFe ficou travado
 * (ex.: bug toma3 avançou cursor sem gravar) → reset para 0.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type TipoCursor = {
  campo: 'ultimaVersaoNfeRecebida' | 'ultimaVersaoNfseRecebida' | 'ultimaVersaoCteRecebida'
  tipoDocumento: 'nfe55' | 'nfse' | 'cte'
  rotulo: string
}

const TIPOS: TipoCursor[] = [
  { campo: 'ultimaVersaoNfeRecebida', tipoDocumento: 'nfe55', rotulo: 'nfe' },
  { campo: 'ultimaVersaoNfseRecebida', tipoDocumento: 'nfse', rotulo: 'nfse' },
  { campo: 'ultimaVersaoCteRecebida', tipoDocumento: 'cte', rotulo: 'cte' },
]

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
    for (const tipo of TIPOS) {
      const maxDoc = await prisma.nfeRecebida.aggregate({
        where: { companyId: cfg.companyId, tipoDocumento: tipo.tipoDocumento },
        _max: { versaoFocus: true },
        _count: true,
      })
      const maxSalvo = maxDoc._max.versaoFocus ?? 0
      const cursor = cfg[tipo.campo] ?? 0
      const qtd = maxDoc._count as number

      // DistDFe travado: cursor avançou e nenhum documento do tipo foi salvo.
      if (tipo.tipoDocumento === 'cte' && cursor > 0 && qtd === 0) {
        await prisma.configuracaoFocusNfe.update({
          where: { companyId: cfg.companyId },
          data: { ultimaVersaoCteRecebida: 0 },
        })
        console.log(
          `reparado companyId=${cfg.companyId} cte cursor ${cursor} → 0 (nenhum cte salvo — DistDFe travado)`
        )
        continue
      }

      if (cursor > maxSalvo && qtd > 0) {
        await prisma.configuracaoFocusNfe.update({
          where: { companyId: cfg.companyId },
          data: { [tipo.campo]: maxSalvo },
        })
        console.log(
          `reparado companyId=${cfg.companyId} ${tipo.rotulo} cursor ${cursor} → ${maxSalvo} (notas=${qtd})`
        )
      } else {
        console.log(
          `ok companyId=${cfg.companyId} ${tipo.rotulo} cursor=${cursor} maxSalvo=${maxSalvo} notas=${qtd}`
        )
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
