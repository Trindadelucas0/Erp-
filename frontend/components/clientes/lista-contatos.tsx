'use client'

/**
 * Lista dinâmica de contatos (email, telefone, WhatsApp).
 * Permite adicionar, editar e remover itens.
 * Máximo de 1 contato principal por tipo.
 */

import { Select, classesOption, classesSelectCompacto } from '@/components/ui/select'
import { mascaraTelefone } from '@/lib/documentos'

export type ContatoForm = {
  tipo: 'email' | 'telefone' | 'outro'
  valor: string
  descricao: string
  whatsapp: boolean
  principal: boolean
}

const CONTATO_VAZIO: ContatoForm = {
  tipo: 'email',
  valor: '',
  descricao: '',
  whatsapp: false,
  principal: false,
}

const TIPOS_CONTATO: { value: ContatoForm['tipo']; label: string }[] = [
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone / Celular' },
  { value: 'outro', label: 'Outro' },
]

type Props = {
  contatos: ContatoForm[]
  aoMudar: (contatos: ContatoForm[]) => void
  disabled?: boolean
  mensagemDeErro?: string
}

export function ListaContatos({ contatos, aoMudar, disabled, mensagemDeErro }: Props) {
  function adicionar() {
    aoMudar([...contatos, { ...CONTATO_VAZIO }])
  }

  function remover(idx: number) {
    aoMudar(contatos.filter((_, i) => i !== idx))
  }

  function atualizar(idx: number, campo: keyof ContatoForm, valor: string | boolean) {
    const novos = contatos.map((c, i) => {
      if (i !== idx) return c

      const atualizado = { ...c, [campo]: valor }

      // Ao marcar principal, remove do mesmo tipo nos outros
      if (campo === 'principal' && valor === true) {
        return atualizado
      }
      return atualizado
    })

    // Garantir no máximo 1 principal por tipo ao ativar
    if (campo === 'principal' && valor === true) {
      const tipo = novos[idx].tipo
      return aoMudar(
        novos.map((c, i) =>
          i !== idx && c.tipo === tipo ? { ...c, principal: false } : c
        )
      )
    }

    aoMudar(novos)
  }

  return (
    <div className="space-y-3">
      {mensagemDeErro && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensagemDeErro}
        </p>
      )}
      {contatos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum contato adicionado. Clique em "+ Adicionar contato" para começar.
        </p>
      )}

      {contatos.map((contato, idx) => (
        <div
          key={idx}
          className="rounded-md border border-border bg-muted/20 p-3 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Contato #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => remover(idx)}
              disabled={disabled}
              className="text-xs text-destructive hover:underline disabled:opacity-50"
            >
              Remover
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Tipo */}
            <div className="space-y-1">
              <label className="text-xs font-medium leading-none text-muted-foreground">
                Tipo
              </label>
              <Select
                className={classesSelectCompacto}
                value={contato.tipo}
                onChange={(e) => atualizar(idx, 'tipo', e.target.value)}
                disabled={disabled}
              >
                {TIPOS_CONTATO.map((t) => (
                  <option key={t.value} value={t.value} className={classesOption}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Valor */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium leading-none text-muted-foreground">
                {contato.tipo === 'email' ? 'Endereço de e-mail' : 'Número / valor'}
              </label>
              <input
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                type={contato.tipo === 'email' ? 'email' : 'text'}
                value={contato.valor}
                onChange={(e) => {
                  const valor =
                    contato.tipo === 'telefone'
                      ? mascaraTelefone(e.target.value)
                      : e.target.value
                  atualizar(idx, 'valor', valor)
                }}
                placeholder={
                  contato.tipo === 'email'
                    ? 'email@exemplo.com'
                    : contato.tipo === 'telefone'
                    ? '(00) 00000-0000'
                    : 'Valor do contato'
                }
                maxLength={contato.tipo === 'telefone' ? 15 : undefined}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <label className="text-xs font-medium leading-none text-muted-foreground">
              Descrição (opcional)
            </label>
            <input
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              type="text"
              value={contato.descricao}
              onChange={(e) => atualizar(idx, 'descricao', e.target.value)}
              placeholder="Ex: Financeiro, Compras, Suporte..."
              maxLength={100}
              disabled={disabled}
            />
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={contato.principal}
                onChange={(e) => atualizar(idx, 'principal', e.target.checked)}
                disabled={disabled}
                className="h-3.5 w-3.5 rounded border-input accent-primary"
              />
              <span className="text-xs font-medium">Principal</span>
            </label>
            {contato.tipo === 'telefone' && (
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={contato.whatsapp}
                  onChange={(e) => atualizar(idx, 'whatsapp', e.target.checked)}
                  disabled={disabled}
                  className="h-3.5 w-3.5 rounded border-input accent-primary"
                />
                <span className="text-xs font-medium">WhatsApp</span>
              </label>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={adicionar}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Adicionar contato
      </button>
    </div>
  )
}
