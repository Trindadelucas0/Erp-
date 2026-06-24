'use client'

import { Select, classesOption, classesSelectCompacto } from '@/components/ui/select'
import { mascaraCpf, mascaraCnpj } from '@/lib/documentos'

export type DadosBancarioForm = {
  apelido: string
  banco: string
  agencia: string
  conta: string
  tipoConta: 'corrente' | 'poupanca' | ''
  pix: string
  favorecido: string
  documentoFavorecido: string
  principal: boolean
}

export const DADOS_BANCARIO_VAZIO: DadosBancarioForm = {
  apelido: '',
  banco: '',
  agencia: '',
  conta: '',
  tipoConta: '',
  pix: '',
  favorecido: '',
  documentoFavorecido: '',
  principal: false,
}

const TIPOS_CONTA = [
  { value: 'corrente', label: 'Corrente' },
  { value: 'poupanca', label: 'Poupança' },
]

type Props = {
  dadosBancarios: DadosBancarioForm[]
  aoMudar: (dados: DadosBancarioForm[]) => void
  disabled?: boolean
  mensagemDeErro?: string
}

function mascaraDocumentoFavorecido(v: string): string {
  const nums = v.replace(/\D/g, '')
  if (nums.length <= 11) return mascaraCpf(nums)
  return mascaraCnpj(nums)
}

export function ListaDadosBancarios({ dadosBancarios, aoMudar, disabled, mensagemDeErro }: Props) {
  function adicionar() {
    aoMudar([...dadosBancarios, { ...DADOS_BANCARIO_VAZIO }])
  }

  function remover(idx: number) {
    aoMudar(dadosBancarios.filter((_, i) => i !== idx))
  }

  function atualizar(idx: number, campo: keyof DadosBancarioForm, valor: string | boolean) {
    const novos = dadosBancarios.map((item, i) => {
      if (i !== idx) {
        if (campo === 'principal' && valor === true) {
          return { ...item, principal: false }
        }
        return item
      }
      return { ...item, [campo]: valor }
    })
    aoMudar(novos)
  }

  return (
    <div className="space-y-4">
      {dadosBancarios.map((db, idx) => (
        <div key={idx} className="space-y-3 rounded-md border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Conta {idx + 1}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => remover(idx)}
                className="text-xs text-destructive hover:underline"
              >
                Remover
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Apelido" valor={db.apelido} aoMudar={(v) => atualizar(idx, 'apelido', v)} disabled={disabled} placeholder="Ex: Conta principal" />
            <Campo rotulo="Banco" valor={db.banco} aoMudar={(v) => atualizar(idx, 'banco', v)} disabled={disabled} placeholder="Código ou nome" />
            <Campo rotulo="Agência" valor={db.agencia} aoMudar={(v) => atualizar(idx, 'agencia', v)} disabled={disabled} />
            <Campo rotulo="Conta" valor={db.conta} aoMudar={(v) => atualizar(idx, 'conta', v)} disabled={disabled} />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select
                value={db.tipoConta}
                onChange={(e) => atualizar(idx, 'tipoConta', e.target.value)}
                disabled={disabled}
                className={classesSelectCompacto}
              >
                <option value="" className={classesOption}>Selecione...</option>
                {TIPOS_CONTA.map((t) => (
                  <option key={t.value} value={t.value} className={classesOption}>{t.label}</option>
                ))}
              </Select>
            </div>
            <Campo rotulo="PIX" valor={db.pix} aoMudar={(v) => atualizar(idx, 'pix', v)} disabled={disabled} />
            <Campo rotulo="Favorecido" valor={db.favorecido} aoMudar={(v) => atualizar(idx, 'favorecido', v)} disabled={disabled} />
            <Campo
              rotulo="CPF/CNPJ do favorecido"
              valor={db.documentoFavorecido}
              aoMudar={(v) => atualizar(idx, 'documentoFavorecido', mascaraDocumentoFavorecido(v))}
              disabled={disabled}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={db.principal}
              onChange={(e) => atualizar(idx, 'principal', e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">Conta principal</span>
          </label>
        </div>
      ))}

      {!disabled && (
        <button type="button" onClick={adicionar} className="text-sm text-primary underline">
          + Adicionar conta bancária
        </button>
      )}

      {mensagemDeErro && <p className="text-sm text-destructive">{mensagemDeErro}</p>}
    </div>
  )
}

function Campo({
  rotulo, valor, aoMudar, disabled, placeholder,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{rotulo}</label>
      <input
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  )
}
