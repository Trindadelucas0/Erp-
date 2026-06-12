/**
 * Exporta um array de objetos para um arquivo CSV e dispara o download.
 * @param dados - Array de objetos com os dados
 * @param nomeDoArquivo - Nome do arquivo sem extensão
 */
export function exportarCsv(
  dados: Record<string, string | number | boolean | null | undefined>[],
  nomeDoArquivo: string
): void {
  if (dados.length === 0) return

  const colunas = Object.keys(dados[0])

  const escapar = (valor: unknown): string => {
    const str = String(valor ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const cabecalho = colunas.map(escapar).join(',')
  const linhas = dados.map((linha) =>
    colunas.map((coluna) => escapar(linha[coluna])).join(',')
  )

  const conteudo = [cabecalho, ...linhas].join('\n')
  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${nomeDoArquivo}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
