import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { enderecoPersistido, esquemaOrcamento, fretePersistido } from './esquema-orcamentos.js'

vi.mock('./repositorio-orcamentos.js', () => ({
  ehUnicidadeNumero: vi.fn(() => false),
  repositorioDeOrcamentos: {
    listar: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    atualizarStatus: vi.fn(),
    proximoNumero: vi.fn(),
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
    status: 'em_elaboracao',
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
    expect(resultado.data.status).toBe('em_elaboracao')
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

  it('finalizar grava status enviado', async () => {
    vi.mocked(repositorioDeOrcamentos.buscarPorId).mockResolvedValue(orcamentoBase() as never)
    vi.mocked(repositorioDeOrcamentos.atualizarStatus).mockImplementation(
      async (_empresa, _id, status) => orcamentoBase({ status }) as never
    )

    const resultado = await servicoDeOrcamentos.finalizar(EMPRESA, ID)

    expect(resultado.status).toBe('enviado')
    expect(repositorioDeOrcamentos.atualizarStatus).toHaveBeenCalledWith(EMPRESA, ID, 'enviado')
    expect(resultado).not.toHaveProperty('nomeEmpresa')
  })

  it('salvar rascunho não rebaixa orçamento já enviado', async () => {
    vi.mocked(repositorioDeOrcamentos.buscarPorId).mockResolvedValue(
      orcamentoBase({ status: 'enviado' }) as never
    )
    vi.mocked(repositorioDeOrcamentos.atualizar).mockImplementation(
      async (_empresa, _id, _dados, _numero, status) => orcamentoBase({ status }) as never
    )

    const dados = esquemaOrcamento.parse({
      data: '2026-09-28',
      numero: 'ORC-000001',
      status: 'em_elaboracao',
    })
    const resultado = await servicoDeOrcamentos.atualizar(EMPRESA, ID, dados)

    expect(resultado.status).toBe('enviado')
    expect(repositorioDeOrcamentos.atualizar).toHaveBeenCalledWith(
      EMPRESA,
      ID,
      dados,
      'ORC-000001',
      'enviado'
    )
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

  it('mantém endereço nos demais tipos de entrega', () => {
    expect(enderecoPersistido('entregar', enderecoPreenchido)).toEqual(enderecoPreenchido)
    expect(enderecoPersistido('a_retirar', enderecoPreenchido)).toEqual(enderecoPreenchido)
  })
})

describe('fretePersistido', () => {
  it('zera frete e valor quando prazoEntrega é no_ato', () => {
    expect(fretePersistido('no_ato', 'cif', 25)).toEqual({ frete: '', valorFrete: 0 })
  })

  it('mantém frete nos demais tipos de entrega', () => {
    expect(fretePersistido('entregar', 'cif', 25)).toEqual({ frete: 'cif', valorFrete: 25 })
    expect(fretePersistido('a_retirar', 'fob', 10)).toEqual({ frete: 'fob', valorFrete: 10 })
  })
})
