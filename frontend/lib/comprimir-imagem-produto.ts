/**
 * Compressão adaptativa de fotos de produto no browser (Canvas + JPEG).
 */

const LIMITE_UPLOAD_BYTES = 25 * 1024 * 1024
const ALVO_MINIATURA_BYTES = 72 * 1024
const ALVO_PRINCIPAL_BYTES = 220 * 1024
const MAX_MINIATURA_PX = 256
const MAX_PRINCIPAL_PX = 1280

export type ImagemComprimida = {
  dataUrl: string
  bytes: number
  largura: number
  altura: number
}

export type ResultadoCompressaoProduto = {
  principal: ImagemComprimida
  miniatura: ImagemComprimida
  tamanhoOriginal: number
  feedback: string
}

function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
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
  width = Math.round(width * escala)
  height = Math.round(height * escala)
  return { largura: width, altura: height }
}

function comprimirParaAlvo(
  img: HTMLImageElement,
  maxLado: number,
  alvoBytes: number
): ImagemComprimida {
  const { largura, altura } = redimensionar(img, maxLado)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas não suportado neste navegador')
  }
  ctx.drawImage(img, 0, 0, largura, altura)

  let qualidade = 0.85
  let dataUrl = canvas.toDataURL('image/jpeg', qualidade)
  let bytes = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75)

  while (bytes > alvoBytes && qualidade > 0.35) {
    qualidade -= 0.05
    dataUrl = canvas.toDataURL('image/jpeg', qualidade)
    bytes = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75)
  }

  if (bytes > alvoBytes && maxLado > 128) {
    return comprimirParaAlvo(img, Math.round(maxLado * 0.85), alvoBytes)
  }

  return { dataUrl, bytes, largura, altura }
}

export async function comprimirImagemProduto(file: File): Promise<ResultadoCompressaoProduto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem (JPEG, PNG ou WebP)')
  }

  if (file.size > LIMITE_UPLOAD_BYTES) {
    throw new Error(
      `Arquivo muito grande (${formatarTamanho(file.size)}). Limite: ${formatarTamanho(LIMITE_UPLOAD_BYTES)}`
    )
  }

  const img = await carregarImagem(file)
  const principal = comprimirParaAlvo(img, MAX_PRINCIPAL_PX, ALVO_PRINCIPAL_BYTES)
  const miniatura = comprimirParaAlvo(img, MAX_MINIATURA_PX, ALVO_MINIATURA_BYTES)

  const feedback = `${formatarTamanho(file.size)} → ${formatarTamanho(miniatura.bytes)} (miniatura) / ${formatarTamanho(principal.bytes)} (principal)`

  return {
    principal,
    miniatura,
    tamanhoOriginal: file.size,
    feedback,
  }
}
