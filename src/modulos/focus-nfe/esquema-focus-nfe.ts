import { z } from 'zod'

export const esquemaParaSalvarConfigFocus = z.object({
  apiToken: z
    .string()
    .min(10, 'Token Focus muito curto — verifique no painel Focus NFe'),
  homologacao: z.boolean(),
})

export const CHECKS_FISCAIS = ['ncm', 'origem', 'cst_cfop'] as const

export const esquemaRegrasFiscais = z.object({
  versaoSchema: z.literal(1).default(1),
  ativo: z.boolean(),
  checks: z.array(z.enum(CHECKS_FISCAIS)).default([...CHECKS_FISCAIS]),
  observacao: z.string().max(500).optional().nullable(),
})

export const esquemaManifestar = z.object({
  tipo: z.enum(['ciencia', 'confirmacao', 'desconhecimento', 'nao_realizada']),
  justificativa: z.string().min(15).max(255).optional(),
})

export const esquemaImportarXml = z.object({
  xml: z.string().min(50, 'XML inválido ou vazio'),
})

export type DadosParaSalvarConfigFocus = z.infer<typeof esquemaParaSalvarConfigFocus>
export type DadosRegrasFiscais = z.infer<typeof esquemaRegrasFiscais>
export type DadosManifestar = z.infer<typeof esquemaManifestar>
export type DadosImportarXml = z.infer<typeof esquemaImportarXml>

export const REGRAS_FISCAIS_PADRAO: DadosRegrasFiscais = {
  versaoSchema: 1,
  ativo: true,
  checks: ['ncm', 'origem', 'cst_cfop'],
  observacao:
    'Confere NCM, origem e CST/CFOP (NF × produto). Divergência NCM/origem: importar da NF. CST/CFOP: bloqueia — desconhecimento ou devolução.',
}

/** Remove placeholders legados (ex.: menção a pessoa) da observação fiscal. */
export function sanitizarObservacaoFiscal(observacao?: string | null): string | null {
  if (observacao == null) return null
  const texto = observacao.trim()
  if (!texto) return null
  const mencionaPessoa =
    /preencher\s+com\s+paulo/i.test(texto) ||
    (/\bpaulo\b/i.test(texto) && !/s[aã]o\s+paulo/i.test(texto))
  if (mencionaPessoa || /^preencher\b/i.test(texto)) {
    return REGRAS_FISCAIS_PADRAO.observacao ?? null
  }
  return texto
}

export function sanitizarRegrasFiscais(
  raw: Partial<DadosRegrasFiscais> | null | undefined
): DadosRegrasFiscais {
  if (!raw || typeof raw !== 'object') {
    return { ...REGRAS_FISCAIS_PADRAO }
  }
  const checks = Array.isArray(raw.checks)
    ? raw.checks.filter((c): c is (typeof CHECKS_FISCAIS)[number] =>
        (CHECKS_FISCAIS as readonly string[]).includes(c)
      )
    : [...REGRAS_FISCAIS_PADRAO.checks]
  return {
    versaoSchema: 1,
    ativo: raw.ativo === true,
    checks: checks.length > 0 ? checks : [...REGRAS_FISCAIS_PADRAO.checks],
    observacao: sanitizarObservacaoFiscal(raw.observacao),
  }
}
