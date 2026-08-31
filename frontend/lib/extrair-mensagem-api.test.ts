import { describe, expect, it } from 'vitest'
import { extrairMensagemApi } from './extrair-mensagem-api'

function erroAxios(status: number, data?: unknown) {
  return { response: { status, data } }
}

describe('extrairMensagemApi', () => {
  it('devolve a mensagem da Focus em 502 com corpo { mensagem }', () => {
    const msg =
      'Inconsistência com a Focus ao baixar o PDF: Focus NFe não respondeu em 20s'
    expect(extrairMensagemApi(erroAxios(502, { mensagem: msg }), 'Falha ao baixar PDF.')).toBe(
      msg
    )
  })

  it('em 502 sem corpo usa o padrão do PDF e não cita ZapSign', () => {
    const padrao = 'Não foi possível baixar o PDF.'
    const texto = extrairMensagemApi(erroAxios(502), padrao)
    expect(texto).toBe(padrao)
    expect(texto.toLowerCase()).not.toContain('zapsign')
  })

  it('em 502 sem corpo e sem padrão usa serviço indisponível genérico', () => {
    const texto = extrairMensagemApi(erroAxios(503), '')
    expect(texto).toBe('Serviço indisponível. Tente novamente em instantes.')
    expect(texto.toLowerCase()).not.toContain('zapsign')
  })

  it('em 502 com Blob ainda não parseado usa o padrão (não ZapSign)', () => {
    const blob = new Blob(['Bad Gateway'], { type: 'text/html' })
    const padrao = 'Falha ao baixar PDF.'
    const texto = extrairMensagemApi(erroAxios(502, blob), padrao)
    expect(texto).toBe(padrao)
    expect(texto.toLowerCase()).not.toContain('zapsign')
  })
})
