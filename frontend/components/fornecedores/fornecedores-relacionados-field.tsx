'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { mascaraCnpj, mascaraCpf } from '@/lib/documentos'
import { useFecharAoSairComMouse } from '@/lib/dropdown-catalogo'
import { TextoDestaqueBusca } from '@/components/ui/texto-destaque-busca'

export type FornecedorRelacionadoItem = {
  dadosFornecedorId: string
  pessoaId: string
  nome: string
  documento: string | null
  vinculoDireto: boolean
}

type FornecedorBusca = {
  id: string
  dadosFornecedorId: string | null
  nome: string
  cpf?: string | null
  cnpj?: string | null
}

type Props = {
  pessoaIdAtual?: string
  relacionados: FornecedorRelacionadoItem[]
  vinculadosDiretosIds: string[]
  aoMudarVinculosDiretos: (ids: string[], relacionados: FornecedorRelacionadoItem[]) => void
  disabled?: boolean
}

function formatarDocumento(cpf?: string | null, cnpj?: string | null): string {
  if (cnpj) return mascaraCnpj(cnpj)
  if (cpf) return mascaraCpf(cpf)
  return ''
}

export function FornecedoresRelacionadosField({
  pessoaIdAtual,
  relacionados,
  vinculadosDiretosIds,
  aoMudarVinculosDiretos,
  disabled,
}: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<FornecedorBusca[]>([])
  const [abrindo, setAbrindo] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fechar = useCallback(() => setAbrindo(false), [])
  const zonaHover = useFecharAoSairComMouse(fechar, [ref])

  useEffect(() => {
    if (!abrindo) return
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        fechar()
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [abrindo, fechar])

  useEffect(() => {
    if (!abrindo) return
    const timer = setTimeout(async () => {
      setCarregando(true)
      try {
        const { data } = await clienteHttp.get('/fornecedores', {
          params: { q: busca.trim() },
        })
        const lista = (data.fornecedores ?? []) as FornecedorBusca[]
        const idsJaNaRede = new Set(relacionados.map((r) => r.dadosFornecedorId))
        setResultados(
          lista.filter(
            (f) =>
              f.dadosFornecedorId &&
              f.id !== pessoaIdAtual &&
              !idsJaNaRede.has(f.dadosFornecedorId)
          )
        )
      } catch {
        setResultados([])
      } finally {
        setCarregando(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [busca, abrindo, pessoaIdAtual, relacionados])

  function adicionar(fornecedor: FornecedorBusca) {
    if (!fornecedor.dadosFornecedorId) return
    const novo: FornecedorRelacionadoItem = {
      dadosFornecedorId: fornecedor.dadosFornecedorId,
      pessoaId: fornecedor.id,
      nome: fornecedor.nome,
      documento: fornecedor.cnpj ?? fornecedor.cpf ?? null,
      vinculoDireto: true,
    }
    const novosRelacionados = [...relacionados, novo].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    )
    aoMudarVinculosDiretos([...vinculadosDiretosIds, fornecedor.dadosFornecedorId], novosRelacionados)
    setBusca('')
    setAbrindo(false)
  }

  function removerDireto(dadosFornecedorId: string) {
    const novosIds = vinculadosDiretosIds.filter((id) => id !== dadosFornecedorId)
    const novosRelacionados = relacionados.filter(
      (r) => r.dadosFornecedorId !== dadosFornecedorId || !r.vinculoDireto
    )
    aoMudarVinculosDiretos(novosIds, novosRelacionados)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">
        Fornecedores vinculados (mesmo grupo econômico)
      </label>
      <p className="text-xs text-muted-foreground">
        Vincule CNPJs diferentes do mesmo representante. O vínculo é bidirecional e transitivo na
        rede — útil para cruzar pedido de compra e entrada de nota com CNPJs distintos.
      </p>

      <div className="relative" ref={ref} {...zonaHover}>
        <div className="flex items-center gap-2">
          <input
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              if (!abrindo) setAbrindo(true)
            }}
            onFocus={() => setAbrindo(true)}
            placeholder="Buscar fornecedor por nome ou CNPJ/CPF..."
            disabled={disabled}
          />
          <Search className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
        </div>

        {abrindo && !disabled && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background shadow-md">
            {carregando && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
            )}
            {!carregando && busca.trim() && resultados.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum fornecedor encontrado</p>
            )}
            {!carregando && !busca.trim() && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Digite para buscar</p>
            )}
            {resultados.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                onMouseDown={(e) => {
                  e.preventDefault()
                  adicionar(item)
                }}
              >
                <TextoDestaqueBusca texto={item.nome} termo={busca} className="font-medium" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {formatarDocumento(item.cpf, item.cnpj)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {relacionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {relacionados.map((item) => (
            <span
              key={item.dadosFornecedorId}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
            >
              <span className="font-medium">{item.nome}</span>
              {item.documento && (
                <span className="font-mono text-muted-foreground">
                  {item.documento.length > 11 ? mascaraCnpj(item.documento) : mascaraCpf(item.documento)}
                </span>
              )}
              <span
                className={
                  item.vinculoDireto
                    ? 'rounded bg-primary/15 px-1 text-[10px] text-primary'
                    : 'rounded bg-muted px-1 text-[10px] text-muted-foreground'
                }
              >
                {item.vinculoDireto ? 'vínculo direto' : 'via rede'}
              </span>
              {item.vinculoDireto && !disabled && (
                <button
                  type="button"
                  onClick={() => removerDireto(item.dadosFornecedorId)}
                  className="text-destructive"
                  aria-label={`Remover vínculo com ${item.nome}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
