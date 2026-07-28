/**
 * Remove PDFs auxiliares legados (gerados do XML) em uploads/nfe-recebidas
 * e zera danfeCaminho/danfeStatus das notas que apontavam para eles.
 */
import './carregar-url-do-banco.js'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { clientePrisma } from '../src/compartilhado/banco-dados/cliente-prisma.js'
import {
  caminhoRelativoDanfe,
  detectarPdfAuxiliarLegado,
  removerArquivoDanfe,
} from '../src/modulos/focus-nfe/armazenamento-danfe.js'

const pasta = path.join(process.cwd(), 'uploads', 'nfe-recebidas')
let removidos = 0

async function walk(dir: string) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      await walk(full)
      continue
    }
    if (!e.name.endsWith('.pdf')) continue

    const buf = await readFile(full)
    if (!(await detectarPdfAuxiliarLegado(buf))) continue

    const companyId = path.basename(path.dirname(full))
    const notaId = e.name.replace(/\.pdf$/i, '')
    const relativo = caminhoRelativoDanfe(companyId, notaId)

    await removerArquivoDanfe(relativo)
    await clientePrisma.nfeRecebida.updateMany({
      where: { id: notaId, danfeCaminho: relativo },
      data: {
        danfeCaminho: null,
        danfeStatus: null,
        danfeAtualizadoEm: null,
      },
    })
    removidos++
    console.log('removido:', relativo)
  }
}

await walk(pasta)
console.log('total_removidos:', removidos)
await clientePrisma.$disconnect()
