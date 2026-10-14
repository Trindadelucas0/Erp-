import { describe, expect, it } from 'vitest'
import {
  ENDERECO_ORCAMENTO_VAZIO,
  montarCorpoOrcamento,
  orcamentoEmBranco,
} from './orcamento-api'
import {
  EXEMPLO_ORCAMENTO,
  aplicarClienteNoOrcamento,
  avisoQuantidadeForaDoMultiplo,
  enderecoEntregaDoCliente,
  entregaNoAto,
  entregaSemFrete,
  entregaSemEndereco,
  modoClienteDoOrcamento,
  opcoesVendedorOrcamento,
  resumirOrcamento,
  somarDiasCivil,
  vendedorIdNovoOrcamento,
} from './orcamento-layout'

describe('resumirOrcamento', () => {
  it('soma o exemplo do print em 743,10', () => {
    const resumo = resumirOrcamento(EXEMPLO_ORCAMENTO)

    expect(resumo.subtotal).toBe(841.49)
    expect(resumo.descontoTotal).toBe(57.15)
    expect(resumo.frete).toBe(0)
    expect(resumo.outrasDespesas).toBe(0)
    expect(resumo.totalSt).toBe(0)
    expect(resumo.total).toBe(784.34)
    expect(resumo.qtdItens).toBe(4)
    expect(resumo.qtdTotal).toBe(9)
  })

  it('soma ST no total sem misturar no líquido', () => {
    const comSt = {
      ...EXEMPLO_ORCAMENTO,
      itens: EXEMPLO_ORCAMENTO.itens.map((item, indice) =>
        indice === 0 ? { ...item, valorSt: 10.5 } : item
      ),
    }
    const resumo = resumirOrcamento(comSt)
    expect(resumo.totalSt).toBe(10.5)
    expect(resumo.descontoTotal).toBe(57.15)
    expect(resumo.total).toBe(794.84)
  })
})

describe('avisoQuantidadeForaDoMultiplo', () => {
  it('alerta quando a quantidade não é múltiplo e a venda não é fracionada', () => {
    expect(
      avisoQuantidadeForaDoMultiplo({
        permiteVendaFracionada: false,
        multiploVenda: 10,
        quantidade: 15,
      })
    ).toBe('Quantidade deve ser múltipla de 10')
  })

  it('não alerta se a venda é fracionada ou a quantidade fecha o múltiplo', () => {
    expect(
      avisoQuantidadeForaDoMultiplo({
        permiteVendaFracionada: true,
        multiploVenda: 10,
        quantidade: 15,
      })
    ).toBeNull()
    expect(
      avisoQuantidadeForaDoMultiplo({
        permiteVendaFracionada: false,
        multiploVenda: 10,
        quantidade: 20,
      })
    ).toBeNull()
  })
})

describe('opcoesVendedorOrcamento', () => {
  it('mantém o vendedor 199 e acrescenta o usuário logado', () => {
    const opcoes = opcoesVendedorOrcamento({ id: 'u-1', name: 'Gustavo Braga' }, '199')
    expect(opcoes).toEqual([
      { value: '199', label: '199 - Edson Feliciano' },
      { value: 'u-1', label: 'Gustavo Braga' },
    ])
  })
})

describe('vendedorIdNovoOrcamento', () => {
  it('pré-seleciona o usuário quando o cargo contém vendedor', () => {
    expect(vendedorIdNovoOrcamento({ id: 'u-1', cargo: 'Vendedor interno' })).toBe('u-1')
    expect(vendedorIdNovoOrcamento({ id: 'u-1', cargo: 'Caixa' })).toBe('')
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

describe('somarDiasCivil', () => {
  it('soma dias na data civil sem deslocar fuso', () => {
    expect(somarDiasCivil('2026-09-16', 14)).toBe('2026-09-30')
  })
})

describe('enderecoEntregaDoCliente', () => {
  it('copia o endereço principal do cadastro', () => {
    expect(
      enderecoEntregaDoCliente({
        nome: 'Cliente',
        cep: '01310100',
        logradouro: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
      })
    ).toEqual({
      cep: '01310-100',
      logradouro: 'Av. Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
    })
  })
})

describe('montarCorpoOrcamento — endereço', () => {
  const enderecoPreenchido = {
    cep: '01310-100',
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
  }

  it('zera endereço quando Tipo de entrega é No ato', () => {
    const orcamento = { ...orcamentoEmBranco(), prazoEntrega: 'no_ato' }
    const corpo = montarCorpoOrcamento(orcamento, enderecoPreenchido, '', '')
    expect(corpo.endereco).toEqual(ENDERECO_ORCAMENTO_VAZIO)
  })

  it('zera frete e valorFrete quando Tipo de entrega é No ato', () => {
    const orcamento = {
      ...orcamentoEmBranco(),
      prazoEntrega: 'no_ato',
      frete: 'cif',
      valorFrete: 25,
    }
    const corpo = montarCorpoOrcamento(orcamento, enderecoPreenchido, '', '')
    expect(corpo.frete).toBe('')
    expect(corpo.valorFrete).toBe(0)
  })

  it('mantém endereço quando Tipo de entrega é Entregar', () => {
    const orcamento = { ...orcamentoEmBranco(), prazoEntrega: 'entregar' }
    const corpo = montarCorpoOrcamento(orcamento, enderecoPreenchido, '', '')
    expect(corpo.endereco).toEqual(enderecoPreenchido)
  })

  it('zera endereço e Frete quando Tipo de entrega é A retirar', () => {
    const orcamento = {
      ...orcamentoEmBranco(),
      prazoEntrega: 'a_retirar',
      frete: 'fob',
      valorFrete: 10,
    }
    const corpo = montarCorpoOrcamento(orcamento, enderecoPreenchido, '', '')
    expect(corpo.endereco).toEqual(ENDERECO_ORCAMENTO_VAZIO)
    expect(corpo.frete).toBe('')
    expect(corpo.valorFrete).toBe(0)
  })

  it('mantém frete quando Tipo de entrega é Entregar', () => {
    const orcamento = {
      ...orcamentoEmBranco(),
      prazoEntrega: 'entregar',
      frete: 'cif',
      valorFrete: 25,
    }
    const corpo = montarCorpoOrcamento(orcamento, enderecoPreenchido, '', '')
    expect(corpo.frete).toBe('cif')
    expect(corpo.valorFrete).toBe(25)
  })
})

describe('entregaNoAto', () => {
  it('reconhece só o tipo No ato', () => {
    expect(entregaNoAto('no_ato')).toBe(true)
    expect(entregaNoAto('a_retirar')).toBe(false)
    expect(entregaNoAto('entregar')).toBe(false)
  })
})

describe('entregaSemEndereco', () => {
  it('reconhece No ato e A retirar, sem incluir Entregar ou Por encomenda', () => {
    expect(entregaSemEndereco('no_ato')).toBe(true)
    expect(entregaSemEndereco('a_retirar')).toBe(true)
    expect(entregaSemEndereco('entregar')).toBe(false)
    expect(entregaSemEndereco('por_encomenda')).toBe(false)
  })
})

describe('entregaSemFrete', () => {
  it('reconhece No ato e A retirar, sem incluir Entregar ou Por encomenda', () => {
    expect(entregaSemFrete('no_ato')).toBe(true)
    expect(entregaSemFrete('a_retirar')).toBe(true)
    expect(entregaSemFrete('entregar')).toBe(false)
    expect(entregaSemFrete('por_encomenda')).toBe(false)
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
