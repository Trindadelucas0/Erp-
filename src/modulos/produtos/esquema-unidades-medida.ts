import { z } from 'zod'
import {
  textoCadastroObrigatorio,
} from '../../compartilhado/normalizacao/esquema-texto-cadastro.js'

export const esquemaDeCriacaoDeUnidadeMedida = z.object({
  sigla: textoCadastroObrigatorio(1, 10).transform((v) => v.toUpperCase()),
  nome: textoCadastroObrigatorio(2, 100),
})

export type DadosParaCriarUnidadeMedida = z.infer<typeof esquemaDeCriacaoDeUnidadeMedida>
