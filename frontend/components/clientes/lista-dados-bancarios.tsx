'use client'

import { useEffect } from 'react'
import { Select, classesOption, classesSelectCompacto } from '@/components/ui/select'
import { classesCampoCompacto } from '@/components/ui/classes-campo'
import { mascaraDocumento, normalizarDocumento } from '@/lib/documentos'
import { ComboboxBanco } from '@/components/ui/combobox-banco'

export type DadosBancarioForm = {
  apelido: string
  banco: string
  agencia: string
  conta: string
  tipoConta: 'corrente' | 'poupanca' | ''
  pix: string
  favorecido: string
  documentoFavorecido: string
  favorecidoIgualCadastro: boolean
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
  favorecidoIgualCadastro: true,
  principal: false,
}

const TIPOS_CONTA = [
  { value: 'corrente', label: 'Corrente' },
  { value: 'poupanca', label: 'Poupança' },
]

type Props = {
  dadosBancarios: DadosBancarioForm[]
  aoMudar: (dados: DadosBancarioForm[]) => void
  nomeCadastro?: string
  documentoCadastro?: string
  disabled?: boolean
  mensagemDeErro?: string
}

function mascaraDocumentoFavorecido(v: string): string {
  return mascaraDocumento(v)
}

function inferirFavorecidoIgualCadastro(
  db: Pick<DadosBancarioForm, 'favorecido' | 'documentoFavorecido'>,
  nomeCadastro: string,
  documentoCadastro: string
): boolean {
  const docCadastro = normalizarDocumento(documentoCadastro)
  const docFavorecido = normalizarDocumento(db.documentoFavorecido)
  if (!docCadastro) return false
  return (
    db.favorecido.trim() === nomeCadastro.trim() &&
    docFavorecido === docCadastro
  )
}

export function dadosBancarioApiParaForm(
  db: {
    apelido?: string | null
    banco?: string | null
    agencia?: string | null
    conta?: string | null
    tipoConta?: string | null
    pix?: string | null
    favorecido?: string | null
    documentoFavorecido?: string | null
    principal?: boolean
  },
  nomeCadastro: string,
  documentoCadastro: string
): DadosBancarioForm {
  const docNorm = normalizarDocumento(db.documentoFavorecido || '')
  const item: DadosBancarioForm = {
    apelido: db.apelido || '',
    banco: db.banco || '',
    agencia: db.agencia || '',
    conta: db.conta || '',
    tipoConta: (db.tipoConta as DadosBancarioForm['tipoConta']) || '',
    pix: db.pix || '',
    favorecido: db.favorecido || '',
    documentoFavorecido: docNorm
      ? mascaraDocumentoFavorecido(docNorm)
      : '',
    favorecidoIgualCadastro: false,
    principal: db.principal ?? false,
  }
  item.favorecidoIgualCadastro = inferirFavorecidoIgualCadastro(
    item,
    nomeCadastro,
    documentoCadastro
  )
  return item
}

export function ListaDadosBancarios({
  dadosBancarios,
  aoMudar,
  nomeCadastro = '',
  documentoCadastro = '',
  disabled,
  mensagemDeErro,
}: Props) {
  useEffect(() => {
    if (!nomeCadastro && !documentoCadastro) return

    let alterou = false
    const atualizados = dadosBancarios.map((db) => {
      if (!db.favorecidoIgualCadastro) return db
      if (
        db.favorecido === nomeCadastro &&
        db.documentoFavorecido === documentoCadastro
      ) {
        return db
      }
      alterou = true
      return {
        ...db,
        favorecido: nomeCadastro,
        documentoFavorecido: documentoCadastro,
      }
    })

    if (alterou) aoMudar(atualizados)
    // Sincroniza favorecido quando nome/documento do cadastro mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomeCadastro, documentoCadastro])

  function adicionar() {
    aoMudar([
      ...dadosBancarios,
      {
        ...DADOS_BANCARIO_VAZIO,
        favorecidoIgualCadastro: true,
        favorecido: nomeCadastro,
        documentoFavorecido: documentoCadastro,
      },
    ])
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

      if (campo === 'favorecidoIgualCadastro' && valor === true) {
        return {
          ...item,
          favorecidoIgualCadastro: true,
          favorecido: nomeCadastro,
          documentoFavorecido: documentoCadastro,
        }
      }

      if (campo === 'favorecidoIgualCadastro' && valor === false) {
        return { ...item, favorecidoIgualCadastro: false }
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
            <ComboboxBanco valor={db.banco} aoMudar={(v) => atualizar(idx, 'banco', v)} disabled={disabled} />
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
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={db.favorecidoIgualCadastro}
              onChange={(e) => atualizar(idx, 'favorecidoIgualCadastro', e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">Favorecido e CPF/CNPJ iguais ao cadastro</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              rotulo="Favorecido"
              valor={db.favorecido}
              aoMudar={(v) => atualizar(idx, 'favorecido', v)}
              disabled={disabled || db.favorecidoIgualCadastro}
            />
            <Campo
              rotulo="CPF/CNPJ do favorecido"
              valor={db.documentoFavorecido}
              aoMudar={(v) => atualizar(idx, 'documentoFavorecido', mascaraDocumentoFavorecido(v))}
              disabled={disabled || db.favorecidoIgualCadastro}
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
        className={classesCampoCompacto}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  )
}
