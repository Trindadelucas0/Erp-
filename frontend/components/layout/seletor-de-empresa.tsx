'use client'

import { useEffect, useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import type { EmpresaDaSessao } from '@/types/sessao'

export function SeletorDeEmpresa() {
  const { perfil } = useSessaoDoUsuario()
  const [empresaAtiva, setEmpresaAtiva] = useState<EmpresaDaSessao | null>(null)
  const [aberto, setAberto] = useState(false)

  const empresas = perfil?.empresas ?? []

  useEffect(() => {
    if (empresas.length === 0) return

    const idSalvo = localStorage.getItem('empresaAtivaId')
    const encontrada = empresas.find((e) => e.company.id === idSalvo)
    setEmpresaAtiva(encontrada ?? empresas[0])
  }, [empresas])

  if (empresas.length <= 1) {
    return empresaAtiva ? (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Building2 className="size-4 shrink-0" />
        <span className="max-w-[160px] truncate">{empresaAtiva.company.name}</span>
      </div>
    ) : null
  }

  function selecionarEmpresa(empresa: EmpresaDaSessao) {
    localStorage.setItem('empresaAtivaId', empresa.company.id)
    setEmpresaAtiva(empresa)
    setAberto(false)
    window.location.reload()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Building2 className="size-4 shrink-0" />
        <span className="max-w-[140px] truncate">
          {empresaAtiva?.company.name ?? 'Selecionar empresa'}
        </span>
        <ChevronDown className="size-3 shrink-0" />
      </button>

      {aberto && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setAberto(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-md border border-border bg-popover py-1 shadow-md">
            {empresas.map((e) => (
              <button
                key={e.company.id}
                type="button"
                onClick={() => selecionarEmpresa(e)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                  empresaAtiva?.company.id === e.company.id
                    ? 'text-primary font-medium'
                    : 'text-foreground'
                }`}
              >
                <div className="font-medium">{e.company.name}</div>
                <div className="text-xs text-muted-foreground">{e.company.cnpj}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
