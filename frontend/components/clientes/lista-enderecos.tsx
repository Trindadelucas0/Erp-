'use client'

/**
 * Lista dinâmica de endereços.
 * Bloco fixo para o endereço principal + seção de entregas com apelido.
 * Cada endereço de entrega busca CEP via ViaCEP.
 */

import { Select, classesOption, classesSelectCompacto } from '@/components/ui/select'

export type EnderecoForm = {
  tipo: 'principal' | 'entrega'
  apelido: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  codigoIbge: string
}

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

export const ENDERECO_VAZIO: EnderecoForm = {
  tipo: 'entrega',
  apelido: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  codigoIbge: '',
}

type Props = {
  enderecos: EnderecoForm[]
  aoMudar: (enderecos: EnderecoForm[]) => void
  disabled?: boolean
  mensagemDeErro?: string
}

async function buscarCep(cep: string): Promise<Partial<EnderecoForm> | null> {
  const nums = cep.replace(/\D/g, '')
  if (nums.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`)
    const dados = await res.json()
    if (dados.erro) return null
    return {
      logradouro: dados.logradouro || '',
      bairro: dados.bairro || '',
      cidade: dados.localidade || '',
      estado: dados.uf || '',
      codigoIbge: dados.ibge || '',
    }
  } catch {
    return null
  }
}

function mascaraCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

function CampoEnderecoInput({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  maxLength,
  tipo,
  onBlur,
  disabled,
  colSpan,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  placeholder?: string
  maxLength?: number
  tipo?: string
  onBlur?: () => void
  disabled?: boolean
  colSpan?: number
}) {
  return (
    <div className={`space-y-1${colSpan ? ` sm:col-span-${colSpan}` : ''}`}>
      <label className="text-xs font-medium leading-none text-muted-foreground">{rotulo}</label>
      <input
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        type={tipo ?? 'text'}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
      />
    </div>
  )
}

function BlocoEndereco({
  endereco,
  idx,
  aoAtualizar,
  aoRemover,
  disabled,
  mostrarApelido,
}: {
  endereco: EnderecoForm
  idx: number
  aoAtualizar: (campo: keyof EnderecoForm, valor: string) => void
  aoRemover?: () => void
  disabled?: boolean
  mostrarApelido?: boolean
}) {
  async function aoSairCep() {
    const resultado = await buscarCep(endereco.cep)
    if (resultado) {
      Object.entries(resultado).forEach(([k, v]) => aoAtualizar(k as keyof EnderecoForm, v))
    }
  }

  return (
    <div className="space-y-3">
      {mostrarApelido && (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <CampoEnderecoInput
              rotulo='Apelido (ex: "Filial SP", "CD Norte")'
              valor={endereco.apelido}
              aoMudar={(v) => aoAtualizar('apelido', v)}
              placeholder="Nome para identificar este endereço"
              maxLength={100}
              disabled={disabled}
            />
          </div>
          {aoRemover && (
            <button
              type="button"
              onClick={aoRemover}
              disabled={disabled}
              className="mt-5 text-xs text-destructive hover:underline disabled:opacity-50"
            >
              Remover
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <CampoEnderecoInput
          rotulo="CEP"
          valor={endereco.cep}
          aoMudar={(v) => aoAtualizar('cep', mascaraCep(v))}
          onBlur={aoSairCep}
          placeholder="00000-000"
          maxLength={9}
          disabled={disabled}
        />
        <div className="sm:col-span-2">
          <CampoEnderecoInput
            rotulo="Logradouro"
            valor={endereco.logradouro}
            aoMudar={(v) => aoAtualizar('logradouro', v)}
            placeholder="Rua, Avenida, Travessa..."
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CampoEnderecoInput
          rotulo="Número"
          valor={endereco.numero}
          aoMudar={(v) => aoAtualizar('numero', v)}
          placeholder="123 ou S/N"
          maxLength={20}
          disabled={disabled}
        />
        <div className="sm:col-span-2">
          <CampoEnderecoInput
            rotulo="Complemento"
            valor={endereco.complemento}
            aoMudar={(v) => aoAtualizar('complemento', v)}
            placeholder="Sala, Apto, Bloco..."
            maxLength={100}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CampoEnderecoInput
          rotulo="Bairro"
          valor={endereco.bairro}
          aoMudar={(v) => aoAtualizar('bairro', v)}
          maxLength={100}
          disabled={disabled}
        />
        <CampoEnderecoInput
          rotulo="Cidade"
          valor={endereco.cidade}
          aoMudar={(v) => aoAtualizar('cidade', v)}
          maxLength={100}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium leading-none text-muted-foreground">Estado (UF)</label>
          <Select
            className={classesSelectCompacto}
            value={endereco.estado}
            onChange={(e) => aoAtualizar('estado', e.target.value)}
            disabled={disabled}
          >
            <option value="" className={classesOption}>Selecione</option>
            {ESTADOS_BR.map((uf) => (
              <option key={uf} value={uf} className={classesOption}>{uf}</option>
            ))}
          </Select>
        </div>
        <CampoEnderecoInput
          rotulo="Código IBGE"
          valor={endereco.codigoIbge}
          aoMudar={(v) => aoAtualizar('codigoIbge', v.replace(/\D/g, '').slice(0, 7))}
          placeholder="0000000"
          maxLength={7}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

export function ListaEnderecos({ enderecos, aoMudar, disabled, mensagemDeErro }: Props) {
  const principal = enderecos.find((e) => e.tipo === 'principal') ?? null
  const entregas = enderecos.filter((e) => e.tipo === 'entrega')

  function atualizarPrincipal(campo: keyof EnderecoForm, valor: string) {
    const idx = enderecos.findIndex((e) => e.tipo === 'principal')
    if (idx === -1) {
      aoMudar([...enderecos, { ...ENDERECO_VAZIO, tipo: 'principal', [campo]: valor }])
    } else {
      aoMudar(enderecos.map((e, i) => (i === idx ? { ...e, [campo]: valor } : e)))
    }
  }

  function adicionarEntrega() {
    aoMudar([...enderecos, { ...ENDERECO_VAZIO, tipo: 'entrega' }])
  }

  function atualizarEntrega(entregaIdx: number, campo: keyof EnderecoForm, valor: string) {
    let count = -1
    aoMudar(
      enderecos.map((e) => {
        if (e.tipo !== 'entrega') return e
        count++
        return count === entregaIdx ? { ...e, [campo]: valor } : e
      })
    )
  }

  function removerEntrega(entregaIdx: number) {
    let count = -1
    aoMudar(
      enderecos.filter((e) => {
        if (e.tipo !== 'entrega') return true
        count++
        return count !== entregaIdx
      })
    )
  }

  return (
    <div className="space-y-5">
      {mensagemDeErro && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensagemDeErro}
        </p>
      )}
      {/* Endereço principal */}
      <div>
        <p className="mb-3 text-sm font-medium">Endereço principal</p>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 mb-3">
          <p className="text-xs text-muted-foreground">
            O endereço completo é <strong>obrigatório para emissão de NF-e</strong>.
            Digite o CEP para preencher automaticamente.
          </p>
        </div>
        <BlocoEndereco
          endereco={
            principal ?? {
              ...ENDERECO_VAZIO,
              tipo: 'principal',
            }
          }
          idx={0}
          aoAtualizar={atualizarPrincipal}
          disabled={disabled}
          mostrarApelido={false}
        />
      </div>

      {/* Endereços de entrega */}
      {entregas.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Endereços de entrega</p>
          {entregas.map((entrega, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-3">
              <BlocoEndereco
                endereco={entrega}
                idx={i}
                aoAtualizar={(campo, valor) => atualizarEntrega(i, campo, valor)}
                aoRemover={() => removerEntrega(i)}
                disabled={disabled}
                mostrarApelido={true}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={adicionarEntrega}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Adicionar endereço de entrega
      </button>
    </div>
  )
}
