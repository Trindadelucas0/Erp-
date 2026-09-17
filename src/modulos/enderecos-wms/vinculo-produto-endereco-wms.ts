import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'

export const MSG_PRODUTO_VINCULADO_ENDERECO =
  'Há produtos vinculados a este endereço. Realoque os produtos primeiro.'

export const MSG_PRODUTO_VINCULADO_NIVEL =
  'Há produtos vinculados a endereços abaixo deste nível. Realoque os produtos primeiro.'

export async function contarProdutosNosCodigos(companyId: string, codigoCompleto: string[]) {
  const codigos = [...new Set(codigoCompleto.map((c) => String(c ?? '').trim()).filter(Boolean))]
  if (codigos.length === 0) return 0
  return clientePrisma.produtoEnderecoEstoque.count({
    where: {
      endereco: { in: codigos },
      produto: { companyId },
    },
  })
}
