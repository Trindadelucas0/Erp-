import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { servicoDeNotificacoesEmail } from './servico-notificacoes-email.js'

const ENV_ORIGINAL = { ...process.env }

function configurarEnvValido() {
  process.env.RESEND_API_KEY = 're_teste_123'
  process.env.RESEND_FROM = 'onboarding@resend.dev'
  process.env.PORTAL_FORNECEDOR_URL = 'http://localhost:3333'
  process.env.RESEND_AVISO_PARA = 'compras@empresa.com'
}

describe('servicoDeNotificacoesEmail', () => {
  beforeEach(() => {
    configurarEnvValido()
  })

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('envia credenciais do portal e retorna sucesso quando a Resend responde 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await servicoDeNotificacoesEmail.enviarCredenciaisPortal({
      emailFornecedor: 'fornecedor@teste.com',
      fornecedorNome: 'Fornecedor Teste',
      nomeEmpresa: 'Empresa Compradora Ltda',
      cnpj: '12345678000199',
      numeroPedido: 42,
    })

    expect(resultado.sucesso).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    const corpo = JSON.parse(init.body as string)
    expect(corpo.to).toEqual(['fornecedor@teste.com'])
    expect(corpo.subject).toContain('42')
    expect(corpo.html).toContain('42')
    expect(corpo.html).toContain('Empresa Compradora Ltda')
  })

  it('retorna sucesso=false com a mensagem da Resend quando a API responde erro', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: 'chave inválida' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await servicoDeNotificacoesEmail.enviarCredenciaisPortal({
      emailFornecedor: 'fornecedor@teste.com',
      fornecedorNome: 'Fornecedor Teste',
      nomeEmpresa: 'Empresa Compradora Ltda',
      cnpj: '12345678000199',
      numeroPedido: 42,
    })

    expect(resultado.sucesso).toBe(false)
    expect(resultado.mensagem).toBe('chave inválida')
  })

  it('lança erro claro quando RESEND_API_KEY não está configurada', async () => {
    delete process.env.RESEND_API_KEY

    await expect(
      servicoDeNotificacoesEmail.enviarCredenciaisPortal({
        emailFornecedor: 'fornecedor@teste.com',
        fornecedorNome: 'Fornecedor Teste',
        nomeEmpresa: 'Empresa Compradora Ltda',
        cnpj: '12345678000199',
        numeroPedido: 42,
      })
    ).rejects.toThrow('Envio de e-mail não configurado')
  })

  it('avisa upload interno usando RESEND_AVISO_PARA como destinatário', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email_456' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await servicoDeNotificacoesEmail.avisarUploadFornecedor({
      numeroPedido: 42,
      fornecedorNome: 'Fornecedor Teste',
      nomeEmpresa: 'Empresa Compradora Ltda',
      nomeArquivo: 'proposta.pdf',
    })

    expect(resultado.sucesso).toBe(true)
    const [, init] = fetchMock.mock.calls[0]
    const corpo = JSON.parse(init.body as string)
    expect(corpo.to).toEqual(['compras@empresa.com'])
    expect(corpo.html).toContain('proposta.pdf')
    expect(corpo.html).toContain('Empresa Compradora Ltda')
  })

  it('retorna sucesso=false quando RESEND_AVISO_PARA não está configurado', async () => {
    delete process.env.RESEND_AVISO_PARA
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await servicoDeNotificacoesEmail.avisarUploadFornecedor({
      numeroPedido: 42,
      fornecedorNome: 'Fornecedor Teste',
      nomeEmpresa: 'Empresa Compradora Ltda',
      nomeArquivo: 'proposta.pdf',
    })

    expect(resultado.sucesso).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('avisa o fornecedor que o documento foi aprovado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email_789' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await servicoDeNotificacoesEmail.avisarDocumentoAprovado({
      emailFornecedor: 'fornecedor@teste.com',
      fornecedorNome: 'Fornecedor Teste',
      nomeEmpresa: 'Empresa Compradora Ltda',
      numeroPedido: 42,
    })

    expect(resultado.sucesso).toBe(true)
    const [, init] = fetchMock.mock.calls[0]
    const corpo = JSON.parse(init.body as string)
    expect(corpo.to).toEqual(['fornecedor@teste.com'])
    expect(corpo.subject).toContain('aprovado')
  })

  it('avisa o fornecedor sobre o ajuste necessário com o motivo informado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email_999' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await servicoDeNotificacoesEmail.avisarAjusteNecessario({
      emailFornecedor: 'fornecedor@teste.com',
      fornecedorNome: 'Fornecedor Teste',
      nomeEmpresa: 'Empresa Compradora Ltda',
      numeroPedido: 42,
      motivo: 'Quantidade do item 3 divergente do pedido',
    })

    expect(resultado.sucesso).toBe(true)
    const [, init] = fetchMock.mock.calls[0]
    const corpo = JSON.parse(init.body as string)
    expect(corpo.to).toEqual(['fornecedor@teste.com'])
    expect(corpo.html).toContain('Quantidade do item 3 divergente do pedido')
  })
})
