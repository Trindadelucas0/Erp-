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
      titulo: 'Novo documento recebido',
      nomeEmpresa: 'Empresa Compradora Ltda',
      numeroPedido: 42,
      preheader: 'Pré-visualização',
      corpoHtml: '<p>corpo</p>',
    })

    expect(html).toContain('Empresa Compradora Ltda')
    expect(html).toContain('Portal do Fornecedor')
    expect(html).toContain('#42')
    expect(html).toContain('mensagem automática')
  })

  it('monta badge e bloco de credenciais', () => {
    expect(montarBadgeStatus({ tom: 'sucesso', texto: 'Documento aprovado' })).toContain(
      'Documento aprovado'
    )
    expect(
      montarBlocoCredenciais({
        titulo: 'Resumo',
        itens: [{ rotulo: 'Arquivo', valor: 'proposta.pdf' }],
      })
    ).toContain('proposta.pdf')
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

  it('lança erro claro quando RESEND_API_KEY não está configurada', async () => {
    delete process.env.RESEND_API_KEY

    await expect(
      servicoDeNotificacoesEmail.avisarUploadFornecedor({
        numeroPedido: 42,
        fornecedorNome: 'Fornecedor Teste',
        nomeEmpresa: 'Empresa Compradora Ltda',
        nomeArquivo: 'proposta.pdf',
      })
    ).rejects.toThrow('Envio de e-mail não configurado')
  })
})
