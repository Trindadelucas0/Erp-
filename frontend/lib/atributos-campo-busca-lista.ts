/** Atributos para campos de busca em listas — evita autofill/sugestão de login do navegador. */
export function atributosCampoBuscaLista(nomeCampo: string) {
  return {
    type: 'text' as const,
    name: nomeCampo,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    role: 'searchbox' as const,
    'data-1p-ignore': true,
    'data-lpignore': 'true',
  }
}
