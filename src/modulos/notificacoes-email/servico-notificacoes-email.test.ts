import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { servicoDeNotificacoesEmail } from './servico-notificacoes-email.js'
import {
  escaparHtml,
  montarBadgeStatus,
  montarBlocoCredenciais,
  montarLayoutEmailCorporativo,
} from './template-email-corporativo.js'

const ENV_ORIGINAL = { ...process.env }

function configurarEnvValido() {
  process.env.RESEND_API_KEY = 're_teste_123'
  process.env.RESEND_FROM = 'onboarding@resend.dev'
  process.env.PORTAL_FORNECEDOR_URL = 'http://localhost:3333'
  process.env.RESEND_AVISO_PARA = 'compras@empresa.com'
}

describe('template-email-corporativo', () => {
  it('monta layout com portal, pedido e rodapé corporativo', () => {
    const html = montarLayoutEmailCorporativo({
      titulo: 'Acesso ao portal liberado',
      nomeEmpresa: 'Empresa Compradora Ltda',
      numeroPedido: 42,
      preheader: 'Pré-visualização',
      corpoHtml: '<p>corpo</p>',
    })

    expect(html).toContain('Empresa Compradora Ltda')
    expect(html).toContain('Portal do Fornecedor')
    expect(html).toContain('#42')
    expect(html).toContain('Acesso ao portal liberado')
    expect(html).toContain('mensagem automática')
  })

  it('monta badge e bloco de credenciais', () => {
    expect(montarBadgeStatus({ tom: 'sucesso', texto: 'Documento aprovado' })).toContain(
      'Documento aprovado'
    )
    expect(
      montarBlocoCredenciais({
        titulo: 'Dados de acesso',
        itens: [{ rotulo: 'CNPJ', valor: '12.345.678/0001-99' }],
      })
    ).toContain('12.345.678/0001-99')
  })

  it('escapa HTML em valores dinâmicos', () => {
    expect(escaparHtml(`<script>alert("x")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    )
  })
})

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
    expect(corpo.html).toContain('Portal do Fornecedor')
    expect(corpo.html).toContain('Acesso liberado')
    expect(corpo.html).toContain('http://localhost:3333/portal-fornecedor/login')
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
    expect(corpo.html).toContain('Ação necessária')
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
    expect(corpo.html).toContain('Documento aprovado')
    expect(corpo.html).toContain('Sem ação necessária')
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
    expect(corpo.html).toContain('Ajuste necessário')
    expect(corpo.html).toContain('Motivo do ajuste')
    expect(corpo.html).toContain('http://localhost:3333/portal-fornecedor/login')
  })

  it('escapa HTML perigoso no motivo do ajuste', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email_esc' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await servicoDeNotificacoesEmail.avisarAjusteNecessario({
      emailFornecedor: 'fornecedor@teste.com',
      fornecedorNome: 'Fornecedor <Teste>',
      nomeEmpresa: 'Empresa & Cia',
      numeroPedido: 42,
      motivo: 'Erro <b>crítico</b>',
    })

    const [, init] = fetchMock.mock.calls[0]
    const corpo = JSON.parse(init.body as string)
    expect(corpo.html).toContain('Erro &lt;b&gt;crítico&lt;/b&gt;')
    expect(corpo.html).toContain('Fornecedor &lt;Teste&gt;')
    expect(corpo.html).toContain('Empresa &amp; Cia')
    expect(corpo.html).not.toContain('Erro <b>crítico</b>')
  })
})
