/**
 * Gera o PDF comercial: PRD + playbook de venda.
 * Fonte de verdade: DOCUMENTACAO-SISTEMA.md (comportamento real do sistema).
 * Não inventa módulo de vendas, emissão de NF-e nem app mobile.
 */
import { createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SAIDA = join(__dirname, '..', 'PRD-COMERCIAL-ERP.pdf')

const FONT_REG = 'C:\\Windows\\Fonts\\segoeui.ttf'
const FONT_BOLD = 'C:\\Windows\\Fonts\\segoeuib.ttf'
const FONT_ITALIC = 'C:\\Windows\\Fonts\\segoeuii.ttf'
const FONT_LIGHT = 'C:\\Windows\\Fonts\\segoeuil.ttf'

const NAVY = '#0F2744'
const NAVY_MID = '#1A3A5C'
const COPPER = '#C45C26'
const CREAM = '#F6F1E8'
const LINE = '#D9D2C5'
const TEXT = '#1C1917'
const MUTED = '#5C564E'
const WHITE = '#FFFFFF'
const GREEN = '#1F6B4A'
const AMBER = '#8A5A12'

const MARGIN_X = 48
const MARGIN_TOP = 56
const MARGIN_BOTTOM = 52

class PrdPdf {
  doc: PDFKit.PDFDocument
  page = 0

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: 'PRD e playbook comercial — ERP de compras, entrada fiscal e estoque',
        Author: 'Produto ERP',
        Subject: 'Documento de produto e orientação de venda',
        Keywords: 'ERP, PRD, compras, entrada de notas, estoque, atacado, distribuição',
        CreationDate: new Date('2026-08-21'),
      },
    })
    this.doc.registerFont('reg', FONT_REG)
    this.doc.registerFont('bold', FONT_BOLD)
    this.doc.registerFont('italic', FONT_ITALIC)
    this.doc.registerFont('light', FONT_LIGHT)
    this.doc.on('pageAdded', () => this.desenharChrome())
  }

  get largura(): number {
    return this.doc.page.width - MARGIN_X * 2
  }

  get y(): number {
    return this.doc.y
  }

  set y(v: number) {
    this.doc.y = v
  }

  maxY(): number {
    return this.doc.page.height - MARGIN_BOTTOM
  }

  desenharChrome(): void {
    this.page += 1
    const { width, height } = this.doc.page
    this.doc.save()
    this.doc.rect(0, 0, width, 8).fill(NAVY)
    this.doc.rect(0, 8, width, 2).fill(COPPER)
    if (this.page > 1) {
      this.doc.font('reg').fontSize(8).fillColor(MUTED)
      this.doc.text(
        'ERP de compras, entrada fiscal e estoque  ·  PRD + playbook comercial',
        MARGIN_X,
        18,
        { width: this.largura * 0.72, lineBreak: false }
      )
      this.doc.font('bold').fillColor(NAVY)
      this.doc.text('Confidencial  ·  ago/2026', MARGIN_X, 18, {
        width: this.largura,
        align: 'right',
        lineBreak: false,
      })
      this.doc.moveTo(MARGIN_X, 36).lineTo(width - MARGIN_X, 36).strokeColor(LINE).lineWidth(0.6).stroke()
      this.doc.rect(0, height - 28, width, 28).fill(NAVY)
      this.doc.font('reg').fontSize(8).fillColor('#D4CBB8')
      this.doc.text('Uso interno de produto e venda  ·  baseado no sistema real', MARGIN_X, height - 18, {
        width: this.largura * 0.7,
        lineBreak: false,
      })
      this.doc.font('bold').fillColor(WHITE)
      this.doc.text(String(this.page), MARGIN_X, height - 18, {
        width: this.largura,
        align: 'right',
        lineBreak: false,
      })
    }
    this.doc.restore()
    this.doc.x = MARGIN_X
    this.doc.y = this.page === 1 ? 0 : MARGIN_TOP
  }

  garantir(altura: number): void {
    if (this.y + altura > this.maxY()) this.doc.addPage()
  }

  h1(texto: string): void {
    this.garantir(48)
    this.doc.save()
    this.doc.rect(MARGIN_X, this.y, 4, 18).fill(COPPER)
    this.doc.restore()
    this.doc.font('bold').fontSize(15).fillColor(NAVY)
    this.doc.text(texto, MARGIN_X + 12, this.y)
    this.doc.moveDown(0.45)
  }

  h2(texto: string): void {
    this.garantir(32)
    this.doc.font('bold').fontSize(11.5).fillColor(NAVY_MID)
    this.doc.text(texto, MARGIN_X, this.y, { width: this.largura })
    this.doc.moveDown(0.25)
  }

  p(texto: string, opts?: { italic?: boolean; size?: number; color?: string }): void {
    this.garantir(28)
    this.doc
      .font(opts?.italic ? 'italic' : 'reg')
      .fontSize(opts?.size ?? 9.6)
      .fillColor(opts?.color ?? TEXT)
    this.doc.text(texto, MARGIN_X, this.y, { width: this.largura, align: 'justify', lineGap: 2.2 })
    this.doc.moveDown(0.35)
  }

  bullets(itens: string[]): void {
    for (const item of itens) {
      this.garantir(20)
      const x = MARGIN_X
      const y = this.y
      this.doc.circle(x + 3.5, y + 6, 1.7).fill(COPPER)
      this.doc.font('reg').fontSize(9.5).fillColor(TEXT)
      this.doc.text(item, x + 14, y, { width: this.largura - 14, lineGap: 1.6 })
      this.doc.moveDown(0.18)
    }
    this.doc.moveDown(0.15)
  }

  callout(titulo: string, corpo: string, tom: 'navy' | 'cream' | 'green' | 'amber' = 'cream'): void {
    const pad = 10
    this.doc.font('reg').fontSize(9.2)
    const hTitulo = this.doc.heightOfString(titulo, { width: this.largura - pad * 2 })
    const hCorpo = this.doc.heightOfString(corpo, { width: this.largura - pad * 2 })
    const h = hTitulo + hCorpo + pad * 2 + 8
    this.garantir(h + 8)
    const y = this.y
    const cores = {
      navy: { bg: NAVY, title: WHITE, body: '#E8E0D4', bar: COPPER },
      cream: { bg: CREAM, title: NAVY, body: TEXT, bar: COPPER },
      green: { bg: '#E8F3EC', title: GREEN, body: TEXT, bar: GREEN },
      amber: { bg: '#F8EEDC', title: AMBER, body: TEXT, bar: COPPER },
    }[tom]
    this.doc.save()
    this.doc.roundedRect(MARGIN_X, y, this.largura, h, 4).fill(cores.bg)
    this.doc.rect(MARGIN_X, y, 4, h).fill(cores.bar)
    this.doc.restore()
    this.doc.font('bold').fontSize(9.2).fillColor(cores.title)
    this.doc.text(titulo, MARGIN_X + pad + 4, y + pad, { width: this.largura - pad * 2 - 4 })
    this.doc.font('reg').fontSize(9).fillColor(cores.body)
    this.doc.text(corpo, MARGIN_X + pad + 4, this.y + 2, { width: this.largura - pad * 2 - 4, lineGap: 1.8 })
    this.doc.y = y + h + 10
  }

  tabela(cabecalho: string[], linhas: string[][], larguras: number[]): void {
    const fs = 8.2
    const padX = 6
    const padY = 5
    const desenharLinha = (celulas: string[], y: number, header: boolean): number => {
      const alturas = celulas.map((c, i) =>
        this.doc
          .font(header ? 'bold' : 'reg')
          .fontSize(fs)
          .heightOfString(c, { width: larguras[i] - padX * 2 })
      )
      const h = Math.max(...alturas) + padY * 2
      if (y + h > this.maxY()) {
        this.doc.addPage()
        y = this.y
        if (!header) y = this.desenharCabecalho(cabecalho, larguras, y, fs, padX, padY)
      }
      this.doc.save()
      if (header) this.doc.rect(MARGIN_X, y, this.largura, h).fill(NAVY)
      this.doc.restore()
      let x = MARGIN_X
      celulas.forEach((c, i) => {
        this.doc
          .font(header ? 'bold' : 'reg')
          .fontSize(fs)
          .fillColor(header ? WHITE : TEXT)
        this.doc.text(c, x + padX, y + padY, { width: larguras[i] - padX * 2 })
        x += larguras[i]
      })
      this.doc
        .moveTo(MARGIN_X, y + h)
        .lineTo(MARGIN_X + this.largura, y + h)
        .strokeColor(LINE)
        .lineWidth(0.4)
        .stroke()
      return y + h
    }
    this.garantir(40)
    let y = this.y
    y = desenharLinha(cabecalho, y, true)
    linhas.forEach((linha) => {
      y = desenharLinha(linha, y, false)
    })
    this.doc.y = y + 10
  }

  private desenharCabecalho(
    cabecalho: string[],
    larguras: number[],
    y: number,
    fs: number,
    padX: number,
    padY: number
  ): number {
    const alturas = cabecalho.map((c, i) =>
      this.doc.font('bold').fontSize(fs).heightOfString(c, { width: larguras[i] - padX * 2 })
    )
    const h = Math.max(...alturas) + padY * 2
    this.doc.save()
    this.doc.rect(MARGIN_X, y, this.largura, h).fill(NAVY)
    this.doc.restore()
    let x = MARGIN_X
    cabecalho.forEach((c, i) => {
      this.doc.font('bold').fontSize(fs).fillColor(WHITE)
      this.doc.text(c, x + padX, y + padY, { width: larguras[i] - padX * 2 })
      x += larguras[i]
    })
    return y + h
  }

  kpi(cards: { rotulo: string; valor: string }[]): void {
    const gap = 8
    const n = cards.length
    const w = (this.largura - gap * (n - 1)) / n
    const h = 52
    this.garantir(h + 12)
    const y = this.y
    cards.forEach((c, i) => {
      const x = MARGIN_X + i * (w + gap)
      this.doc.save()
      this.doc.roundedRect(x, y, w, h, 4).fill(CREAM)
      this.doc.rect(x, y, 3, h).fill(COPPER)
      this.doc.restore()
      this.doc.font('bold').fontSize(9.5).fillColor(NAVY)
      this.doc.text(c.valor, x + 10, y + 10, { width: w - 16 })
      this.doc.font('reg').fontSize(7.6).fillColor(MUTED)
      this.doc.text(c.rotulo, x + 10, y + 30, { width: w - 16 })
    })
    this.doc.y = y + h + 12
  }

  capa(): void {
    this.desenharChrome()
    const { width, height } = this.doc.page
    this.doc.save()
    this.doc.rect(0, 0, width, height).fill(NAVY)
    this.doc.rect(0, 0, 10, height).fill(COPPER)
    this.doc.restore()

    this.doc.font('reg').fontSize(9).fillColor('#D4CBB8')
    this.doc.text('DOCUMENTO DE PRODUTO  ·  AGOSTO 2026', 56, 72)

    this.doc.font('light').fontSize(13).fillColor(COPPER)
    this.doc.text('PRD  +  PLAYBOOK COMERCIAL', 56, 108)

    this.doc.font('bold').fontSize(28).fillColor(WHITE)
    this.doc.text('O que o sistema faz,', 56, 138, { width: width - 112 })
    this.doc.text('como vender', 56, 174, { width: width - 112 })
    this.doc.text('e para quem.', 56, 210, { width: width - 112 })

    this.doc.font('reg').fontSize(12).fillColor('#E8E0D4')
    this.doc.text(
      'ERP web para o ciclo de compras: cadastros, pedido, portal do fornecedor, conferência com IA, entrada fiscal, contagem cega, estoque e títulos a pagar/receber.',
      56,
      268,
      { width: 420, lineGap: 4 }
    )

    const faixas = [
      { t: 'Não é um ERP genérico de tudo.', d: 'É o sistema da operação de compra até o estoque subir certo.' },
      { t: 'Nasceu no atacado.', d: 'Serve a outros comércios que sofrem com nota, conferência e estoque.' },
      { t: 'Venda o que existe hoje.', d: 'Sem prometer emissão de NF-e, pedido de venda ou app de celular.' },
    ]
    faixas.forEach((f, i) => {
      const y = 390 + i * 62
      this.doc.save()
      this.doc.rect(56, y, 4, 46).fill(COPPER)
      this.doc.restore()
      this.doc.font('bold').fontSize(10.5).fillColor(WHITE)
      this.doc.text(f.t, 70, y, { width: 440 })
      this.doc.font('reg').fontSize(9.5).fillColor('#D4CBB8')
      this.doc.text(f.d, 70, y + 18, { width: 440 })
    })

    this.doc.font('reg').fontSize(8).fillColor('#9A9284')
    this.doc.text(
      'Fonte de verdade: comportamento real do sistema (DOCUMENTACAO-SISTEMA.md, v1.0.0, 21/08/2026). Nada neste PDF é roadmap disfarçado de produto.',
      56,
      height - 56,
      { width: width - 112 }
    )
  }
}

