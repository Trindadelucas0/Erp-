import { z } from 'zod'
import { textoCadastroObrigatorio } from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

export const esquemaDeCriacaoDeMarca = z.object({
  nome: textoCadastroObrigatorio(1, 100).transform((v) => v.toUpperCase()),
})

export type DadosParaCriarMarca = z.infer<typeof esquemaDeCriacaoDeMarca>
