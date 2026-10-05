import { describe, expect, it } from 'vitest'
import { esquemaGravarParametrosBoleto } from './esquema-parametros-boleto.js'

const baseValido = {
  nome: 'Itaú produção',
  ativo: true,
  padrao: false,
  valorMinimo: 10,
  valorMaximo: 100000,
  prazoMedioMaximoDias: 90,
  permitirParcelamento: true,
  quantidadeMaximaParcelas: 12,
  multaAtrasoPercentual: 2,
  jurosAtrasoPercentualDia: 0.033,
  permitirPagamentoAposVencimento: true,
  diasMaximosAposVencimento: 30,
  negativarAutomaticamente: true,
  diasParaNegativar: 10,
  banco: 'itau' as const,
  ambiente: 'producao' as const,
  urlApi: 'https://api.itau.com.br/cobranca/v1',
  clientId: 'id',
  clientSecret: 'secret',
}

describe('esquemaGravarParametrosBoleto', () => {
  it('aceita payload válido', () => {
    const r = esquemaGravarParametrosBoleto.safeParse(baseValido)
    expect(r.success).toBe(true)
  })

  it('recusa valor máximo menor ou igual ao mínimo', () => {
    const r = esquemaGravarParametrosBoleto.safeParse({
      ...baseValido,
      valorMinimo: 100,
      valorMaximo: 50,
    })
    expect(r.success).toBe(false)
  })

  it('recusa URL sem https', () => {
    const r = esquemaGravarParametrosBoleto.safeParse({
      ...baseValido,
      urlApi: 'http://api.itau.com.br',
    })
    expect(r.success).toBe(false)
  })

  it('recusa banco fora da lista', () => {
    const r = esquemaGravarParametrosBoleto.safeParse({
      ...baseValido,
      banco: 'nubank',
    })
    expect(r.success).toBe(false)
  })

  it('recusa nome curto', () => {
    const r = esquemaGravarParametrosBoleto.safeParse({
      ...baseValido,
      nome: 'A',
    })
    expect(r.success).toBe(false)
  })

  it('exige parcelas quando permitir parcelamento', () => {
    const r = esquemaGravarParametrosBoleto.safeParse({
      ...baseValido,
      permitirParcelamento: true,
      quantidadeMaximaParcelas: null,
    })
    expect(r.success).toBe(false)
  })
})
