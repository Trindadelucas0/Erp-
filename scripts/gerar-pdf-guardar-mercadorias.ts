/**
 * Manual em PDF: atribuir e guardar mercadorias.
 * Desenha só as 4 telas reais do ERP. Não inventa botão nem campo.
 */
import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PASTA = join(__dirname, '..', 'manuais')
const SAIDA = join(PASTA, 'guardar-mercadorias-passo-a-passo.pdf')

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
const BG = '#F7F5F2'
const CARD = '#FFFFFF'
const PRIMARY = '#1A3A5C'
const DESTRUCTIVE = '#9B2C2C'

const MARGIN_X = 42
const MARGIN_TOP = 52
const MARGIN_BOTTOM = 48
const SIDEBAR_W = 92

const MENU_LOGISTICA = [
  'Contagens de entrada',
  'Estoque',
  'Endereços WMS',
  'Requisições',
  'Guardar mercadorias',
] as const

type MenuAtivo = 'Requisições' | 'Guardar mercadorias'

class ManualPdf {
  doc: PDFKit.PDFDocument
  page = 0

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: 'Guardar mercadorias — passo a passo',
        Author: 'ERP',
        Subject: 'Como atribuir a requisição e guardar cada produto depois da entrada',
        Keywords: 'guardar mercadorias, requisições, armazém, entrada',
        CreationDate: new Date('2026-09-21'),
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
      this.doc.text('ERP  ·  Guardar mercadorias — passo a passo', MARGIN_X, 18, {
        width: this.largura * 0.72,
        lineBreak: false,
      })
      this.doc.font('bold').fillColor(NAVY)
      this.doc.text('Conexão Atacadista  ·  set/2026', MARGIN_X, 18, {
        width: this.largura,
        align: 'right',
        lineBreak: false,
      })
      this.doc.moveTo(MARGIN_X, 36).lineTo(width - MARGIN_X, 36).strokeColor(LINE).lineWidth(0.6).stroke()
      this.doc.rect(0, height - 28, width, 28).fill(NAVY)
      this.doc.font('reg').fontSize(8).fillColor('#D4CBB8')
      this.doc.text('Telas reais do sistema  ·  sem botão Aceitar', MARGIN_X, height - 18, {
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
    this.garantir(40)
    this.doc.save()
    this.doc.rect(MARGIN_X, this.y, 4, 16).fill(COPPER)
    this.doc.restore()
    this.doc.font('bold').fontSize(13.5).fillColor(NAVY)
    this.doc.text(texto, MARGIN_X + 12, this.y, { width: this.largura - 12 })
    this.doc.moveDown(0.4)
  }

  h2(texto: string): void {
    this.garantir(26)
    this.doc.font('bold').fontSize(11).fillColor(NAVY_MID)
    this.doc.text(texto, MARGIN_X, this.y, { width: this.largura })
    this.doc.moveDown(0.22)
  }

  p(texto: string, opts?: { italic?: boolean; size?: number; color?: string }): void {
    this.garantir(22)
    this.doc
      .font(opts?.italic ? 'italic' : 'reg')
      .fontSize(opts?.size ?? 9.5)
      .fillColor(opts?.color ?? TEXT)
    this.doc.text(texto, MARGIN_X, this.y, { width: this.largura, align: 'justify', lineGap: 2 })
    this.doc.moveDown(0.32)
  }

  bullets(itens: string[]): void {
    for (const item of itens) {
      this.garantir(18)
      const x = MARGIN_X
      const y = this.y
      this.doc.circle(x + 3.5, y + 6, 1.7).fill(COPPER)
      this.doc.font('reg').fontSize(9.4).fillColor(TEXT)
      this.doc.text(item, x + 14, y, { width: this.largura - 14, lineGap: 1.5 })
      this.doc.moveDown(0.16)
    }
    this.doc.moveDown(0.12)
  }

  passos(itens: string[]): void {
    itens.forEach((item, i) => {
      this.garantir(20)
      const x = MARGIN_X
      const y = this.y
      this.doc.save()
      this.doc.circle(x + 7, y + 6.5, 7).fill(COPPER)
      this.doc.restore()
      this.doc.font('bold').fontSize(8).fillColor(WHITE)
      this.doc.text(String(i + 1), x, y + 2.2, { width: 14, align: 'center' })
      this.doc.font('reg').fontSize(9.4).fillColor(TEXT)
      this.doc.text(item, x + 20, y, { width: this.largura - 20, lineGap: 1.5 })
      this.doc.moveDown(0.2)
    })
    this.doc.moveDown(0.12)
  }

  callout(titulo: string, corpo: string, tom: 'navy' | 'cream' | 'green' | 'amber' = 'cream'): void {
    const pad = 10
    this.doc.font('reg').fontSize(9)
    const hTitulo = this.doc.heightOfString(titulo, { width: this.largura - pad * 2 - 8 })
    const hCorpo = this.doc.heightOfString(corpo, { width: this.largura - pad * 2 - 8 })
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
    this.doc.text(corpo, MARGIN_X + pad + 4, this.y + 2, {
      width: this.largura - pad * 2 - 4,
      lineGap: 1.7,
    })
    this.doc.y = y + h + 10
  }

  caption(texto: string): void {
    this.doc.font('italic').fontSize(8).fillColor(MUTED)
    this.doc.text(texto, MARGIN_X, this.y, { width: this.largura })
    this.doc.moveDown(0.45)
  }

  capa(): void {
    this.desenharChrome()
    const { width, height } = this.doc.page
    this.doc.save()
    this.doc.rect(0, 0, width, height).fill(NAVY)
    this.doc.rect(0, 0, 10, height).fill(COPPER)
    this.doc.restore()

    this.doc.font('reg').fontSize(9).fillColor('#D4CBB8')
    this.doc.text('MANUAL DO OPERADOR  ·  SETEMBRO 2026', 56, 72)

    this.doc.font('light').fontSize(12).fillColor(COPPER)
    this.doc.text('CONEXÃO ATACADISTA  ·  ERP', 56, 108)

    this.doc.font('bold').fontSize(26).fillColor(WHITE)
    this.doc.text('Guardar mercadorias', 56, 140, { width: width - 112 })
    this.doc.font('bold').fontSize(22).fillColor(WHITE)
    this.doc.text('passo a passo', 56, 176, { width: width - 112 })

    this.doc.font('reg').fontSize(12).fillColor('#E8E0D4')
    this.doc.text(
      'Como atribuir a tarefa a um usuário e guardar cada produto no endereço depois de consolidar a nota de revenda.',
      56,
      230,
      { width: 430, lineGap: 4 }
    )

    const faixas = [
      {
        t: 'Uma requisição por produto.',
        d: 'Se a nota tem 2 produtos, nascem requisição 1 e requisição 2. Não é erro.',
      },
      {
        t: 'Não existe botão Aceitar.',
        d: 'Atribuir define quem faz. Guardar começa o trabalho.',
      },
      {
        t: 'Se interromper, continua de onde parou.',
        d: 'Terminou o produto 1? O produto 2 espera na fila.',
      },
    ]
    faixas.forEach((f, i) => {
      const y = 360 + i * 64
      this.doc.save()
      this.doc.rect(56, y, 4, 48).fill(COPPER)
      this.doc.restore()
      this.doc.font('bold').fontSize(11).fillColor(WHITE)
      this.doc.text(f.t, 70, y, { width: 440 })
      this.doc.font('reg').fontSize(9.5).fillColor('#D4CBB8')
      this.doc.text(f.d, 70, y + 18, { width: 440 })
    })

    this.doc.font('reg').fontSize(8).fillColor('#9A9284')
    this.doc.text(
      'Desenho das telas iguais ao sistema (Logística → Requisições e Logística → Guardar mercadorias). Nada inventado.',
      56,
      height - 56,
      { width: width - 112 }
    )
  }

  botao(x: number, y: number, w: number, h: number, rotulo: string, estilo: 'primario' | 'outline' | 'destaque' | 'apagado' = 'outline'): void {
    const cores = {
      primario: { bg: PRIMARY, fg: WHITE, stroke: PRIMARY },
      outline: { bg: WHITE, fg: TEXT, stroke: LINE },
      destaque: { bg: COPPER, fg: WHITE, stroke: COPPER },
      apagado: { bg: '#EEEAE4', fg: MUTED, stroke: LINE },
    }[estilo]
    this.doc.save()
    this.doc.roundedRect(x, y, w, h, 3).fillAndStroke(cores.bg, cores.stroke)
    this.doc.restore()
    this.doc.font('bold').fontSize(6.4).fillColor(cores.fg)
    this.doc.text(rotulo, x, y + (h - 8) / 2, { width: w, align: 'center' })
  }

  campo(x: number, y: number, w: number, rotulo: string, valor: string): number {
    this.doc.font('reg').fontSize(5.8).fillColor(MUTED)
    this.doc.text(rotulo, x, y, { width: w })
    this.doc.save()
    this.doc.roundedRect(x, y + 9, w, 14, 2).lineWidth(0.6).stroke(LINE)
    this.doc.restore()
    this.doc.font('reg').fontSize(6.2).fillColor(TEXT)
    this.doc.text(valor, x + 4, y + 12, { width: w - 8 })
    return 26
  }

  badge(x: number, y: number, rotulo: string, tom: 'navy' | 'line' | 'ok' | 'warn' | 'erro' = 'line'): number {
    const cores = {
      navy: { fg: WHITE, bg: NAVY, stroke: NAVY },
      line: { fg: TEXT, bg: WHITE, stroke: LINE },
      ok: { fg: GREEN, bg: WHITE, stroke: GREEN },
      warn: { fg: AMBER, bg: WHITE, stroke: AMBER },
      erro: { fg: DESTRUCTIVE, bg: WHITE, stroke: DESTRUCTIVE },
    }[tom]
    const w = Math.max(42, rotulo.length * 4.1 + 10)
    this.doc.save()
    this.doc.roundedRect(x, y, w, 12, 2).lineWidth(1.1).fillAndStroke(cores.bg, cores.stroke)
    this.doc.restore()
    this.doc.font('bold').fontSize(5.8).fillColor(cores.fg)
    this.doc.text(rotulo, x, y + 2.4, { width: w, align: 'center' })
    return w
  }

  shell(opts: { altura: number; menuAtivo: MenuAtivo; tituloJanela?: string }): {
    cx: number
    cy: number
    cw: number
  } {
    const w = this.largura
    const h = opts.altura
    this.garantir(h + 18)
    const x = MARGIN_X
    const y = this.y

    this.doc.save()
    this.doc.roundedRect(x, y, w, h, 5).fillAndStroke(BG, LINE)
    this.doc.rect(x, y, SIDEBAR_W, h).fill(NAVY)
    this.doc.restore()

    this.doc.font('bold').fontSize(7).fillColor(WHITE)
    this.doc.text('ERP', x + 8, y + 8, { width: SIDEBAR_W - 12 })
    this.doc.font('bold').fontSize(6).fillColor(COPPER)
    this.doc.text('Logística', x + 8, y + 24, { width: SIDEBAR_W - 12 })

    MENU_LOGISTICA.forEach((item, i) => {
      const iy = y + 38 + i * 16
      const ativo = item === opts.menuAtivo
      if (ativo) {
        this.doc.save()
        this.doc.roundedRect(x + 4, iy - 3, SIDEBAR_W - 8, 14, 2).fill(COPPER)
        this.doc.restore()
      }
      this.doc.font(ativo ? 'bold' : 'reg').fontSize(5.6).fillColor(ativo ? WHITE : '#D4CBB8')
      this.doc.text(item, x + 8, iy, { width: SIDEBAR_W - 14 })
    })

    const cx = x + SIDEBAR_W + 8
    const cy = y + 8
    const cw = w - SIDEBAR_W - 16
    this.doc.save()
    this.doc.rect(x + SIDEBAR_W, y, w - SIDEBAR_W, 18).fill(WHITE)
    this.doc.moveTo(x + SIDEBAR_W, y + 18).lineTo(x + w, y + 18).strokeColor(LINE).lineWidth(0.5).stroke()
    this.doc.restore()
    this.doc.font('reg').fontSize(6).fillColor(MUTED)
    this.doc.text(opts.tituloJanela ?? 'Empresa ativa', cx, y + 6, { width: cw })

    return { cx, cy: cy + 14, cw }
  }

  tabelaMini(
    x: number,
    y: number,
    w: number,
    colunas: { rotulo: string; largura: number }[],
    linhas: string[][],
    destaqueCol?: number
  ): number {
    const hHead = 14
    const hRow = 18
    this.doc.save()
    this.doc.rect(x, y, w, hHead).fill('#EEF1F4')
    this.doc.restore()
    let cx = x
    colunas.forEach((c) => {
      this.doc.font('bold').fontSize(5.4).fillColor(MUTED)
      this.doc.text(c.rotulo, cx + 3, y + 3.5, { width: c.largura - 6 })
      cx += c.largura
    })
    linhas.forEach((linha, ri) => {
      const ry = y + hHead + ri * hRow
      this.doc
        .moveTo(x, ry + hRow)
        .lineTo(x + w, ry + hRow)
        .strokeColor(LINE)
        .lineWidth(0.4)
        .stroke()
      let lx = x
      linha.forEach((cel, ci) => {
        const destaque = ci === destaqueCol
        this.doc.font(destaque ? 'bold' : 'reg').fontSize(5.6).fillColor(destaque ? COPPER : TEXT)
        this.doc.text(cel, lx + 3, ry + 4, { width: colunas[ci]!.largura - 6 })
        lx += colunas[ci]!.largura
      })
    })
    return hHead + linhas.length * hRow
  }

  cardUi(x: number, y: number, w: number, h: number, titulo: string, descricao?: string): number {
    this.doc.save()
    this.doc.roundedRect(x, y, w, h, 4).fillAndStroke(CARD, LINE)
    this.doc.restore()
    this.doc.font('bold').fontSize(7.2).fillColor(NAVY)
    this.doc.text(titulo, x + 8, y + 6, { width: w - 16 })
    if (descricao) {
      this.doc.font('reg').fontSize(5.6).fillColor(MUTED)
      this.doc.text(descricao, x + 8, y + 16, { width: w - 16 })
      return 28
    }
    return 20
  }

  telaListaRequisicoes(): void {
    const h = 248
    const { cx, cy, cw } = this.shell({ altura: h, menuAtivo: 'Requisições' })
    const y0 = this.y

    this.doc.font('bold').fontSize(10).fillColor(NAVY)
    this.doc.text('Requisições', cx, cy)
    this.botao(cx + cw - 72, cy - 2, 72, 14, 'Nova requisição', 'primario')
    this.doc.font('reg').fontSize(5.5).fillColor(MUTED)
    this.doc.text(
      'Ordens do armazém — Separação reserva e baixa o kardex; reposição não muda o total da empresa.',
      cx,
      cy + 14,
      { width: cw - 80 }
    )

    const cards = [
      ['Total', '2'],
      ['Pendente', '0'],
      ['Disponível', '2'],
      ['Em execução', '0'],
      ['Pausadas', '0'],
      ['Concluídas', '0'],
    ]
    const gap = 4
    const cwCard = (cw - gap * 5) / 6
    cards.forEach((c, i) => {
      const bx = cx + i * (cwCard + gap)
      const by = cy + 30
      this.doc.save()
      this.doc.roundedRect(bx, by, cwCard, 28, 3).fillAndStroke(CARD, LINE)
      this.doc.restore()
      this.doc.font('reg').fontSize(5.2).fillColor(MUTED)
      this.doc.text(c[0]!, bx + 4, by + 4, { width: cwCard - 8 })
      this.doc.font('bold').fontSize(9).fillColor(NAVY)
      this.doc.text(c[1]!, bx + 4, by + 13, { width: cwCard - 8 })
    })

    const filaY = cy + 64
    const filaH = h - (filaY - y0) - 10
    const inner = this.cardUi(
      cx,
      filaY,
      cw,
      filaH,
      'Fila',
      'Prioridade crítica primeiro. Minha fila = atribuídas a você ou disponíveis sem dono.'
    )
    const fx = cx + 8
    let fy = filaY + inner
    const innerW = cw - 16
    this.campo(fx, fy, 96, 'Busca', 'Número, produto, endereço…')
    this.campo(fx + 100, fy, 48, 'Tipo', 'Todos')
    this.campo(fx + 152, fy, 48, 'Status', 'Todos')
    this.campo(fx + 204, fy, 52, 'Prioridade', 'Todas')
    this.botao(fx + 262, fy + 9, 48, 14, 'Minha fila', 'outline')
    this.botao(fx + 314, fy + 9, 68, 14, 'Todas da empresa', 'primario')

    const cols = [
      { rotulo: 'Nº', largura: 50 },
      { rotulo: 'Prioridade', largura: 48 },
      { rotulo: 'Tipo', largura: 78 },
      { rotulo: 'NF', largura: 56 },
      { rotulo: 'Origem → Destino', largura: 68 },
      { rotulo: 'Qtd', largura: 22 },
      { rotulo: 'Responsável', largura: 32 },
      { rotulo: 'Status', largura: innerW - 50 - 48 - 78 - 56 - 68 - 22 - 32 },
    ]
    this.tabelaMini(
      fx,
      fy + 30,
      innerW,
      cols,
      [
        ['REQ-00001', '3 — Normal', 'Guardar mercadorias', 'NF 123 série 1', '— → A-RC-20-01-2-05', '10', '—', 'Disponível'],
        ['REQ-00002', '3 — Normal', 'Guardar mercadorias', 'NF 123 série 1', '— → A-RC-20-01-2-08', '4', '—', 'Disponível'],
      ],
      0
    )

    this.y = y0 + h + 6
    this.caption('Tela real: Logística → Requisições. Clique no Nº (REQ-00001) para abrir a ficha.')
  }

  telaFicha(): void {
    const h = 358
    const { cx, cy, cw } = this.shell({ altura: h, menuAtivo: 'Requisições' })
    const y0 = this.y

    this.doc.font('reg').fontSize(6).fillColor(MUTED)
    this.doc.text('Requisições  >', cx, cy)
    this.doc.font('bold').fontSize(10).fillColor(NAVY)
    this.doc.text('REQ-00001', cx + 58, cy - 2)
    this.badge(cx + cw - 118, cy - 1, '3 — Normal', 'navy')
    this.badge(cx + cw - 62, cy - 1, 'Disponível', 'line')
    this.doc.font('reg').fontSize(5.6).fillColor(MUTED)
    this.doc.text(
      'Guardar mercadorias · criada em 21/09/2026 · Produto X · NF 123 série 1',
      cx,
      cy + 14,
      { width: cw }
    )

    const dadosY = cy + 28
    const dadosH = 148
    this.cardUi(cx, dadosY, cw, dadosH, 'Dados')
    const col = (cw - 24) / 2
    let dy = dadosY + 20
    this.campo(cx + 8, dy, col, 'Tipo de operação', 'Guardar mercadorias')
    this.campo(cx + 16 + col, dy, col, 'Prioridade', '3 — Normal')
    dy += 26
    this.campo(cx + 8, dy, col, 'Origem', '—')
    this.campo(cx + 16 + col, dy, col, 'Destino', 'A-RC-20-01-2-05')
    dy += 26
    this.campo(cx + 8, dy, col, 'Produto', 'Produto X')
    this.campo(cx + 16 + col, dy, col, 'Quantidade', '10')
    dy += 26
    this.campo(cx + 8, dy, col, 'Responsável', 'Sem responsável')
    this.campo(cx + 16 + col, dy, col, 'Observação', 'Guardar mercadorias — NF 123 série 1')
    this.botao(cx + 8, dadosY + dadosH - 18, 44, 13, 'Salvar', 'primario')

    const execY = dadosY + dadosH + 6
    const execH = 96
    this.doc.save()
    this.doc.roundedRect(cx, execY, cw, execH, 4).lineWidth(1.4).fillAndStroke('#FFF7F0', COPPER)
    this.doc.restore()
    this.doc.font('bold').fontSize(7.2).fillColor(NAVY)
    this.doc.text('Execução', cx + 8, execY + 6)
    this.botao(cx + 8, execY + 20, 44, 13, 'Iniciar', 'primario')
    this.campo(cx + 8, execY + 38, 160, 'Atribuir a', 'João da Silva')
    this.botao(cx + 176, execY + 47, 52, 14, 'Atribuir', 'destaque')
    this.campo(cx + 8, execY + 64, 200, 'Motivo (obrigatório para cancelar ou bloquear)', '')
    this.botao(cx + cw - 108, execY + 73, 46, 13, 'Bloquear', 'outline')
    this.botao(cx + cw - 56, execY + 73, 46, 13, 'Cancelar', 'outline')

    const histY = execY + execH + 6
    this.cardUi(cx, histY, cw, 42, 'Histórico')
    this.doc.font('reg').fontSize(6).fillColor(MUTED)
    this.doc.text('criar  →  Disponível', cx + 8, histY + 22)

    this.y = y0 + h + 6
    this.caption(
      'Tela real: ficha da requisição. O bloco cobreado é o card Execução — escolha o usuário em Atribuir a e clique Atribuir.'
    )
  }

  telaGuardar(): void {
    const h = 198
    const { cx, cy, cw } = this.shell({ altura: h, menuAtivo: 'Guardar mercadorias' })
    const y0 = this.y

    this.doc.font('bold').fontSize(10).fillColor(NAVY)
    this.doc.text('Guardar mercadorias', cx, cy)
    this.doc.font('reg').fontSize(5.5).fillColor(MUTED)
    this.doc.text(
      'Bipa o produto (EAN-13 ou DUN-14) e o endereço de destino. O estoque já entrou na consolidação da nota.',
      cx,
      cy + 14,
      { width: cw }
    )

    const filaY = cy + 30
    const filaH = h - (filaY - y0) - 10
    const inner = this.cardUi(
      cx,
      filaY,
      cw,
      filaH,
      'Fila',
      'Minha fila = atribuídas a você ou disponíveis sem dono. Uma ordem por produto da nota consolidada.'
    )
    const fx = cx + 8
    const fy = filaY + inner
    const innerW = cw - 16
    this.campo(fx, fy, 180, 'Busca', 'Produto, endereço, barras…')
    this.botao(fx + 188, fy + 9, 52, 14, 'Minha fila', 'primario')
    this.botao(fx + 244, fy + 9, 70, 14, 'Todas da empresa', 'outline')

    const cols = [
      { rotulo: 'Produto', largura: 92 },
      { rotulo: 'Quantidade', largura: 42 },
      { rotulo: 'Código de barras', largura: 68 },
      { rotulo: 'Endereço de armazenagem', largura: 72 },
      { rotulo: 'Status da armazenagem', largura: 58 },
      { rotulo: '', largura: innerW - 92 - 42 - 68 - 72 - 58 },
    ]
    this.tabelaMini(fx, fy + 30, innerW, cols, [
      ['Produto X · 9325 · NF 123 s.1', '10 UN', '7891234567890', 'A-RC-20-01-2-05', 'Pendente', ''],
      ['Produto Y · 9326 · NF 123 s.1', '4 UN', '7891234567891', 'A-RC-20-01-2-08', 'Pendente', ''],
    ])
    const btnX = fx + innerW - cols[5]!.largura + 2
    this.botao(btnX, fy + 46, cols[5]!.largura - 6, 12, 'Guardar', 'destaque')
    this.botao(btnX, fy + 64, cols[5]!.largura - 6, 12, 'Guardar', 'destaque')

    this.y = y0 + h + 6
    this.caption(
      'Tela real: Logística → Guardar mercadorias. O usuário atribuído clica Guardar na linha do produto.'
    )
  }

  telaExecutar(): void {
    const h = 292
    const { cx, cy, cw } = this.shell({ altura: h, menuAtivo: 'Guardar mercadorias', tituloJanela: 'Empresa ativa' })
    const y0 = this.y
    const colW = Math.min(280, cw)
    const ox = cx + (cw - colW) / 2

    this.doc.font('reg').fontSize(6).fillColor(MUTED)
    this.doc.text('Requisição  >', ox, cy)
    this.doc.font('bold').fontSize(10).fillColor(NAVY)
    this.doc.text('Executar REQ-00001', ox + 54, cy - 2)
    this.badge(ox + colW - 118, cy - 1, '3 — Normal', 'navy')
    this.badge(ox + colW - 62, cy - 1, 'Em execução', 'warn')
    this.doc.font('reg').fontSize(5.5).fillColor(MUTED)
    this.doc.text(
      'Bipa o produto (EAN-13 ou DUN-14) e o endereço de destino. Guardar não relança estoque.',
      ox,
      cy + 14,
      { width: colW }
    )

    this.doc.save()
    this.doc.roundedRect(ox, cy + 28, colW, 42, 4).fillAndStroke(CARD, LINE)
    this.doc.restore()
    this.doc.font('bold').fontSize(7).fillColor(NAVY)
    this.doc.text('Guardar · 9325 · Produto X', ox + 8, cy + 34, { width: colW - 16 })
    this.doc.font('reg').fontSize(6).fillColor(MUTED)
    this.doc.text('Pedido: 10 UN', ox + 8, cy + 46)
    this.doc.font('bold').fontSize(7.5).fillColor(NAVY)
    this.doc.text('Destino: A-RC-20-01-2-05', ox + 8, cy + 56)

    this.doc.save()
    this.doc.roundedRect(ox, cy + 76, colW, 78, 4).lineWidth(1.3).fillAndStroke('#FFF7F0', COPPER)
    this.doc.restore()
    this.doc.font('bold').fontSize(6).fillColor(MUTED)
    this.doc.text('PASSO 1/2 · PRODUTO', ox + 8, cy + 84)
    this.doc.font('reg').fontSize(6.2).fillColor(TEXT)
    this.doc.text('Esperado: 7891234567890', ox + 8, cy + 96)
    this.campo(ox + 8, cy + 108, colW - 16, 'Bip ou digite para confirmar', '')
    this.botao(ox + 8, cy + 136, colW - 16, 14, 'Confirmar produto', 'primario')

    this.doc.save()
    this.doc.roundedRect(ox, cy + 160, colW, 36, 4).fillAndStroke(CARD, LINE)
    this.doc.restore()
    this.doc.font('bold').fontSize(6).fillColor(MUTED)
    this.doc.text('PASSO 2/2 · DESTINO', ox + 8, cy + 168)
    this.doc.font('reg').fontSize(6.2).fillColor(TEXT)
    this.doc.text('Esperado: A-RC-20-01-2-05', ox + 8, cy + 180)

    this.botao(ox, cy + 206, (colW - 8) / 2, 16, 'Pausar', 'outline')
    this.botao(ox + (colW - 8) / 2 + 8, cy + 206, (colW - 8) / 2, 16, 'Guardar', 'apagado')

    this.doc.font('italic').fontSize(5.6).fillColor(MUTED)
    this.doc.text(
      'O botão Guardar só libera depois dos dois bips confirmados no servidor.',
      ox,
      cy + 228,
      { width: colW }
    )

    this.y = y0 + h + 6
    this.caption(
      'Tela real: Executar. Passo 1 produto (EAN-13 ou DUN-14 — SKU não vale). Passo 2 destino. Depois o botão Guardar encerra.'
    )
  }
}

function gerarConteudo(pdf: ManualPdf): void {
  pdf.capa()
  pdf.doc.addPage()

  pdf.h1('1. O que acontece depois da entrada')
  pdf.p(
    'Quando a nota fiscal de revenda é consolidada, o estoque já entra na empresa. Na mesma hora o sistema abre uma tarefa de guardar para cada produto da nota. Se a nota tem dois produtos, aparecem requisição 1 e requisição 2. Isso é o comportamento certo: cada produto vai para o próprio endereço.'
  )
  pdf.p(
    'Serviço (NFS-e) e nota de uso e consumo não geram essa tarefa. Não existe botão chamado Aceitar.'
  )
  pdf.bullets([
    'Gestor: atribui a tarefa a um usuário em Logística → Requisições.',
    'Operador: guarda o produto em Logística → Guardar mercadorias.',
  ])

  pdf.h1('2. Parte 1 — Atribuir a um usuário')
  pdf.p(
    'A requisição nasce sem dono (status Disponível, responsável em branco). Alguém com permissão de editar estoque escolhe quem vai guardar.'
  )
  pdf.passos([
    'Abra o menu Logística e clique em Requisições.',
    'Na tabela, clique no número (ex.: REQ-00001). O tipo é Guardar mercadorias.',
    'Na ficha, desça até o card Execução.',
    'Em Atribuir a, escolha o usuário e clique em Atribuir.',
  ])
  pdf.callout(
    'A partir daí, só esse usuário executa aquela linha',
    'A outra requisição (o outro produto) continua sem dono até alguém atribuir. Cada produto é uma tarefa separada.',
    'green'
  )

  pdf.telaListaRequisicoes()
  pdf.telaFicha()

  pdf.callout(
    'O que você vê na ficha e não precisa usar agora',
    'O card Dados já vem preenchido pelo sistema (tipo Guardar mercadorias, produto, quantidade, destino). Salvar, Iniciar, Bloquear e Cancelar existem nessa tela. Para o fluxo de guardar, o passo desta etapa é só Atribuir a + Atribuir. Em Disponível a ficha também mostra Iniciar — o caminho ensinado aqui é atribuir primeiro.',
    'cream'
  )

  pdf.h1('3. Parte 2 — Começar a guardar')
  pdf.p('O usuário que recebeu a tarefa entra na tela própria de guardar — não precisa voltar na lista geral de requisições.')
  pdf.passos([
    'Abra Logística → Guardar mercadorias.',
    'Clique em Minha fila. Aparece o produto atribuído a você.',
    'Clique em Guardar na linha.',
    'Bipe o código de barras do produto (EAN-13 do cadastro ou DUN-14 da caixa master). O código interno / SKU não vale.',
    'Bipe o endereço de destino (código completo do apartamento, o mesmo que a tela mostra em Esperado).',
    'Clique em Guardar de novo, agora no rodapé da tela de execução, para encerrar.',
  ])

  pdf.telaGuardar()
  pdf.telaExecutar()

  pdf.callout(
    'Atalho se ninguém atribuiu ainda',
    'Se a linha ainda está Disponível, clicar Guardar em Logística → Guardar mercadorias também pega a tarefa para quem clicou. O fluxo ensinado neste manual continua sendo atribuir primeiro, para o depósito saber de quem é cada produto.',
    'amber'
  )

  pdf.h1('4. Se parar no meio')
  pdf.p('Separar por produto existe justamente para o guarda-mercadoria continuar de onde parou.')
  pdf.bullets([
    'Terminou o produto 1 e parou: a linha fica OK/Armazenada. O produto 2 continua Pendente. Atribua o produto 2 (se ainda não tiver dono) e clique Guardar nele.',
    'Parou no meio do mesmo produto: clique Guardar de novo na mesma linha. O que já foi bipado não zera.',
    'Se clicou Pausar na tela de execução: a tela mostra “Pausada. Retome para continuar a conferência.” Use Retomar e siga o passo que faltava.',
  ])

  pdf.h1('5. Quando o botão Guardar fica cinza')
  pdf.p(
    'A linha aparece na lista mesmo assim. O status da armazenagem avisa o motivo. Isso não é tela nova — é a mesma coluna Status da armazenagem.'
  )
  pdf.bullets([
    'Sem endereço: o produto ainda não tem um endereço ativo no cadastro (aba Logística). Cadastre o endereço e volte.',
    'Sem barras: falta EAN-13 no produto ou DUN-14 na embalagem master. Cadastre as barras e volte.',
    'OK/Armazenada: essa linha já foi guardada. Não clica de novo.',
  ])

  pdf.h1('6. O que isso não faz')
  pdf.bullets([
    'Não relança quantidade no estoque. O estoque já subiu na consolidação da nota.',
    'Não escolhe endereço na hora. Usa o primeiro endereço ativo do cadastro do produto.',
    'Não imprime etiqueta e não faz slotting automático.',
  ])

  pdf.callout(
    'Resumo em uma frase',
    'Atribuir (em Requisições) define quem faz. Guardar (em Guardar mercadorias) começa o bip. Uma requisição por produto, para poder parar e continuar.',
    'navy'
  )

  pdf.p('Fim do manual.', { italic: true, color: MUTED })
}

async function main(): Promise<void> {
  mkdirSync(PASTA, { recursive: true })
  const pdf = new ManualPdf()
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
