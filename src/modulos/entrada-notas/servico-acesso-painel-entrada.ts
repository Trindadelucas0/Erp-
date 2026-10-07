/**
 * Recorte de abas da Entrada de notas para o papel administrativo.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { repositorioDePermissoes } from '../permissoes/repositorio-permissoes.js'
import {
  PAINEIS_ENTRADA_ADMINISTRATIVO,
  type PainelEntradaListagem,
  painelDaListagemPorStatusEntrada,
  painelEntradaAdministrativoPermitido,
} from '../focus-nfe/paineis-entrada-listagem.js'

export async function usuarioRestritoEntradaAdministrativo(
  idDoUsuario: string
): Promise<boolean> {
  const [nomesPapeis, temComprasView] = await Promise.all([
    repositorioDePermissoes.buscarNomesDosPapeisPorIdDoUsuario(idDoUsuario),
    repositorioDePermissoes.usuarioPossuiPermissao(idDoUsuario, 'compras:view'),
  ])

  if (nomesPapeis.includes('admin')) return false
  if (temComprasView) return false
  return nomesPapeis.includes('administrativo')
}

export async function exigirAcessoPainelEntradaNotas(
  idDoUsuario: string,
  opcoes: { painel?: PainelEntradaListagem; statusEntrada?: string | null }
): Promise<void> {
  const restrito = await usuarioRestritoEntradaAdministrativo(idDoUsuario)
  if (!restrito) return

  const painel =
    opcoes.painel ??
    (opcoes.statusEntrada
      ? painelDaListagemPorStatusEntrada(opcoes.statusEntrada)
      : null)

  if (!painel || !painelEntradaAdministrativoPermitido(painel)) {
    throw new ErroDaAplicacao('Sem permissão para esta área da Entrada de notas', 403)
  }
}
