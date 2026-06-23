/**
 * Utilitários para detectar alterações em formulários de cadastro.
 */

export function clonarFormulario<T>(obj: T): T {
  return structuredClone(obj)
}

export function formularioFoiAlterado<T>(atual: T, inicial: T): boolean {
  return JSON.stringify(atual) !== JSON.stringify(inicial)
}
