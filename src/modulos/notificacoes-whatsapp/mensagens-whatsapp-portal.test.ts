import { describe, expect, it } from 'vitest'
import {
  listarTelefonesParaWhatsapp,
  montarResultadoAvisoWhatsapp,
  montarTextoCredenciaisPortal,
  montarUrlWhatsapp,
  normalizarTelefoneWhatsapp,
} from './mensagens-whatsapp-portal.js'

describe('notificacoes-whatsapp', () => {
  it('normaliza telefone brasileiro com DDD', () => {
    expect(normalizarTelefoneWhatsapp('(11) 98888-7777')).toBe('5511988887777')
    expect(normalizarTelefoneWhatsapp('11988887777')).toBe('5511988887777')
    expect(normalizarTelefoneWhatsapp('5511988887777')).toBe('5511988887777')
    expect(normalizarTelefoneWhatsapp('abc')).toBeNull()
  })

  it('monta URL wa.me com texto codificado', () => {
    const url = montarUrlWhatsapp({ telefone: '11988887777', texto: 'Olá pedido #1' })
    expect(url).toBe(`https://wa.me/5511988887777?text=${encodeURIComponent('Olá pedido #1')}`)
  })

  it('lista telefones priorizando whatsapp e principal', () => {
    const lista = listarTelefonesParaWhatsapp([
      { id: '1', valor: '1133334444', whatsapp: false, principal: true },
      { id: '2', valor: '11999998888', whatsapp: true, principal: false },
      { id: '3', valor: '11 99999-8888', whatsapp: false, principal: false },
    ])
    expect(lista).toHaveLength(2)
    expect(lista[0].valor).toBe('5511999998888')
    expect(lista[0].whatsapp).toBe(true)
  })

  it('monta resultado sem telefone com aviso', () => {
    const resultado = montarResultadoAvisoWhatsapp({
      contatos: [],
      textoWhatsapp: 'texto',
      mensagemSemTelefone: 'Sem telefone',
    })
    expect(resultado.avisoWhatsappDisponivel).toBe(false)
    expect(resultado.mensagemAviso).toBe('Sem telefone')
  })

  it('monta texto de credenciais com número do pedido', () => {
    process.env.PORTAL_FORNECEDOR_URL = 'http://localhost:3333'
    const texto = montarTextoCredenciaisPortal({
      fornecedorNome: 'Fornecedor X',
      nomeEmpresa: 'Empresa Y',
      cnpj: '12345678000199',
      numeroPedido: 42,
    })
    expect(texto).toContain('pedido #42')
    expect(texto).toContain('12.345.678/0001-99')
    expect(texto).toContain('/portal-fornecedor/login')
  })
})
