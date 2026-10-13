import { describe, it, expect } from 'vitest'
import {
  esquemaDeCriacaoDeFornecedor,
  esquemaDeDadosBancarioItem,
  esquemaDeEdicaoDeFornecedor,
} from './esquema-fornecedores.js'

describe('Dados bancários do fornecedor', () => {
  it('exige dígito em conta preenchida', () => {
    const resultado = esquemaDeDadosBancarioItem.safeParse({
      banco: '001 - BCO DO BRASIL S.A.',
      agencia: '1234',
      conta: '98765',
    })
    expect(resultado.success).toBe(false)
  })

  it('aceita e normaliza o dígito da conta', () => {
    const resultado = esquemaDeDadosBancarioItem.safeParse({
      banco: '001 - BCO DO BRASIL S.A.',
      agencia: '1234',
      conta: '98765',
      digitoConta: 'x',
    })
    expect(resultado.success).toBe(true)
    if (resultado.success) expect(resultado.data.digitoConta).toBe('X')
  })
})

describe('Esquema de fornecedores — prestador de serviço', () => {
  const basePF = {
    tipo: 'PF' as const,
    cpf: '12345678901',
    nome: 'João Silva',
  }

  const basePJ = {
    tipo: 'PJ' as const,
    cnpj: '11222333000181', // CNPJ válido de teste
    nome: 'Empresa LTDA',
  }

  it('prestador exclusivo salva sem frete e com flags false', () => {
    const resultado = esquemaDeCriacaoDeFornecedor.safeParse({
      ...basePJ,
      tipoRevenda: false,
      tipoConsumo: false,
      tipoPrestadorServico: true,
      modalidadeTransportePadrao: 'FOB_NOTA',
      regraRateioFrete: 'valor',
      permitirVinculoManual: true,
      exigirItensEntrada: true,
      email: 'teste@example.com',
      telefone: '11999999999',
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
    })

    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.modalidadeTransportePadrao).toBeUndefined()
      expect(resultado.data.regraRateioFrete).toBeUndefined()
      expect(resultado.data.permitirVinculoManual).toBe(false)
      expect(resultado.data.exigirItensEntrada).toBe(false)
    }
  })

  it('prestador + revenda sem frete recusa', () => {
    const resultado = esquemaDeCriacaoDeFornecedor.safeParse({
      ...basePJ,
      tipoRevenda: true,
      tipoConsumo: false,
      tipoPrestadorServico: true,
      modalidadeTransportePadrao: undefined,
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      const erro = resultado.error.issues.find((i) => i.path.includes('modalidadeTransportePadrao'))
      expect(erro).toBeDefined()
      expect(erro?.message).toContain('Tipo de frete')
    }
  })

  it('revenda sem frete recusa', () => {
    const resultado = esquemaDeCriacaoDeFornecedor.safeParse({
      ...basePJ,
      tipoRevenda: true,
      tipoConsumo: false,
      tipoPrestadorServico: false,
      modalidadeTransportePadrao: undefined,
    })

    expect(resultado.success).toBe(false)
  })

  it('FOB sem rateio recusa', () => {
    const resultado = esquemaDeCriacaoDeFornecedor.safeParse({
      ...basePJ,
      tipoRevenda: true,
      tipoConsumo: false,
      tipoPrestadorServico: false,
      modalidadeTransportePadrao: 'FOB_NOTA',
      regraRateioFrete: undefined,
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      const erro = resultado.error.issues.find((i) => i.path.includes('regraRateioFrete'))
      expect(erro).toBeDefined()
      expect(erro?.message).toContain('rateio')
    }
  })

  it('consumo com prestador salva com frete obrigatório', () => {
    const resultado = esquemaDeCriacaoDeFornecedor.safeParse({
      ...basePJ,
      tipoRevenda: false,
      tipoConsumo: true,
      tipoPrestadorServico: true,
      modalidadeTransportePadrao: undefined,
    })

    expect(resultado.success).toBe(false)
  })

  it('consumo com frete CIF salva sem rateio', () => {
    const resultado = esquemaDeCriacaoDeFornecedor.safeParse({
      ...basePJ,
      tipoRevenda: false,
      tipoConsumo: true,
      tipoPrestadorServico: false,
      modalidadeTransportePadrao: 'CIF',
      regraRateioFrete: 'valor',
      email: 'teste@example.com',
      telefone: '11999999999',
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
    })

    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.regraRateioFrete).toBeUndefined()
    }
  })

  it('edição — só prestador limpa frete mesmo se viesse preenchido', () => {
    const resultado = esquemaDeEdicaoDeFornecedor.safeParse({
      ...basePJ,
      tipoRevenda: false,
      tipoConsumo: false,
      tipoPrestadorServico: true,
      modalidadeTransportePadrao: 'FOB_CONHECIMENTO',
      regraRateioFrete: 'peso',
      email: 'teste@example.com',
      telefone: '11999999999',
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
    })

    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.modalidadeTransportePadrao).toBeUndefined()
      expect(resultado.data.regraRateioFrete).toBeUndefined()
    }
  })
})
