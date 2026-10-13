export type LinhaExtratoImportada = {
  data: Date
  historico: string
  documento: string | null
  valor: number
  identificador: string | null
}

function tag(bloco: string, nome: string): string | null {
  const correspondencia = bloco.match(new RegExp(`<${nome}>\\s*([^<\\r\\n]+)`, 'i'))
  return correspondencia?.[1]?.trim() || null
}

function dataOfx(valor: string | null): Date | null {
  const correspondencia = valor?.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!correspondencia) return null
  const data = new Date(`${correspondencia[1]}-${correspondencia[2]}-${correspondencia[3]}T00:00:00.000Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

export function parsearOfx(buffer: Buffer): { linhas: LinhaExtratoImportada[]; invalidas: number } {
  const texto = buffer.toString('utf8')
  const blocos = texto.match(/<STMTTRN>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi) ?? []
  const linhas: LinhaExtratoImportada[] = []
  let invalidas = 0

  for (const bloco of blocos) {
    const data = dataOfx(tag(bloco, 'DTPOSTED'))
    const valor = Number((tag(bloco, 'TRNAMT') ?? '').replace(',', '.'))
    if (!data || !Number.isFinite(valor) || valor === 0) {
      invalidas += 1
      continue
    }
    const memo = tag(bloco, 'MEMO')
    const nome = tag(bloco, 'NAME')
    linhas.push({
      data,
      valor,
      historico: memo || nome || 'Movimentação bancária',
      documento: tag(bloco, 'CHECKNUM') || tag(bloco, 'REFNUM'),
      identificador: tag(bloco, 'FITID'),
    })
  }

  return { linhas, invalidas }
}
