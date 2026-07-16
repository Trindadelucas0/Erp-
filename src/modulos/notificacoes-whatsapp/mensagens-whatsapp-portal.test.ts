import { describe, expect, it } from 'vitest'
import {
  listarTelefonesParaWhatsapp,
  montarResultadoAvisoWhatsapp,
  montarTextoCredenciaisPortal,
  montarUrlWhatsapp,
  normalizarTelefoneWhatsapp,
} from './mensagens-whatsapp-portal.js'

describe('notificacoes-whatsapp', () => {
  it('normaliza telefone brasileiro com DDD e aceita 8+ dígitos', () => {
    expect(normalizarTelefoneWhatsapp('(11) 98888-7777')).toBe('5511988887777')
    expect(normalizarTelefoneWhatsapp('11988887777')).toBe('5511988887777')
    expect(normalizarTelefoneWhatsapp('5511988887777')).toBe('5511988887777')
    expect(normalizarTelefoneWhatsapp('33334444')).toBe('5533334444')
    expect(normalizarTelefoneWhatsapp('abc')).toBeNull()
    expect(normalizarTelefoneWhatsapp('123')).toBeNull()
  })

  it('monta URL wa.me no número do fornecedor', () => {
    const url = montarUrlWhatsapp({ telefone: '11988887777', texto: 'Olá pedido #1' })
    expect(url).toBe(`https://wa.me/5511988887777?text=${encodeURIComponent('Olá pedido #1')}`)
  })

  it('recusa montar URL sem telefone válido', () => {
    expect(() => montarUrlWhatsapp({ telefone: '', texto: 'Mensagem' })).toThrow(
      'Telefone do fornecedor inválido'
    )
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

  it('resultado do aviso usa só o telefone marcado como WhatsApp', () => {
    const resultado = montarResultadoAvisoWhatsapp({
      contatos: [
        { id: '1', valor: '1133334444', whatsapp: false, principal: true },
        { id: '2', valor: '11999998888', whatsapp: true, principal: false },
      ],
      textoWhatsapp: 'texto',
      mensagemSemTelefone: 'Cadastre o telefone do fornecedor para enviar pelo WhatsApp.',
    })
    expect(resultado.avisoWhatsappDisponivel).toBe(true)
    expect(resultado.telefonesWhatsapp).toHaveLength(1)
    expect(resultado.telefonesWhatsapp[0].valor).toBe('5511999998888')
    expect(resultado.telefonesWhatsapp[0].whatsapp).toBe(true)
  })

  it('sem telefone marcado WhatsApp mantém todos os válidos', () => {
    const resultado = montarResultadoAvisoWhatsapp({
      contatos: [
        { id: '1', valor: '1133334444', whatsapp: false, principal: true },
        { id: '2', valor: '11988887777', whatsapp: false, principal: false },
      ],
      textoWhatsapp: 'texto',
      mensagemSemTelefone: 'Cadastre o telefone do fornecedor para enviar pelo WhatsApp.',
    })
    expect(resultado.telefonesWhatsapp).toHaveLength(2)
  })

  it('sem telefone não libera WhatsApp', () => {
    const resultado = montarResultadoAvisoWhatsapp({
      contatos: [],
      textoWhatsapp: 'texto',
      mensagemSemTelefone: 'Cadastre o telefone do fornecedor para enviar pelo WhatsApp.',
    })
    expect(resultado.avisoWhatsappDisponivel).toBe(false)
    expect(resultado.telefonesWhatsapp).toHaveLength(0)
    expect(resultado.mensagemAviso).toContain('Cadastre o telefone')
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
