/**

 * Flags e calibração de Ver nota / Baixar XML / Baixar PDF.

 * Defaults vêm do .env; a empresa pode sobrescrever campos em recursosEntradaNotasJson.

 */

import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'



export type RecursosEntradaNotas = {

  verNota: boolean

  baixarXml: boolean

  baixarPdfFocus: boolean

  danfeCacheIndisponivelHoras: number

  danfeRateLimitMinutos: number

}



/** Override parcial persistido em Company.recursosEntradaNotasJson. */

export type OverrideRecursosEntradaNotas = Partial<{

  verNota: boolean | null

  baixarXml: boolean | null

  baixarPdfFocus: boolean | null

  danfeCacheIndisponivelHoras: number | null

  danfeRateLimitMinutos: number | null

}>



function lerBoolEnv(nome: string, padrao: boolean): boolean {

  const raw = process.env[nome]?.trim().toLowerCase()

  if (raw === undefined || raw === '') return padrao

  if (raw === 'false' || raw === '0' || raw === 'nao' || raw === 'não') return false

  if (raw === 'true' || raw === '1' || raw === 'sim') return true

  return padrao

}



function lerIntEnv(nome: string, padrao: number): number {

  const raw = process.env[nome]?.trim()

  if (!raw) return padrao

  const n = Number(raw)

  if (!Number.isFinite(n) || n < 0) return padrao

  return Math.floor(n)

}



/** Parâmetros do .env (sem consulta ao banco). */

export function lerDefaultsRecursosEntradaNotas(): RecursosEntradaNotas {

  return {

    verNota: lerBoolEnv('ENTRADA_NOTAS_VER_NOTA', true),

    baixarXml: lerBoolEnv('ENTRADA_NOTAS_BAIXAR_XML', true),

    baixarPdfFocus: lerBoolEnv('ENTRADA_NOTAS_BAIXAR_PDF_FOCUS', true),

    danfeCacheIndisponivelHoras: lerIntEnv(

      'ENTRADA_NOTAS_DANFE_CACHE_INDISPONIVEL_HORAS',

      24

    ),

    danfeRateLimitMinutos: lerIntEnv('ENTRADA_NOTAS_DANFE_RATE_LIMIT_MINUTOS', 2),

  }

}



function boolOuAusente(valor: unknown): boolean | undefined {

  if (valor === null || valor === undefined) return undefined

  if (typeof valor === 'boolean') return valor

  return undefined

}



function intOuAusente(valor: unknown): number | undefined {

  if (valor === null || valor === undefined) return undefined

  if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0) {

    return Math.floor(valor)

  }

  return undefined

}



/** Mescla defaults do env com override parcial da empresa. */

export function mesclarRecursosEntradaNotas(

  defaults: RecursosEntradaNotas,

  override: OverrideRecursosEntradaNotas | null | undefined

): RecursosEntradaNotas {

  if (!override || typeof override !== 'object') return { ...defaults }



  const verNota = boolOuAusente(override.verNota)

  const baixarXml = boolOuAusente(override.baixarXml)

  const baixarPdfFocus = boolOuAusente(override.baixarPdfFocus)

  const danfeCacheIndisponivelHoras = intOuAusente(

    override.danfeCacheIndisponivelHoras

  )

  const danfeRateLimitMinutos = intOuAusente(override.danfeRateLimitMinutos)



  return {

    verNota: verNota ?? defaults.verNota,

    baixarXml: baixarXml ?? defaults.baixarXml,

    baixarPdfFocus: baixarPdfFocus ?? defaults.baixarPdfFocus,

    danfeCacheIndisponivelHoras:

      danfeCacheIndisponivelHoras ?? defaults.danfeCacheIndisponivelHoras,

    danfeRateLimitMinutos:

      danfeRateLimitMinutos ?? defaults.danfeRateLimitMinutos,

  }

}



/** Config efetiva da empresa (env + JSON parcial). */

export async function obterRecursosEntradaNotas(

  companyId: string

): Promise<RecursosEntradaNotas> {

  const defaults = lerDefaultsRecursosEntradaNotas()

  const empresa = await clientePrisma.company.findUnique({

    where: { id: companyId },

    select: { recursosEntradaNotasJson: true },

  })

  const raw = empresa?.recursosEntradaNotasJson

  const override =

    raw && typeof raw === 'object' && !Array.isArray(raw)

      ? (raw as OverrideRecursosEntradaNotas)

      : null

  return mesclarRecursosEntradaNotas(defaults, override)

}


