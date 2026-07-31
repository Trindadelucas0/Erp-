/**
 * Diagnóstico + simulação de puxamento de CT-e (Focus DistDFe / por chave).
 *
 * Uso:
 *   npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/diagnostico-cte-focus.ts
 * Opcional:
 *   --companyId=<uuid>
 *   --chave=<44 digitos>
 *   --reparar-cursor   (aplica reparar-cursor-nfe-focus se travado)
 *   --sync             (enfileira lote DistDFe e imprime logResumo)
 */
import { PrismaClient } from '@prisma/client'
import { clienteFocusNfe } from '../src/modulos/focus-nfe/cliente-focus-nfe.js'
import { importarCtePorChave } from '../src/modulos/focus-nfe/importar-cte-por-chave.js'
import { servicoFocusNfe } from '../src/modulos/focus-nfe/servico-focus-nfe.js'

const prisma = new PrismaClient()

function arg(nome: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`))
  return hit?.split('=').slice(1).join('=')
}

function flag(nome: string): boolean {
  return process.argv.includes(`--${nome}`)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const companyIdArg = arg('companyId')
  const chaveArg = arg('chave')?.replace(/\D/g, '')
  const fazerSync = flag('sync')
  const repararSeTravado = flag('reparar-cursor')

  const configs = await prisma.configuracaoFocusNfe.findMany({
    where: {
      ativo: true,
      ...(companyIdArg ? { companyId: companyIdArg } : {}),
    },
    select: {
      companyId: true,
      homologacao: true,
      apiToken: true,
      ultimaVersaoNfeRecebida: true,
      ultimaVersaoNfseRecebida: true,
      ultimaVersaoCteRecebida: true,
      company: { select: { name: true, cnpj: true } },
    },
  })

  if (configs.length === 0) {
    console.log('Nenhuma ConfiguracaoFocusNfe ativa encontrada.')
    return
  }

  console.log('=== 1. Diagnóstico CT-e / cursor DistDFe ===\n')

  type Alvo = {
    companyId: string
    chave: string
    apiToken: string
    homologacao: boolean
    cnpj: string
    cursorTravado: boolean
  }
  let alvo: Alvo | null = null

  for (const cfg of configs) {
    const companyId = cfg.companyId
    const cursor = cfg.ultimaVersaoCteRecebida ?? 0
    const agg = await prisma.nfeRecebida.aggregate({
      where: { companyId, tipoDocumento: 'cte' },
      _count: true,
      _max: { versaoFocus: true },
    })
    const qtd = agg._count
    const maxSalvo = agg._max.versaoFocus ?? 0
    const cursorTravado = cursor > 0 && qtd === 0

    console.log(`empresa: ${cfg.company.name ?? companyId}`)
    console.log(`  companyId=${companyId}`)
    console.log(`  cnpj=${cfg.company.cnpj ?? '—'}`)
    console.log(`  homologacao=${cfg.homologacao}`)
    console.log(
      `  cursorCte=${cursor} maxVersaoSalva=${maxSalvo} qtdCte=${qtd}` +
        (cursorTravado ? '  *** CURSOR TRAVADO ***' : '  ok')
    )
    console.log(
      `  cursors outros: nfe=${cfg.ultimaVersaoNfeRecebida} nfse=${cfg.ultimaVersaoNfseRecebida}`
    )

    const ctes = await prisma.nfeRecebida.findMany({
      where: { companyId, tipoDocumento: 'cte' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        chaveNfe: true,
        nfeCompleta: true,
        nomeEmitente: true,
        chaveNfeReferenciada: true,
        versaoFocus: true,
        statusEntrada: true,
        xmlConteudo: true,
      },
    })

    if (ctes.length === 0) {
      console.log('  CT-es recentes: (nenhum)')
    } else {
      console.log('  CT-es recentes (até 5):')
      for (const c of ctes) {
        const modelo = c.chaveNfe.length === 44 ? c.chaveNfe.slice(20, 22) : '??'
        console.log(
          `    …${c.chaveNfe.slice(-8)} modelo=${modelo} completa=${c.nfeCompleta}` +
            ` xml=${c.xmlConteudo ? `${c.xmlConteudo.length}b` : 'null'}` +
            ` emit=${c.nomeEmitente ?? '—'}` +
            ` nfRef=${c.chaveNfeReferenciada ? `…${c.chaveNfeReferenciada.slice(-8)}` : '—'}` +
            ` status=${c.statusEntrada} vFocus=${c.versaoFocus}`
        )
      }
    }
    console.log('')

    if (!alvo) {
      const escolhido =
        (chaveArg
          ? ctes.find((c) => c.chaveNfe === chaveArg) ??
            (await prisma.nfeRecebida.findFirst({
              where: { companyId, tipoDocumento: 'cte', chaveNfe: chaveArg },
              select: { chaveNfe: true },
            }))
          : null) ?? ctes[0]

      let chave = escolhido?.chaveNfe
      if (!chave && chaveArg && chaveArg.length === 44) {
        chave = chaveArg
      }
      if (chave && cfg.company.cnpj && cfg.apiToken) {
        alvo = {
          companyId,
          chave,
          apiToken: cfg.apiToken.trim(),
          homologacao: cfg.homologacao,
          cnpj: cfg.company.cnpj.replace(/\D/g, ''),
          cursorTravado,
        }
      } else if (cursorTravado && cfg.company.cnpj && cfg.apiToken) {
        alvo = {
          companyId,
          chave: chaveArg && chaveArg.length === 44 ? chaveArg : '',
          apiToken: cfg.apiToken.trim(),
          homologacao: cfg.homologacao,
          cnpj: cfg.company.cnpj.replace(/\D/g, ''),
          cursorTravado,
        }
      }
    }

    if (cursorTravado && repararSeTravado) {
      await prisma.configuracaoFocusNfe.update({
        where: { companyId },
        data: { ultimaVersaoCteRecebida: 0 },
      })
      console.log(`  reparado: ultimaVersaoCteRecebida ${cursor} → 0\n`)
      if (alvo && alvo.companyId === companyId) alvo.cursorTravado = false
    }
  }

  if (!alvo) {
    console.log('Sem alvo para simulação (sem CT-e no banco e sem --chave=).')
    console.log('Rode com --reparar-cursor --sync se o cursor estiver travado.')
    return
  }

  // --- Simulação A ---
  if (alvo.chave) {
    console.log('=== 2. Simulação A — importarCtePorChave (CT-e existente) ===\n')
    console.log(`chave=…${alvo.chave.slice(-8)} companyId=${alvo.companyId}`)
    const rImport = await importarCtePorChave(alvo.companyId, alvo.chave)
    console.log(JSON.stringify(rImport, null, 2))
    console.log('')
  } else {
    console.log('=== 2. Simulação A — pulada (sem chave CT-e local) ===\n')
  }

  // --- Simulação B ---
  if (alvo.chave) {
    console.log('=== 3. Simulação B — baixarXmlCte na Focus ===\n')
    const xmlResp = await clienteFocusNfe.baixarXmlCte(
      alvo.apiToken,
      alvo.homologacao,
      alvo.chave
    )
    if (!xmlResp.sucesso) {
      console.log(
        `FALHA Focus: http=${xmlResp.codigoHttp ?? '—'} msg=${xmlResp.mensagem}`
      )
    } else if (typeof xmlResp.dados !== 'string') {
      console.log('FALHA: resposta sem string XML')
    } else {
      const xml = xmlResp.dados
      const temCte =
        /<(?:\w+:)?CTe[\s>]/.test(xml) ||
        /<(?:\w+:)?cteProc[\s>]/.test(xml) ||
        /infCte/i.test(xml)
      console.log(
        `OK Focus: bytes=${xml.length} temMarcadoresCTe=${temCte}` +
          ` inicio=${JSON.stringify(xml.slice(0, 80))}`
      )
    }
    console.log('')
  } else {
    console.log('=== 3. Simulação B — pulada (sem chave) ===\n')
  }

  // --- DistDFe list peek (sempre) ---
  console.log('=== 4. Peek DistDFe listarCtesRecebidas (cursor atual) ===\n')
  const cfgAtual = await prisma.configuracaoFocusNfe.findUnique({
    where: { companyId: alvo.companyId },
    select: { ultimaVersaoCteRecebida: true },
  })
  const versaoCte = cfgAtual?.ultimaVersaoCteRecebida ?? 0
  const listaResp = await clienteFocusNfe.listarCtesRecebidas(
    alvo.apiToken,
    alvo.homologacao,
    alvo.cnpj,
    versaoCte > 0 ? versaoCte : undefined
  )
  if (!listaResp.sucesso) {
    console.log(
      `lista CT-e FALHA: http=${listaResp.codigoHttp ?? '—'} msg=${listaResp.mensagem}`
    )
  } else {
    const lista = Array.isArray(listaResp.dados) ? listaResp.dados : []
    const maxH = listaResp.headers['x-max-version']
    console.log(
      `lista CT-e OK: qtd=${lista.length} versao≥${versaoCte} x-max-version=${maxH ?? '—'}`
    )
    for (const item of lista.slice(0, 5)) {
      const raw = item as Record<string, unknown>
      const ch =
        (typeof raw.chave_cte === 'string' && raw.chave_cte) ||
        (typeof raw.chave === 'string' && raw.chave) ||
        (typeof raw.chave_acesso === 'string' && raw.chave_acesso) ||
        '?'
      console.log(
        `  item versao=${raw.versao ?? '—'} chave=…${String(ch).replace(/\D/g, '').slice(-8)}`
      )
    }
    if (lista.length === 0) {
      console.log(
        '  (0 documentos neste cursor — sync DistDFe não trará CT-e novos até reset/cursor atrás)'
      )
    }
  }
  console.log('')

  // --- Simulação C ---
  if (fazerSync) {
    console.log('=== 5. Simulação C — enfileirarSync (lote DistDFe) ===\n')
    try {
      const { jobId, status } = await servicoFocusNfe.enfileirarSync(alvo.companyId, {
        completo: false,
      })
      console.log(`job iniciado id=${jobId} status=${status}`)
      let final: Awaited<ReturnType<typeof servicoFocusNfe.statusJob>> | null = null
      for (let i = 0; i < 90; i++) {
        await sleep(1000)
        final = await servicoFocusNfe.statusJob(alvo.companyId, jobId)
        if (
          final.status === 'ok' ||
          final.status === 'concluido' ||
          final.status === 'erro'
        ) {
          break
        }
        if (i % 5 === 0) {
          console.log(`  … ${final.status} ${final.progresso}% — ${final.mensagem ?? ''}`)
        }
      }
      if (!final) {
        console.log('job sem status')
      } else {
        console.log(`\njob final: status=${final.status} progresso=${final.progresso}%`)
        console.log(`mensagem: ${final.mensagem ?? '—'}`)
        const log = (final as { logResumo?: string | null }).logResumo
        if (log) {
          console.log('--- logResumo (linhas com cte) ---')
          for (const linha of log.split('\n')) {
            if (/cte/i.test(linha)) console.log(linha)
          }
          console.log('--- fim log cte ---')
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`sync FALHOU: ${msg}`)
    }
    console.log('')
  } else {
    console.log('=== 5. Simulação C — pulada (passe --sync para enfileirar lote) ===\n')
  }

  console.log('=== Fim diagnóstico ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
