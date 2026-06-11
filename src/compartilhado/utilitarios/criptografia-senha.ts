/**
 * Funções para criptografar e comparar senhas com bcrypt.
 */
import bcrypt from 'bcrypt'

const RODADAS_DE_SAL = 10

/**
 * Criptografa uma senha em texto puro.
 * @param senhaEmTexto - Senha digitada pelo usuário
 * @returns Hash seguro para salvar no banco
 */
export async function criptografarSenha(senhaEmTexto: string): Promise<string> {
  return bcrypt.hash(senhaEmTexto, RODADAS_DE_SAL)
}

/**
 * Compara senha digitada com o hash salvo no banco.
 * @param senhaEmTexto - Senha digitada no login
 * @param hashSalvoNoBanco - Hash armazenado no banco
 * @returns true se a senha estiver correta
 */
export async function compararSenhaComHash(
  senhaEmTexto: string,
  hashSalvoNoBanco: string
): Promise<boolean> {
  return bcrypt.compare(senhaEmTexto, hashSalvoNoBanco)
}
