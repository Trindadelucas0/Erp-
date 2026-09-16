export function haEnderecoEstoqueDuplicado(itens: { endereco: string }[]): boolean {
  const preenchidos = itens.map((e) => e.endereco.trim().toUpperCase()).filter(Boolean)
  return new Set(preenchidos).size !== preenchidos.length
}
