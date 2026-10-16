import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { enderecoPersistido, esquemaOrcamento, fretePersistido } from './esquema-orcamentos.js'

vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./repositorio-orcamentos.js', () => ({
  ehUnicidadeNumero: vi.fn(() => false),
  repositorioDeOrcamentos: {
    listar: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    atualizarStatus: vi.fn(),
    proximoNumero: vi.fn(),
    expirarVencidos: vi.fn().mockResolvedValue({ count: 0 }),
    buscarProdutosParaValidacao: vi.fn().mockResolvedValue([]),
    registrarHistorico: vi.fn(),
    aplicarDesconto: vi.fn(),
    copiarItensPedido: vi.fn(),
    finalizar: vi.fn(),
  },
}))

vi.mock('../notificacoes-email/config-notificacoes-email.js', () => ({
  obterConfigNotificacoesEmail: vi.fn(),
}))

vi.mock('../notificacoes-email/cliente-resend.js', () => ({
  enviarEmailResend: vi.fn(),
}))

import { enviarEmailResend } from '../notificacoes-email/cliente-resend.js'
import { obterConfigNotificacoesEmail } from '../notificacoes-email/config-notificacoes-email.js'
import { repositorioDeOrcamentos } from './repositorio-orcamentos.js'
import { servicoDeOrcamentos } from './servico-orcamentos.js'

const ID = '11111111-1111-4111-8111-111111111111'
const EMPRESA = '22222222-2222-4222-8222-222222222222'

function orcamentoBase(parcial: Record<string, unknown> = {}) {
  return {
    id: ID,
    numero: 'ORC-000001',
    data: '2026-09-28',
    validade: '',
    status: 'em_aberto',
    vendedorId: '',
    clienteCodigo: '',
    clienteNome: 'Cliente',
    cnpj: '',
    telefone: '',
    email: '',
    contato: '',
    condicaoPagamento: '',
    prazoEntrega: '',
    frete: '',
    mensagem: '',
    descontoTotal: 0,
    valorFrete: 0,
    outrasDespesas: 0,
    converterEmPedido: false,
    endereco: {
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
    },
    complementares: '',
    observacoes: '',
    itens: [],
    nomeEmpresa: 'Conexão',
    total: 0,
    ...parcial,
  }
}

describe('esquema de orçamento', () => {
  it('não devolve companyId enviado pelo cliente', () => {
    const resultado = esquemaOrcamento.safeParse({
      data: '2026-09-28',
      companyId: EMPRESA,
      clienteNome: 'Cliente',
    })
    expect(resultado.success).toBe(true)
    if (!resultado.success) return
    expect(resultado.data).not.toHaveProperty('companyId')
    expect(resultado.data.status).toBe('em_aberto')
  })

  it('rejeita status fora da lista', () => {
    const resultado = esquemaOrcamento.safeParse({
      data: '2026-09-28',
      status: 'cancelado',
    })
    expect(resultado.success).toBe(false)
  })
})

