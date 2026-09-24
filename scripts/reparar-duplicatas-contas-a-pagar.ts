/**
 * Reparo em lote: Contas a Pagar origem NFe cujas parcelas não batem com
 * as duplicatas `cobr/dup` do XML (todas as empresas ou uma).
 *
 * Uso:
 *   npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/reparar-duplicatas-contas-a-pagar.ts
 * Opcional: --companyId=<uuid>  --dry-run  --limite=50
 */
import './carregar-url-do-banco.js'
import { repararParcelasDuplicatasContasPagar } from '../src/modulos/contas-a-pagar/gerar-titulos-entrada.js'

async function main() {
  const companyId = process.argv.find((a) => a.startsWith('--companyId='))?.split('=')[1]
  const dryRun = process.argv.includes('--dry-run')
  const limiteRaw = process.argv.find((a) => a.startsWith('--limite='))?.split('=')[1]
  const limite = limiteRaw ? Math.max(1, Number(limiteRaw)) : undefined

  console.log(
    `Reparo duplicatas Contas a pagar${companyId ? ` (company ${companyId})` : ' (todas as empresas)'}${
      dryRun ? ' [dry-run]' : ''
    }${limite ? ` limite=${limite}` : ''}`
  )

  const r = await repararParcelasDuplicatasContasPagar({
    companyId,
    dryRun,
    limite,
  })

  console.log(
    `Examinados: ${r.examinados} | Reparados: ${r.reparados} | Pulados: ${r.pulados}`
  )
  for (const d of r.detalhes.slice(0, 50)) {
    console.log(
      `  ${dryRun ? '[dry-run] ' : ''}company=${d.companyId.slice(0, 8)}… conta=${d.codigo} (${d.de} → ${d.para} parcelas) nota=${d.nfeRecebidaId.slice(0, 8)}…`
    )
  }
  if (r.detalhes.length > 50) console.log(`  … +${r.detalhes.length - 50} omitidas`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
