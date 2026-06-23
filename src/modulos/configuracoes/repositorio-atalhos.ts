import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import {
  ATALHOS_PADRAO,
  CHAVES_DE_ACAO_ATALHO,
  type ChaveDaAcaoAtalho,
} from '../../compartilhado/atalhos/atalhos-padrao.js'

export type AtalhoPersistido = {
  acao: ChaveDaAcaoAtalho
  tecla: string
  ativo: boolean
}

export const repositorioDeAtalhos = {
  async listar(): Promise<AtalhoPersistido[]> {
    const registros = await clientePrisma.atalhoTeclado.findMany({
      orderBy: { acao: 'asc' },
    })

    if (registros.length === 0) {
      return CHAVES_DE_ACAO_ATALHO.map((acao) => ({
        acao,
        tecla: ATALHOS_PADRAO[acao],
        ativo: true,
      }))
    }

    return registros.map((r) => ({
      acao: r.acao as ChaveDaAcaoAtalho,
      tecla: r.tecla,
      ativo: r.ativo,
    }))
  },

  async salvarTodos(atalhos: AtalhoPersistido[]): Promise<AtalhoPersistido[]> {
    await clientePrisma.$transaction(
      atalhos.map((atalho) =>
        clientePrisma.atalhoTeclado.upsert({
          where: { acao: atalho.acao },
          create: {
            acao: atalho.acao,
            tecla: atalho.tecla,
            ativo: atalho.ativo,
          },
          update: {
            tecla: atalho.tecla,
            ativo: atalho.ativo,
          },
        })
      )
    )

    return this.listar()
  },

  async restaurarPadroes(): Promise<AtalhoPersistido[]> {
    const padroes = CHAVES_DE_ACAO_ATALHO.map((acao) => ({
      acao,
      tecla: ATALHOS_PADRAO[acao],
      ativo: true,
    }))
    return this.salvarTodos(padroes)
  },
}