describe('servico de orçamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fechar pedido devolve orçamento convertido mesmo sem checkbox', async () => {
    vi.mocked(repositorioDeOrcamentos.finalizar).mockResolvedValue(
      orcamentoBase({ status: 'convertido', converterEmPedido: false }) as never
    )

    const resultado = await servicoDeOrcamentos.finalizar(EMPRESA, ID, 'u1')

    expect(resultado.status).toBe('convertido')
    expect(repositorioDeOrcamentos.finalizar).toHaveBeenCalledWith(EMPRESA, ID, 'u1')
    expect(resultado).not.toHaveProperty('nomeEmpresa')
  })

  it('segunda conversão responde 409', async () => {
    vi.mocked(repositorioDeOrcamentos.finalizar).mockResolvedValue({ duplicado: true } as never)

    await expect(servicoDeOrcamentos.finalizar(EMPRESA, ID, 'u1')).rejects.toMatchObject({
      codigoHttp: 409,
      message: 'Este orçamento já foi convertido',
    })
  })

  it('desconto 10 depois 5 substitui e não acumula', async () => {
    vi.mocked(repositorioDeOrcamentos.aplicarDesconto)
      .mockResolvedValueOnce(orcamentoBase({ descontoTotal: 10 }) as never)
      .mockResolvedValueOnce(orcamentoBase({ descontoTotal: 5 }) as never)

    const primeiro = await servicoDeOrcamentos.aplicarDesconto(EMPRESA, ID, 10, null, 'u1')
    const segundo = await servicoDeOrcamentos.aplicarDesconto(EMPRESA, ID, 5, null, 'u1')

    expect(primeiro.descontoTotal).toBe(10)
    expect(segundo.descontoTotal).toBe(5)
    expect(repositorioDeOrcamentos.aplicarDesconto).toHaveBeenNthCalledWith(
      2,
      EMPRESA,
      ID,
      5,
      null,
      'u1'
    )
  })

  it('copiar pedido em orçamento fechado responde 409', async () => {
    vi.mocked(repositorioDeOrcamentos.copiarItensPedido).mockResolvedValue({
      bloqueado: true,
    } as never)

    await expect(
      servicoDeOrcamentos.copiarPedido(EMPRESA, ID, ID, 'u1')
    ).rejects.toMatchObject({ codigoHttp: 409 })
  })

  it('salvar rascunho não rebaixa orçamento convertido', async () => {
    vi.mocked(repositorioDeOrcamentos.buscarPorId).mockResolvedValue(
      orcamentoBase({ status: 'convertido' }) as never
    )

    const dados = esquemaOrcamento.parse({
      data: '2026-09-28',
      numero: 'ORC-000001',
      status: 'em_aberto',
    })
    await expect(servicoDeOrcamentos.atualizar(EMPRESA, ID, dados)).rejects.toMatchObject({
      codigoHttp: 409,
    })
    expect(repositorioDeOrcamentos.atualizar).not.toHaveBeenCalled()
  })

  it('e-mail vazio responde 400 e não chama a Resend', async () => {
    vi.mocked(repositorioDeOrcamentos.buscarPorId).mockResolvedValue(orcamentoBase({ email: '  ' }) as never)

    await expect(servicoDeOrcamentos.enviarEmail(EMPRESA, ID)).rejects.toBeInstanceOf(ErroDaAplicacao)
    await expect(servicoDeOrcamentos.enviarEmail(EMPRESA, ID)).rejects.toMatchObject({
      codigoHttp: 400,
    })
    expect(enviarEmailResend).not.toHaveBeenCalled()
    expect(obterConfigNotificacoesEmail).not.toHaveBeenCalled()
  })

  it('e-mail escapa HTML e não inclui a chave da Resend', async () => {
    vi.mocked(repositorioDeOrcamentos.buscarPorId).mockResolvedValue(
      orcamentoBase({
        email: 'cliente@exemplo.com',
        clienteNome: '<script>alert(1)</script>',
        mensagem: '<b>oi</b>',
      }) as never
    )
    vi.mocked(obterConfigNotificacoesEmail).mockReturnValue({
      apiKey: 're_segredo',
      remetente: 'de@empresa.com',
      urlPortalFornecedor: 'http://localhost:3333',
      emailAvisoInterno: null,
    })
    vi.mocked(enviarEmailResend).mockResolvedValue({ sucesso: true, id: 'email_1' })

    await servicoDeOrcamentos.enviarEmail(EMPRESA, ID)

    expect(enviarEmailResend).toHaveBeenCalledTimes(1)
    const enviado = vi.mocked(enviarEmailResend).mock.calls[0][0]
    expect(enviado.html).toContain('&lt;script&gt;')
    expect(enviado.html).not.toContain('<script>')
    expect(enviado.html).not.toContain('re_segredo')
    expect(enviado.para).toEqual(['cliente@exemplo.com'])
  })

  it('sem configuração da Resend responde 503 e não envia', async () => {
    vi.mocked(repositorioDeOrcamentos.buscarPorId).mockResolvedValue(
      orcamentoBase({ email: 'cliente@exemplo.com' }) as never
    )
    vi.mocked(obterConfigNotificacoesEmail).mockImplementation(() => {
      throw new ErroDaAplicacao('Envio de e-mail não configurado.', 503)
    })

    await expect(servicoDeOrcamentos.enviarEmail(EMPRESA, ID)).rejects.toMatchObject({
      codigoHttp: 503,
    })
    expect(enviarEmailResend).not.toHaveBeenCalled()
  })
})

describe('enderecoPersistido', () => {
  const enderecoPreenchido = {
    cep: '01310-100',
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
  }

  it('zera endereço quando prazoEntrega é no_ato', () => {
    expect(enderecoPersistido('no_ato', enderecoPreenchido)).toEqual({
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
    })
  })

  it('mantém endereço apenas nos tipos que podem entregar', () => {
    expect(enderecoPersistido('entregar', enderecoPreenchido)).toEqual(enderecoPreenchido)
    expect(enderecoPersistido('por_encomenda', enderecoPreenchido)).toEqual(enderecoPreenchido)
    expect(enderecoPersistido('a_retirar', enderecoPreenchido)).toEqual({
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
    })
  })
})

describe('fretePersistido', () => {
  it('zera frete e valor quando prazoEntrega é no_ato', () => {
    expect(fretePersistido('no_ato', 'cif', 25)).toEqual({ frete: '', valorFrete: 0 })
  })

  it('zera frete para No ato e A retirar', () => {
    expect(fretePersistido('a_retirar', 'fob', 10)).toEqual({ frete: '', valorFrete: 0 })
  })

  it('mantém frete nos tipos que permitem entrega', () => {
    expect(fretePersistido('entregar', 'cif', 25)).toEqual({ frete: 'cif', valorFrete: 25 })
    expect(fretePersistido('por_encomenda', 'fob', 10)).toEqual({ frete: 'fob', valorFrete: 10 })
  })
})
