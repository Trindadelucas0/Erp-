'use client'

import { useState } from 'react'

/** Valor que o Chrome costuma injetar (login salvo) — não é busca de nota. */
export function buscaListaPareceEmail(valor: string): boolean {
  const t = valor.trim()
  if (!t.includes('@')) return false
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(t)
}

/** Atributos para campos de busca em listas — evita autofill/sugestão de login do navegador. */
export function atributosCampoBuscaLista(nomeCampo: string) {
  return {
    type: 'text' as const,
    name: nomeCampo,
    autoComplete: 'one-time-code' as const,
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    role: 'searchbox' as const,
    'data-1p-ignore': true,
    'data-lpignore': 'true',
    'data-form-type': 'other',
  }
}

/** Chrome ignora `autocomplete=off` no load — trava o campo até o primeiro foco. */
export function useAntiAutofillBuscaLista() {
  const [somenteLeitura, setSomenteLeitura] = useState(true)
  return {
    readOnly: somenteLeitura,
    onFocus: () => setSomenteLeitura(false),
  }
}
