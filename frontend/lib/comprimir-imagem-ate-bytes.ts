/**
 * Comprime imagem no browser (Canvas → JPEG) até caber em um teto de bytes.
 * Usado em anexos de Contas a Pagar (limite 2 MB).
 */

export type ImagemComprimidaAteBytes = {
  dataUrl: string
  mimeType: string
  bytes: number
  nomeArquivo: string
  tamanhoOriginal: number
  feedback: string
}

function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem'))
    }
    img.src = url
  })
}

function redimensionar(
  img: HTMLImageElement,
  maxLado: number
): { largura: number; altura: number } {
  let { width, height } = img
  const maior = Math.max(width, height)
  if (maior <= maxLado) {
    return { largura: width, altura: height }
  }
  const escala = maxLado / maior
  return {
    largura: Math.round(width * escala),
    altura: Math.round(height * escala),
  }
}

function bytesDeDataUrlJpeg(dataUrl: string): number {
  return Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75)
}

function comprimirParaAlvo(
  img: HTMLImageElement,
  maxLado: number,
  alvoBytes: number
): { dataUrl: string; bytes: number } {
  const { largura, altura } = redimensionar(img, maxLado)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas não suportado neste navegador')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(img, 0, 0, largura, altura)

  let qualidade = 0.88
  let dataUrl = canvas.toDataURL('image/jpeg', qualidade)
  let bytes = bytesDeDataUrlJpeg(dataUrl)

  while (bytes > alvoBytes && qualidade > 0.28) {
    qualidade -= 0.06
    dataUrl = canvas.toDataURL('image/jpeg', qualidade)
    bytes = bytesDeDataUrlJpeg(dataUrl)
  }

  if (bytes > alvoBytes && maxLado > 480) {
    return comprimirParaAlvo(img, Math.round(maxLado * 0.8), alvoBytes)
  }

  return { dataUrl, bytes }
}

function nomeJpeg(nomeOriginal: string): string {
  const base = nomeOriginal.replace(/\.[^.]+$/, '').trim() || 'anexo'
  return `${base}.jpg`
}

function lerArquivoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

/**
 * Se a imagem já está ≤ maxBytes, devolve o arquivo original.
 * Se passar, comprime/redimensiona para JPEG ≤ maxBytes.
 */
export async function prepararImagemAteBytes(
  file: File,
  maxBytes: number
): Promise<ImagemComprimidaAteBytes> {
  const mimeInformado = (file.type || '').toLowerCase()
  const pareceImagem =
    mimeInformado.startsWith('image/') ||
    /\.(jpe?g|png|webp)$/i.test(file.name)

  if (!pareceImagem) {
    throw new Error('Arquivo não é imagem')
  }

  const LIMITE_LEITURA = 40 * 1024 * 1024
  if (file.size > LIMITE_LEITURA) {
    throw new Error(
      `Imagem muito grande (${formatarTamanho(file.size)}). Máximo para converter: ${formatarTamanho(LIMITE_LEITURA)}`
    )
  }

  if (file.size <= maxBytes) {
    const dataUrl = await lerArquivoDataUrl(file)
    const mime = (file.type || 'image/jpeg').toLowerCase()
    return {
      dataUrl,
      mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
      bytes: file.size,
      nomeArquivo: file.name,
      tamanhoOriginal: file.size,
      feedback: '',
    }
  }

  const img = await carregarImagem(file)
  const { dataUrl, bytes } = comprimirParaAlvo(img, 2400, maxBytes)

  if (bytes > maxBytes) {
    throw new Error(
      `Não foi possível reduzir a imagem para ${formatarTamanho(maxBytes)} (ficou ${formatarTamanho(bytes)}).`
    )
  }

  return {
    dataUrl,
    mimeType: 'image/jpeg',
    bytes,
    nomeArquivo: nomeJpeg(file.name),
    tamanhoOriginal: file.size,
    feedback: `Convertido: ${formatarTamanho(file.size)} → ${formatarTamanho(bytes)}`,
  }
}

export { formatarTamanho as formatarTamanhoArquivo }
