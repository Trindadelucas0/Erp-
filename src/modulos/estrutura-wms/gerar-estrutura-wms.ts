import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  faixaNumerica,
  montarCodigoEnderecoWms,
  TETO_GERAR_ENDERECOS_WMS,
  validarCodigoNivelEstruturaWms,
} from '../enderecos-wms/nomenclatura-endereco-wms.js'
import type { DadosParaGerarEstruturaWms } from './esquema-estrutura-wms.js'

export function calcularFaixasGeracao(dados: DadosParaGerarEstruturaWms) {
  const ruas = dados.ruaId
    ? null
    : faixaNumerica(dados.ruaInicio ?? '01', dados.ruaFim ?? '01', 'rua')
  const blocos = faixaNumerica(dados.blocoInicio, dados.blocoFim, 'bloco')
  const andares = faixaNumerica(dados.andarInicio, dados.andarFim, 'andar')
  const aps = faixaNumerica(dados.apartamentoInicio, dados.apartamentoFim, 'apartamento')
  const qtdRuas = ruas ? ruas.length : 1
  const total = qtdRuas * blocos.length * andares.length * aps.length
  if (total > TETO_GERAR_ENDERECOS_WMS) {
    throw new ErroDaAplicacao(
      `A geração ultrapassa o limite de ${TETO_GERAR_ENDERECOS_WMS} endereços`,
      400
    )
  }
  if (total < 1) {
    throw new ErroDaAplicacao('Nenhum endereço para gerar', 400)
  }
  return { ruas, blocos, andares, aps, total }
}

export function exemplosCodigoGeracao(params: {
  local: string
  area: string
  ruas: string[]
  blocos: string[]
  andares: string[]
  aps: string[]
  limite?: number
}): string[] {
  const limite = params.limite ?? 12
  const exemplos: string[] = []
  for (const rua of params.ruas) {
    for (const bloco of params.blocos) {
      for (const andar of params.andares) {
        for (const posicao of params.aps) {
          exemplos.push(
            montarCodigoEnderecoWms({
              local: params.local,
              area: params.area,
              rua,
              bloco,
              andar,
              posicao,
            })
          )
          if (exemplos.length >= limite) return exemplos
        }
      }
    }
  }
  return exemplos
}

export function validarTipoPadrao(tipo: string): string {
  return validarCodigoNivelEstruturaWms('area', tipo)
}
