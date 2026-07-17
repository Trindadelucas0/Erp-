type Props = {
  linhas?: number
  colunas: number
}

/** Linhas placeholder com pulse para tabelas enquanto a lista carrega da API. */
export function LinhasSkeletonTabela({ linhas = 3, colunas }: Props) {
  return (
    <>
      {Array.from({ length: linhas }).map((_, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          {Array.from({ length: colunas }).map((__, j) => (
            <td key={j} className="px-2 py-2">
              <div className="h-4 animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
