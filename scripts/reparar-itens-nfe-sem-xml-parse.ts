/**
 * Reparo em lote: NFe 55 sem NfeRecebidaItem.
 * Se o XML salvo for só resNFe (DistDFe), rebaixa o XML completo na Focus;
 * depois extrai itens, reabre notas lançadas indevidamente e reanalisa.
 *
 * Uso:
 *   npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/reparar-itens-nfe-sem-xml-parse.ts
 * Opcional: --companyId=<uuid>  --dry-run  --limite=20
 */
import './carregar-url-do-banco.js'
import { PrismaClient } from '@prisma/client'
import {
  extrairItensDoXml,
  xmlNfeTemItensParseaveis,
} from '../src/modulos/focus-nfe/parser-xml-nfe.js'
import { repositorioEntradaNotas } from '../src/modulos/entrada-notas/repositorio-entrada-notas.js'
import { servicoEntradaNotas } from '../src/modulos/entrada-notas/servico-pipeline-entrada.js'
import { servicoFocusNfe } from '../src/modulos/focus-nfe/servico-focus-nfe.js'

const prisma = new PrismaClient()

type NotaAlvo = {
  id: string
  companyId: string
  chaveNfe: string
  statusEntrada: string
  temXml: boolean
}

async function listarSemItens(companyId?: string): Promise<NotaAlvo[]> {
  if (companyId) {
    return prisma.$queryRaw<NotaAlvo[]>`
      SELECT
        n.id,
        n."companyId" AS "companyId",
        n."chaveNfe" AS "chaveNfe",
        n."statusEntrada" AS "statusEntrada",
        (n."xmlConteudo" IS NOT NULL) AS "temXml"
      FROM "NfeRecebida" n
      WHERE n."tipoDocumento" = 'nfe55'
        AND n."companyId" = ${companyId}
        AND NOT EXISTS (SELECT 1 FROM "NfeRecebidaItem" i WHERE i."nfeRecebidaId" = n.id)
      ORDER BY n."updatedAt" DESC
    `
  }
  return prisma.$queryRaw<NotaAlvo[]>`
    SELECT
      n.id,
      n."companyId" AS "companyId",
      n."chaveNfe" AS "chaveNfe",
      n."statusEntrada" AS "statusEntrada",
      (n."xmlConteudo" IS NOT NULL) AS "temXml"
    FROM "NfeRecebida" n
    WHERE n."tipoDocumento" = 'nfe55'
      AND NOT EXISTS (SELECT 1 FROM "NfeRecebidaItem" i WHERE i."nfeRecebidaId" = n.id)
    ORDER BY n."updatedAt" DESC
  `
}

async function main() {
  const companyId = process.argv.find((a) => a.startsWith('--companyId='))?.split('=')[1]
  const dryRun = process.argv.includes('--dry-run')
  const limiteRaw = process.argv.find((a) => a.startsWith('--limite='))?.split('=')[1]
  const limite = limiteRaw ? Math.max(1, Number(limiteRaw)) : undefined

  let alvos = await listarSemItens(companyId)
  if (limite) alvos = alvos.slice(0, limite)

  console.log(
    `Encontradas ${alvos.length} NFe 55 sem itens${companyId ? ` (company ${companyId})` : ''}${limite ? ` (limite ${limite})` : ''}`
  )
  if (dryRun) {
    for (const n of alvos.slice(0, 30)) {
      console.log(
        `[dry-run] ${n.temXml ? 'COM_XML' : 'SEM_XML'} | ${n.statusEntrada} | ${n.chaveNfe}`
      )
    }
    if (alvos.length > 30) console.log(`… +${alvos.length - 30} omitidas`)
    return
  }

  let reparadas = 0
  let reabertas = 0
  let rebaixadosFocus = 0
  let semXmlFocus = 0
  let falhas = 0
  const amostraOk: string[] = []
  const amostraSemXml: string[] = []

  for (const n of alvos) {
    try {
      let nota = await prisma.nfeRecebida.findUnique({
        where: { id: n.id },
        select: { xmlConteudo: true, statusEntrada: true },
      })

      if (!nota?.xmlConteudo || !xmlNfeTemItensParseaveis(nota.xmlConteudo)) {
        // resNFe / XML incompleto — força download completo na Focus
        await prisma.nfeRecebida.update({
          where: { id: n.id },
          data: { nfeCompleta: false },
        })
        try {
          await servicoFocusNfe.obterXmlNota(n.companyId, n.id, 'visualizar')
          rebaixadosFocus += 1
        } catch (erroFocus) {
          semXmlFocus += 1
          const msg = erroFocus instanceof Error ? erroFocus.message : String(erroFocus)
          console.warn(`focus_falhou: ${n.chaveNfe} — ${msg}`)
          if (amostraSemXml.length < 10) amostraSemXml.push(n.chaveNfe)
          continue
        }
        nota = await prisma.nfeRecebida.findUnique({
          where: { id: n.id },
          select: { xmlConteudo: true, statusEntrada: true },
        })
      }

      if (!nota?.xmlConteudo || !xmlNfeTemItensParseaveis(nota.xmlConteudo)) {
        semXmlFocus += 1
        console.warn(`ainda_resumo: ${n.chaveNfe}`)
        if (amostraSemXml.length < 10) amostraSemXml.push(n.chaveNfe)
        continue
      }

      const itens = extrairItensDoXml(nota.xmlConteudo)
      if (itens.length === 0) {
        semXmlFocus += 1
        continue
      }

      const qtdAtual = await repositorioEntradaNotas.contarItens(n.id)
      if (qtdAtual === 0) {
        await repositorioEntradaNotas.substituirItensDoXml(n.id, itens)
      }

      const finalizada =
        nota.statusEntrada === 'entrada_contagem' ||
        nota.statusEntrada === 'entrada_contagem_ok' ||
        nota.statusEntrada === 'entrada_contagem_divergente' ||
        nota.statusEntrada === 'entrada_consolidada'
      if (finalizada) {
        await repositorioEntradaNotas.atualizarNota(n.id, {
          statusEntrada: 'em_analise',
          etapaAtual: 'cadastro',
          origemLancamento: null,
        })
        reabertas += 1
      }

      await servicoEntradaNotas.analisarNota(n.companyId, n.id)
      reparadas += 1
      if (amostraOk.length < 15) amostraOk.push(`${n.chaveNfe} (+${itens.length})`)
      console.log(
        `ok: ${n.chaveNfe} itens=${itens.length}${finalizada ? ' reaberta' : ''} statusAntes=${n.statusEntrada}`
      )
      // Evita 429 da Focus no lote
      await new Promise((r) => setTimeout(r, 1500))
    } catch (erro) {
      falhas += 1
      console.error(
        `falha: ${n.chaveNfe}`,
        erro instanceof Error ? erro.message : String(erro)
      )
      await new Promise((r) => setTimeout(r, 3000))
    }
  }

  console.log('\n=== RESUMO ===')
  console.log(
    JSON.stringify(
      {
        totalAlvos: alvos.length,
        reparadas,
        reabertas,
        rebaixadosFocus,
        semXmlFocus,
        falhas,
        amostraOk,
        amostraSemXml,
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