function gerarConteudo(pdf: PrdPdf): void {
  const w = () => pdf.largura
  pdf.capa()
  pdf.doc.addPage()

  pdf.h1('1. Posicionamento em uma página')
  pdf.callout(
    'Frase de venda (use esta, não "é um ERP completo")',
    'O sistema organiza a compra do começo ao fim: o pedido sai com regra, o fornecedor responde num portal sem ver preço, a nota fiscal entra conferida, a logística conta às cegas e o estoque só sobe quando a mercadoria bate. O financeiro recebe o título a pagar na consolidação.',
    'navy'
  )
  pdf.kpi([
    { valor: 'Compras + entrada', rotulo: 'Núcleo do produto (não é vendas)' },
    { valor: 'Web, multiempresa', rotulo: 'Várias empresas no mesmo login' },
    { valor: 'SEFAZ automática', rotulo: 'Busca de NF-e / CT-e (Focus)' },
    { valor: 'Contagem cega', rotulo: 'Logística não vê a qtd da nota' },
  ])
  pdf.p(
    'O primeiro cliente de referência é atacado de materiais de construção. O produto, porém, não é "um sistema de loja de material": é um sistema de operação de compras com volume de notas, fornecedores, frete e conferência. Quem tem essa dor — atacado, distribuição, CD de rede, indústria que compra muito — é o mercado.'
  )

  pdf.h2('O que isto NÃO é')
  pdf.bullets([
    'Não emite NF-e de saída e não tem pedido de venda — não substitua o PDV nem o faturamento.',
    'Não é WMS de endereço, picking de pedido de cliente, e-commerce ou gateway de pagamento.',
    'Não tem aplicativo Android/iOS nesta versão (a operação de contagem já é web).',
    'Contas a receber existem, mas o título não nasce sozinho de nota de saída (ainda não há módulo de vendas).',
  ])

  pdf.h1('2. Problema que o produto resolve')
  pdf.p(
    'No comércio que compra de dezenas de fornecedores, o prejuízo não começa na prateleira. Começa no pedido mal conferido, na nota que ninguém bateu com o pedido, no frete sem vencimento, no estoque que "aparece" sem a caixa ter sido contada, e no título a pagar que o financeiro só vê quando o boleto vence.'
  )
  pdf.h2('Dores típicas do comprador, do fiscal e da logística')
  pdf.tabela(
    ['Dor hoje', 'O que acontece no sistema'],
    [
      [
        'Pedido no WhatsApp / planilha, fornecedor vê preço',
        'Portal próprio: itens sem preço nem total; PDF/Excel só com código, produto e quantidade',
      ],
      [
        'Documento do fornecedor diferente do pedido',
        'Upload + conferência com IA em segundo plano; o comprador aprova ou pede ajuste',
      ],
      [
        'Nota some no e-mail / portal SEFAZ',
        'Busca automática na SEFAZ (Focus) + importação de XML; central de notas por etapa',
      ],
      [
        'Frete e CT-e soltos, sem rateio nem vencimento',
        'Gate de frete: CT-e, CFOP, rateio e financeiro com data de vencimento quando o frete é do destinatário',
      ],
      [
        'Conferente "chuta" olhando a quantidade da NF',
        'Contagem cega: bipa ou digita; o sistema compara depois; admin baixa a contagem',
      ],
      [
        'Estoque sobe errado e ninguém explica',
        'Kardex com físico, fiscal e disponível; bloqueio com motivo e foto se divergir',
      ],
      [
        'Título a pagar não nasce da nota',
        'Na consolidação da entrada, gera contas a pagar (mercadoria + frete) com vencimento',
      ],
    ],
    [w() * 0.38, w() * 0.62]
  )

  pdf.h1('3. Visão do produto (PRD)')
  pdf.h2('3.1 Objetivo')
  pdf.p(
    'Dar à empresa um fluxo único e auditável de comprar → conferir documento → receber nota → contar → consolidar estoque → gerar título a pagar, com permissões por pessoa e várias empresas (CNPJs) no mesmo sistema.'
  )
  pdf.h2('3.2 Usuários principais')
  pdf.tabela(
    ['Persona', 'Trabalho no sistema', 'O que considera "pronto"'],
    [
      ['Comprador', 'Pedido, portal, IA, aprovação', 'Pedido aprovado, portal fechado, documento ok'],
      ['Fiscal / cadastro', 'Vínculo de produto, CFOP, NCM, frete', 'Etapas da nota verdes, sem trava'],
      ['Logística', 'Contagem cega no depósito', 'Sessão gravada; OK ou divergência clara'],
      ['Administrativo', 'Baixar contagem, senha, bloqueio', 'Estoque consolidado ou peça bloqueada com motivo'],
      ['Financeiro', 'Contas a pagar e a receber, baixas', 'Título com vencimento, anexo, saldo certo'],
      ['Gestor / admin', 'Usuários, papéis, auditoria, empresas', 'Cada um vê só a tela que precisa'],
      ['Fornecedor (externo)', 'Portal público, sem login do ERP', 'Vê o pedido sem preço e envia o documento'],
      ['Cliente (cadastro)', 'Aprovação + assinatura digital', 'Cadastro ativo após contrato assinado'],
    ],
    [w() * 0.22, w() * 0.38, w() * 0.4]
  )

  pdf.h2('3.3 Princípios de produto (não negociar na venda)')
  pdf.bullets([
    'Regra no servidor: a tela não "libera no jeitinho" o que a API recusa (CFOP, vencimento, senha crítica).',
    'Fail-closed: sem dado obrigatório, não avança etapa — especialmente CFOP de entrada e vencimento de parcela.',
    'Fornecedor nunca entra no ERP interno e nunca vê preço.',
    'IA sugere e aponta divergência; a decisão é sempre da equipe.',
    'Estoque só sobe depois da contagem baixada com sucesso (ou do fluxo administrativo equivalente).',
    'Auditoria e senha nas decisões que mexem em dinheiro, estoque ou aprovação.',
  ])

  pdf.h1('4. O que o sistema faz hoje')
  pdf.p(
    'Capacidades em produção, agrupadas como o comercial deve apresentar — não como lista de telas técnicas.'
  )

  pdf.h2('4.1 Acesso, empresas e segurança')
  pdf.bullets([
    'Login com usuário e senha; sessão de 8 horas; senha armazenada com hash.',
    'Várias empresas no mesmo login; seletor no topo — cadastro e nota vão para a empresa ativa.',
    'Papéis e permissões: cada pessoa só vê as telas liberadas; menu montado sob medida.',
    'Senha do ERP em decisões críticas (aprovar pedido, consolidar, certas liberações).',
    'Auditoria de ações importantes (consulta e exportação para administrador).',
  ])

  pdf.h2('4.2 Cadastros que alimentam a operação')
  pdf.bullets([
    'Empresas do grupo (CNPJs da operação).',
    'Clientes PF/PJ: busca de CNPJ e CEP, fila de aprovação, contrato por assinatura digital (ZapSign), ativação manual.',
    'Fornecedores completos: contato/WhatsApp, banco, tipo (revenda, consumo, serviço), planos financeiros, CFOPs, prazos 1 a 6, frete, regra de rateio, grupo econômico, créditos e pendências.',
    'Produtos: código interno, fotos, se controla estoque, vínculo com cada fornecedor (código original, unidade, múltiplo, embalagem).',
    'Transportadoras: usadas no pedido quando o frete é por conta do comprador (FOB).',
    'Parâmetros: planos financeiros (receita/despesa/resultado), CFOP com sugestão de entrada, unidades, token Focus para busca de notas, assinatura digital.',
  ])

  pdf.h2('4.3 Pedido de compra')
  pdf.bullets([
    'Ciclo: rascunho → enviado → portal ao fornecedor → documentos conferidos → aprovado (somente leitura) ou cancelado.',
    'Herda frete e prazos do fornecedor; FOB exige transportadora; parcelas com data de vencimento; crédito do fornecedor com teto de saldo.',
    'Itens só do vínculo produto × fornecedor; valida múltiplo e embalagem; totais e netos.',
    'Não conclui pedido incompleto. Depois de aprovado, a estrutura não se edita.',
  ])

  pdf.h2('4.4 Portal do fornecedor e conferência com IA')
  pdf.bullets([
    'Comprador envia o acesso (WhatsApp nos telefones marcados no cadastro). Login do fornecedor: CNPJ + número do pedido.',
    'Fornecedor vê itens sem preço e sem total; baixa PDF ou planilha; envia o documento oficial (PDF/Excel/CSV).',
    'Aviso interno por e-mail quando o arquivo chega. Comprador aprova o documento ou solicita ajuste (o fornecedor vê só o motivo, não o relatório interno).',
    'Conferência com IA em segundo plano: extrai o documento, gera relatório de divergências e uma cópia PDF só no painel interno. A IA não altera o pedido sozinha.',
    'Aprovar o pedido exige documento aprovado + senha e fecha o portal.',
  ])

  pdf.h2('4.5 Entrada de notas fiscais')
  pdf.bullets([
    'Central de notas: busca automática na SEFAZ (Focus DistDFe) e importação manual de XML.',
    'Tipos: nota de produto, serviço e conhecimento de frete (CT-e). CT-e automático só grava se o tomador do frete for o CNPJ da empresa.',
    'Pipeline por etapas: cadastro (vínculo NF × produto do sistema) → fiscal (NCM, origem, CFOP de entrada obrigatório em cada item) → negociação com o pedido → frete/CT-e e rateio → lançamento.',
    'Travas reais: sem CFOP de entrada não avança (nem com senha). Frete do destinatário exige CT-e, rateio, valor e financeiro com vencimento.',
    'Manifestação do destinatário. Visualização da DANFE. Liberação responsável só em pontos previstos (ex.: NCM/origem, negociação) — nunca no CFOP.',
    'NFe 55 com produto fica em "Aguardando chegada" após o lançamento; conferência de preço/nome se o unitário variar 30% ou mais ou o nome divergir.',
    'Painel Entradas consolidadas e tela Auditoria de entradas (dossiê: veredito, esperado × contado, itens bloqueados, anexos).',
  ])

  pdf.h2('4.6 Contagem cega e estoque')
  pdf.bullets([
    'Logística lista entradas liberadas, inicia sessão, bipa unidade ou caixa master (ou digita se não bipar). Não vê a quantidade da nota.',
    'Se bate: contagem OK. Se diverge: avisa o item sem entregar a quantidade da NF. Reconta ou deixa pendente para o administrativo.',
    'Admin baixa a contagem. OK consolida estoque com senha. Divergência trava a logística; pode bloquear a peça no estoque com explicação e foto.',
    'Kardex por produto e período: três visões — disponível, físico e fiscal. Grade de movimentações (quem, quando, custo, parceiro). Ajuste de inventário no físico, com observação obrigatória.',
    'Peça bloqueada aparece no kardex com motivo; não circula no disponível até desbloquear.',
  ])

  pdf.h2('4.7 Financeiro de títulos')
  pdf.bullets([
    'Contas a pagar: cadastro manual (duplicata ou tributos) ou geração automática na consolidação da entrada (duplicatas da NF + frete). Vencimento obrigatório. Anexos (boleto/comprovante). Baixas totais ou parciais com juros/multa. Histórico de pagamentos.',
    'Contas a receber: cadastro manual (duplicata ou crédito), cliente, plano, vencimento, comissão informativa, anexos, baixas e histórico de recebimentos. Nesta versão o título a receber não nasce de nota de saída.',
  ])

  pdf.h2('4.8 Utilitários do dia a dia')
  pdf.bullets([
    'Busca por palavras: todas as palavras precisam aparecer, em qualquer campo de texto (trecho, sem exigir frase exata).',
    'Exportação CSV nas listagens principais.',
    'Preenchimento automático de CNPJ (razão, endereço, CNAE quando a consulta responder) e CEP.',
  ])

  pdf.h1('5. Fluxo que a demo deve mostrar (ponta a ponta)')
  pdf.callout(
    'Roteiro de 12 minutos (não pular a contagem)',
    'Quem compra software de "entrada" já viu tela bonita. O que fecha negócio é ver a trava: pedido incompleto não conclui, fornecedor sem preço, nota sem CFOP não avança, conferente sem quantidade da NF, estoque que só sobe depois da baixa.',
    'amber'
  )
  pdf.tabela(
    ['Min', 'Cena', 'O que o cliente precisa sentir'],
    [
      ['0–1', 'Login + troca de empresa', 'Multiempresa de verdade, não planilha com abas'],
      ['1–3', 'Fornecedor e produto vinculados', 'A compra não começa no pedido; começa no cadastro certo'],
      ['3–5', 'Pedido + Enviar ao fornecedor', 'WhatsApp e portal; preço protegido'],
      ['5–6', 'Portal (aba anônima)', 'Fornecedor não entra no ERP'],
      ['6–7', 'Conferir com IA', 'Relatório; humano decide'],
      ['7–9', 'Entrada de notas: BUSCAR + etapas', 'SEFAZ entra sozinha; gates visíveis'],
      ['9–11', 'Contagem cega + baixar', 'Depósito conta; admin consolida'],
      ['11–12', 'Kardex + contas a pagar', 'Estoque e título nasceram da mesma operação'],
    ],
    [w() * 0.1, w() * 0.38, w() * 0.52]
  )

  pdf.h1('6. Requisitos de produto (resumo executivo)')
  pdf.h2('6.1 Funcionais — deve fazer (já faz)')
  pdf.bullets([
    'Isolar dados por empresa ativa; recusar operação sem empresa.',
    'Impedir avanço de etapa fiscal sem CFOP de entrada em cada item da NF-e 55.',
    'Impedir salvar parcela financeira sem data de vencimento (1 ou N parcelas).',
    'Não gravar CT-e automático se o tomador não for o CNPJ da empresa.',
    'Não exibir preço no portal, no PDF e no Excel do fornecedor.',
    'Não marcar etapa de frete destinatário como ok sem financeiro com vencimento.',
    'Registrar movimento de estoque na consolidação da entrada (físico + fiscal) para produto que controla estoque.',
  ])
  pdf.h2('6.2 Fora de escopo desta versão (não vender)')
  pdf.tabela(
    ['Capacidade', 'Status honesto', 'Como responder na reunião'],
    [
      [
        'Pedido de venda / PDV / orçamento de cliente',
        'Não existe',
        'Hoje o produto é a operação de compra. Vendas é fase seguinte, contratada à parte.',
      ],
      [
        'Emissão de NF-e / NFC-e',
        'Não existe',
        'A nota de entrada vem da SEFAZ. Saída não está no produto.',
      ],
      [
        'App Android de contagem',
        'Roadmap, não produto',
        'A contagem cega já roda no navegador do depósito.',
      ],
      [
        'DDA / boleto registrado automático',
        'Não existe',
        'Anexa o boleto no título e baixa manualmente.',
      ],
      [
        'WMS (endereço, picking, transferência)',
        'Não existe',
        'Kardex e inventário; não é armazém endereçado.',
      ],
      [
        'NF de devolução e crédito auto na divergência',
        'Não existe',
        'Divergência bloqueia estoque; acerto comercial é processo da equipe.',
      ],
      ['Gateway de pagamento / e-commerce', 'Não existe', 'Fora do posicionamento.'],
      [
        'Título a receber gerado pela NF de saída',
        'Não existe',
        'Contas a receber é cadastro manual nesta fase.',
      ],
    ],
    [w() * 0.3, w() * 0.18, w() * 0.52]
  )

  pdf.h1('7. Como vender')
  pdf.h2('7.1 Comprador ideal (ICP)')
  pdf.p(
    'Empresa que compra com nota fiscal recorrente, tem estoque físico, sofre com conferência e precisa de rastreio — em geral 15 a 200 usuários de operação, 1 ou mais CNPJs, depósito próprio. O champion interno costuma ser o responsável de compras, o fiscal de entrada ou o sócio que "não confia no estoque".'
  )
  pdf.callout(
    'Sinal verde na primeira ligação',
    '"A nota chega e ninguém sabe se bate com o pedido."  ·  "O fornecedor manda PDF e a gente confere no olho."  ·  "O estoque do sistema nunca é o da prateleira."  ·  "O financeiro só vê o boleto quando vence."  ·  "Temos dois, três CNPJs e planilha diferente em cada um."',
    'green'
  )
  pdf.callout(
    'Sinal vermelho — não forçar o ciclo',
    'Quer só emitir nota de venda na semana que vem.  ·  É PDV de balcão sem depósito.  ·  Precisa de lote/validade/ANVISA no dia 1.  ·  Quer WMS com picking por endereço agora.  ·  Não tem CNPJ/Focus/certificado e espera "magia fiscal" sem cadastro.  ·  Quer o fornecedor vendo preço no portal.',
    'amber'
  )

  pdf.h2('7.2 Pitch de 60 segundos')
  pdf.p(
    '"Vocês compram de muitos fornecedores e a nota entra bagunçada: o pedido é um, o PDF é outro, o conferente olha a quantidade da NF, o estoque sobe errado e o boleto aparece tarde. Este sistema fecha esse ciclo. O pedido vai para um portal em que o fornecedor não vê preço. A nota é buscada na SEFAZ e só avança com cadastro, CFOP e frete certos. A logística conta sem ver a quantidade. O estoque sobe na consolidação e o contas a pagar nasce junto. Não é um SAP. É a operação de compra, do pedido ao título, com trava de verdade."',
    { italic: true }
  )

  pdf.h2('7.3 Argumentos por interlocutor')
  pdf.tabela(
    ['Quem está na sala', 'O que dói nele', 'O que mostrar'],
    [
      ['Sócio / diretor', 'Estoque mentiroso, dinheiro parado, fraude de conferência', 'Kardex + bloqueio + auditoria + senha crítica'],
      ['Compras', 'Retrabalho, preço vazando, documento errado', 'Portal sem preço + IA + ajuste ao fornecedor'],
      ['Fiscal', 'CFOP, NCM, CT-e, manifesto', 'Pipeline da entrada + trava de CFOP + Focus'],
      ['Logística', 'Contar rápido sem colar da nota', 'Contagem cega, caixa master, histórico de quem contou'],
      ['Financeiro', 'Vencimento, boleto, baixa', 'Título gerado na consolidação + anexos + baixas'],
      ['TI', 'Mais um sistema isolado, permissão, backup', 'Web, API própria, JWT, papéis, PostgreSQL, multiempresa'],
    ],
    [w() * 0.22, w() * 0.38, w() * 0.4]
  )

  pdf.h2('7.4 Oferta comercial sugerida (estrutura, sem preço inventado)')
  pdf.p(
    'Não coloque valor neste PDF até o comercial fechar tabela. Use três camadas claras para o cliente entender o que está comprando:'
  )
  pdf.bullets([
    'Implantação: empresas, usuários, planos, CFOPs, token Focus, carga de produtos/fornecedores, treinamento das quatro pontas (compras, fiscal, depósito, financeiro). Sem implantação, o produto não "liga".',
    'Uso contínuo: sistema web em produção, busca SEFAZ, portal, IA de conferência (custo de API de IA à parte ou incluso com teto), suporte.',
    'Escopo explícito no contrato: o que está incluso (ciclo de entrada) e o que não está (vendas, emissão de NF-e, app, WMS). Isso evita o maior risco de venda: expectativa de ERP total.',
  ])
  pdf.p(
    'Modelo de cobrança possível (escolher um e ser consistente): mensalidade por empresa (CNPJ) + usuários excedentes; ou faixa por volume de notas/mês. Implantação à parte, em marco (cadastros ok / primeira nota consolidada / equipe treinada).'
  )

  pdf.h2('7.5 Objeções frequentes')
  pdf.tabela(
    ['Objeção', 'Resposta curta'],
    [
      [
        '"Já tenho um ERP."',
        'A maioria emite nota e não fecha a entrada. Pergunte: o conferente vê a qtd da NF? O fornecedor vê preço? O título nasce da consolidação?',
      ],
      [
        '"Preciso vender e emitir NF."',
        'Hoje não fazemos isso. Se a dor n. 1 for faturamento, não somos a compra certa agora. Se a dor n. 1 for entrada e estoque, somos.',
      ],
      [
        '"A IA vai errar."',
        'A IA não grava o pedido. Ela aponta divergência. Quem aprova é o comprador, com senha.',
      ],
      [
        '"Meu depósito não tem coletor."',
        'Contagem é web: bipa com leitor HID ou digita. Não depende de app na loja.',
      ],
      [
        '"E se o Focus cair?"',
        'Dá para importar XML na mão. A busca automática é o caminho feliz, não o único.',
      ],
      [
        '"Vai prender minha operação."',
        'As travas são as que o fiscal e o estoque já deveriam ter. Liberação por senha existe só onde a regra permite — CFOP e vencimento não liberam.',
      ],
      [
        '"Quanto tempo para implantar?"',
        'Depende da qualidade do cadastro (produto × fornecedor). Com base boa, o ciclo de uma nota dá para demonstrar na primeira semana; operação plena segue a disciplina do cadastro, não o software.',
      ],
    ],
    [w() * 0.32, w() * 0.68]
  )

  pdf.h1('8. Para quem vender — além do atacadista')
  pdf.p(
    'O atacado de materiais de construção é o caso de uso original (muitos SKUs, muitos fornecedores, NF-e 55, CT-e, palete/caixa, conferência). O produto serve a qualquer comércio cuja margem depende de comprar certo e receber certo — não de emitir cupom no caixa.'
  )

  pdf.h2('8.1 Matriz de adequação')
  pdf.tabela(
    ['Segmento', 'Fit', 'Por quê', 'Como abordar'],
    [
      [
        'Atacadista (construção, elétrico, hidráulico, ferragens, tintas)',
        'Alto',
        'Volume de NF, múltiplo/embalagem, frete, depósito',
        'Caso de referência. Demo completa.',
      ],
      [
        'Distribuidora B2B (autopeças, EPI, embalagem, químico não controlado, HVAC)',
        'Alto',
        'Mesmo desenho: pedido + portal + entrada + estoque',
        'Trocar o vocabulário (SKU, caixa) e manter o fluxo.',
      ],
      [
        'Atacarejo / cash & carry com CD',
        'Alto',
        'Compra pesada e conferência; várias lojas = várias empresas',
        'Vender multiempresa + contagem + kardex. PDV deles continua fora.',
      ],
      [
        'Rede de lojas com centro de distribuição (home center, material de construção varejo)',
        'Alto',
        'A dor está no CD, não no caixa da loja',
        'Começar pelo CD. Não mexer no PDV na v1.',
      ],
      [
        'Indústria leve / transformação que compra muito insumo',
        'Alto',
        'Entrada fiscal + estoque físico/fiscal; pouco "varejo"',
        'Enfatizar CFOP, kardex fiscal e contas a pagar. MRP não existe.',
      ],
      [
        'MRO / manutenção industrial (compras de peças)',
        'Médio-alto',
        'Muitos fornecedores e NFs; estoque crítico',
        'Portal + IA + entrada. Sem ordem de serviço neste produto.',
      ],
      [
        'Cooperativa ou central de compras',
        'Médio-alto',
        'Pedido para muitos associados/fornecedores, preço confidencial',
        'Portal sem preço é o gancho. Confirmar se o estoque é central ou só o pedido.',
      ],
      [
        'Importadora / trading que nacionaliza e revende',
        'Médio',
        'Entrada e estoque sim; DI/aduana não estão no produto',
        'Vender o trecho nacional (NF-e, CT-e, depósito). Não vender desembaraço.',
      ],
      [
        'E-commerce com estoque próprio (sem marketplace como sistema único)',
        'Médio',
        'Inbound e kardex servem; checkout e NF de saída não',
        'Só se já tiverem ferramenta de venda. Senão, recusar ou fase 2.',
      ],
      [
        'Varejo de bairro / mercearia / PDV puro',
        'Baixo',
        'A dor é frente de caixa, não pipeline de entrada',
        'Não priorizar. Produto grande demais e incompleto para eles.',
      ],
      [
        'Farmácia, frigorífico, químico controlado, agronegócio com lote/validade',
        'Baixo hoje',
        'Exigem lote, validade, receita, rastreio sanitário — não há no produto',
        'Só se aceitarem operar sem lote (raro). Em geral, não vender.',
      ],
      [
        'Prestador de serviço sem estoque (oficina, agência, consultório)',
        'Baixo',
        'Pouco SKU, pouca NF de mercadoria',
        'Cadastro de clientes + assinatura não justificam o produto inteiro.',
      ],
    ],
    [w() * 0.26, w() * 0.12, w() * 0.32, w() * 0.3]
  )

  pdf.h2('8.2 Três mensagens por tipo de comércio')
  pdf.p(
    'Atacado / distribuição: "Seu lucro está no recebimento. A gente impede nota errada, preço vazado e estoque inventado."'
  )
  pdf.p(
    'Rede com CD: "A loja continua no sistema que já fatura. O CD passa a contar às cegas, e o estoque do grupo deixa de ser uma planilha por filial."'
  )
  pdf.p(
    'Indústria que compra insumo: "Cada NF de entrada com CFOP certo, frete rateado e título com vencimento. O chão de fábrica para de discutir com o fiscal no WhatsApp."'
  )

  pdf.h2('8.3 Onde o produto é forte mesmo fora do atacado')
  pdf.bullets([
    'Grupo econômico de fornecedores (NF de um CNPJ casa com pedido de outro do mesmo grupo).',
    'Preço confidencial no portal — relevante para distribuidor que não quer o fornecedor (ou um terceiro) vendo tabela.',
    'Multiempresa — redes, holdings, filial com CNPJ próprio.',
    'Frete destinatário com CT-e, rateio e vencimento — comum em atacado e indústria, raro em ERP de varejo barato.',
    'Contagem cega — qualquer depósito que hoje "confere olhando a DANFE".',
    'Trava fiscal de CFOP — diferencia de sistemas que "deixam lançar e o contador arruma depois".',
  ])

  pdf.h1('9. Concorrência (como se posicionar)')
  pdf.p(
    'Não dispute com SAP, TOTVS ou Bling no slogan "ERP completo". Dispute no ciclo que eles costumam deixar furado: pedido ↔ fornecedor ↔ NF ↔ contagem ↔ estoque ↔ título.'
  )
  pdf.tabela(
    ['Tipo de concorrente', 'O que ele faz bem', 'Nossa cunha'],
    [
      [
        'ERP grande (TOTVS, SAP, Senior)',
        'Finanças, fiscal de saída, folha',
        'Entrada operacional com portal, IA e contagem cega, mais barato de implantar neste recorte',
      ],
      [
        'ERP de varejo / PDV (Bling, Tiny, linx de loja)',
        'Venda e NF-e',
        'Eles são fracos em conferência de depósito e portal sem preço. Nós não somos o caixa.',
      ],
      [
        'Planilha + e-mail + portal SEFAZ',
        'Custo zero aparente',
        'Custo real: erro de estoque, pagamento atrasado, preço vazado, hora de gente boa conferindo PDF',
      ],
      [
        'WMS puro',
        'Endereço e picking',
        'WMS não faz pedido, SEFAZ, CFOP nem contas a pagar. Somos a porta de entrada; WMS seria depois, se precisar',
      ],
    ],
    [w() * 0.28, w() * 0.28, w() * 0.44]
  )

  pdf.h1('10. Critérios de sucesso do cliente (pós-venda)')
  pdf.p('Uma implantação "vendida certa" se mede em 30–60 dias com fatos, não com go-live de tela:')
  pdf.bullets([
    'Pedidos novos saem pelo sistema, não por planilha paralela.',
    'Fornecedor usa o portal (ou o comprador anexa o documento) e o preço não aparece para ele.',
    'Notas do DistDFe aparecem na central sem alguém baixar XML um a um.',
    'Nenhuma NF-e 55 avança sem CFOP de entrada.',
    'Pelo menos um turno de depósito faz contagem cega de verdade.',
    'Título a pagar da mercadoria aparece após consolidar, com vencimento.',
    'Kardex da peça conferida mostra a entrada — e, se divergiu, mostra o bloqueio com motivo.',
  ])

  pdf.h1('11. Riscos de uma venda mal recortada')
  pdf.bullets([
    'Prometer "ERP completo" gera cancelamento quando o vendedor pedir orçamento de saída.',
    'Implantar sem vínculo produto × fornecedor faz a aba Cadastro da nota virar inferno — o cliente culpa o software.',
    'Ligar Focus sem o CNPJ/token certos gera "não busca nota" no primeiro dia.',
    'Treinar só o escritório e não o depósito: a contagem cega morre e o estoque volta a ser chute.',
    'Vender para farmácia/alimento perecível sem lote: problema sanitário, não de tela.',
  ])

  pdf.h1('12. Próximo passo recomendado ao comercial')
  pdf.callout(
    'Pacote mínimo para sair vendendo esta semana',
    '1) Usar este PDF como leave-behind após a demo.  2) Gravar a demo de 12 minutos do capítulo 5.  3) Fechar tabela de implantação + mensalidade (fora deste documento).  4) Lista de 20 contas: atacado, distribuição e CD de rede — não varejo de balcão.  5) No contrato, anexar o capítulo 6.2 (fora de escopo) para não vender o que não existe.',
    'navy'
  )
  pdf.p(
    'Este documento descreve o produto de 21/08/2026. Se o sistema ganhar vendas, emissão de NF-e ou app, o playbook precisa ser reescrito — não "esticado" na conversa.'
  )
  pdf.p('Fim do documento.', { italic: true, color: MUTED })
}

async function main(): Promise<void> {
  const pdf = new PrdPdf()
  const stream = createWriteStream(SAIDA)
  const pronto = new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
  pdf.doc.pipe(stream)
  gerarConteudo(pdf)
  pdf.doc.end()
  await pronto
  console.log(`PDF gerado: ${SAIDA}`)
}

await main()
