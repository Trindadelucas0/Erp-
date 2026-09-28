import { describe, expect, it } from 'vitest'
import {
  EXEMPLO_ORCAMENTO,
  aplicarClienteNoOrcamento,
  modoClienteDoOrcamento,
  resumirOrcamento,
} from './orcamento-layout'

describe('resumirOrcamento', () => {
  it('soma o exemplo do print em 743,10', () => {
    const resumo = resumirOrcamento(EXEMPLO_ORCAMENTO)

    expect(resumo.subtotal).toBe(784.34)
    expect(resumo.descontoTotal).toBe(41.24)
    expect(resumo.frete).toBe(0)
    expect(resumo.outrasDespesas).toBe(0)
    expect(resumo.total).toBe(743.1)
    expect(resumo.qtdItens).toBe(4)
    expect(resumo.qtdTotal).toBe(9)
  })
})

describe('modoClienteDoOrcamento', () => {
  it('trata código vazio como digitação manual', () => {
    expect(modoClienteDoOrcamento('')).toBe('digitar')
    expect(modoClienteDoOrcamento('   ')).toBe('digitar')
  })

  it('trata código preenchido como busca', () => {
    expect(modoClienteDoOrcamento('11.838')).toBe('buscar')
  })
})

describe('aplicarClienteNoOrcamento', () => {
  it('copia o CNPJ da pessoa jurídica para o código e para o documento', () => {
    const dados = aplicarClienteNoOrcamento({
      tipo: 'PJ',
      nome: 'B&F COMERCIO',
      cnpj: '12345678000190',
      telefone: '6134013340',
      email: 'contato@bef.com.br',
    })

    expect(dados.clienteCodigo).toBe('12.345.678/0001-90')
    expect(dados.cnpj).toBe('12.345.678/0001-90')
    expect(dados.clienteNome).toBe('B&F COMERCIO')
    expect(dados.telefone).toBe('(61) 3401-3340')
    expect(dados.email).toBe('contato@bef.com.br')
    expect(dados.contato).toBe('')
  })

  it('copia o CPF da pessoa física e deixa o contato vazio', () => {
    const dados = aplicarClienteNoOrcamento({
      tipo: 'PF',
      nome: 'João Silva',
      cpf: '12345678909',
      email: 'joao@email.com',
    })

    expect(dados.clienteCodigo).toBe('123.456.789-09')
    expect(dados.cnpj).toBe('123.456.789-09')
    expect(dados.clienteNome).toBe('João Silva')
    expect(dados.telefone).toBe('')
    expect(dados.contato).toBe('')
  })
})
