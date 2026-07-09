export function normalizarTermoBusca(termo: string): string {
  return termo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

export type MapaNormalizacao = {
  normalizado: string
  indiceOriginalPorPosicao: number[]
}

export function normalizarComMapa(texto: string): MapaNormalizacao {
  const indiceOriginalPorPosicao: number[] = []
  let normalizado = ''

  for (let i = 0; i < texto.length; i++) {
    const decomposto = texto[i].normalize('NFD')
    for (let j = 0; j < decomposto.length; j++) {
      const caractere = decomposto[j]
      if (/\p{M}/u.test(caractere)) continue
      normalizado += caractere.toLowerCase()
      indiceOriginalPorPosicao.push(i)
    }
  }

  return { normalizado, indiceOriginalPorPosicao }
}

export type SegmentoTextoBusca = {
  texto: string
  destaque: boolean
}

export function segmentarTextoPorTermo(
  texto: string,
  termo: string
): SegmentoTextoBusca[] {
  const termoNormalizado = normalizarTermoBusca(termo)
  if (!termoNormalizado) {
    return [{ texto, destaque: false }]
  }

  const { normalizado, indiceOriginalPorPosicao } = normalizarComMapa(texto)
  const destacados = new Set<number>()

  let buscaAPartirDe = 0
  while (buscaAPartirDe <= normalizado.length - termoNormalizado.length) {
    const indice = normalizado.indexOf(termoNormalizado, buscaAPartirDe)
    if (indice === -1) break
    for (let pos = indice; pos < indice + termoNormalizado.length; pos++) {
      destacados.add(indiceOriginalPorPosicao[pos])
    }
    buscaAPartirDe = indice + 1
  }

  if (destacados.size === 0) {
    return [{ texto, destaque: false }]
  }

  const segmentos: SegmentoTextoBusca[] = []
  let inicio = 0
  while (inicio < texto.length) {
    const destaque = destacados.has(inicio)
    let fim = inicio + 1
    while (fim < texto.length && destacados.has(fim) === destaque) {
      fim++
    }
    segmentos.push({ texto: texto.slice(inicio, fim), destaque })
    inicio = fim
  }

  return segmentos
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function textoContemTermo(texto: string, termo: string): boolean {
  const termoNormalizado = normalizarTermoBusca(termo)
  if (!termoNormalizado) return true
  return normalizarTermoBusca(texto).includes(termoNormalizado)
}

export type CadastroPessoaFiltravel = {
  nome: string
  nomeFantasia?: string | null
  cpf?: string | null
  cnpj?: string | null
  email?: string | null
  estado?: string | null
}

export function filtrarCadastroPessoa<T extends CadastroPessoaFiltravel>(
  itens: T[],
  busca: string
): T[] {
  const termo = normalizarTermoBusca(busca)
  if (!termo) return itens

  const digitosBusca = somenteDigitos(busca)
  return itens.filter((item) => {
    if (textoContemTermo(item.nome, busca)) return true
    if (item.nomeFantasia && textoContemTermo(item.nomeFantasia, busca)) return true
    if (item.email && textoContemTermo(item.email, busca)) return true
    if (item.estado && textoContemTermo(item.estado, busca)) return true
    if (digitosBusca) {
      if (item.cpf && item.cpf.includes(digitosBusca)) return true
      if (item.cnpj && item.cnpj.includes(digitosBusca)) return true
    }
    return false
  })
}
