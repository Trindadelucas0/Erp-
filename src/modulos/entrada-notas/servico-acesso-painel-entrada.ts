/**
 * Recorte de abas da Entrada de notas (delega a RoleTabAccess).
 */
import type { PainelEntradaListagem } from '../focus-nfe/paineis-entrada-listagem.js'
import { painelDaListagemPorStatusEntrada } from '../focus-nfe/paineis-entrada-listagem.js'
import { exigirAcessoAba } from '../acesso/servico-acesso-aba.js'

const PAGE_KEY = 'entrada-notas'

export async function exigirAcessoPainelEntradaNotas(
  idDoUsuario: string,
  opcoes: { painel?: PainelEntradaListagem; statusEntrada?: string | null }
): Promise<void> {
  const painel =
    opcoes.painel ??
    (opcoes.statusEntrada
      ? painelDaListagemPorStatusEntrada(opcoes.statusEntrada)
      : null)

  if (!painel) {
    await exigirAcessoAba(idDoUsuario, PAGE_KEY, 'analise')
    return
  }

  await exigirAcessoAba(idDoUsuario, PAGE_KEY, painel)
}

/** @deprecated Mantido para testes legados — use exigirAcessoAba. */
export async function usuarioRestritoEntradaAdministrativo(
  _idDoUsuario: string
): Promise<boolean> {
  return false
}
