'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'

export type UnidadeMedidaOpcao = {
  id: string
  sigla: string
  nome: string
}

type Props = {
  valor: string
  aoMudar: (sigla: string) => void
  disabled?: boolean
  obrigatorio?: boolean
  rotulo?: string
}

export function SelecaoUnidadeMedida({
  valor,
  aoMudar,
  disabled,
  obrigatorio,
  rotulo = 'Unidade *',
}: Props) {
  const [unidades, setUnidades] = useState<UnidadeMedidaOpcao[]>([])
  const [mostrarCadastro, setMostrarCadastro] = useState(false)
  const [novaSigla, setNovaSigla] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get('/produtos/unidades-medida')
      setUnidades(data.unidades ?? [])
    } catch {
      setUnidades([])
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function cadastrarUnidade() {
    setErro('')
    setSalvando(true)
    try {
      const { data } = await clienteHttp.post('/produtos/unidades-medida', {
        sigla: novaSigla.trim().toUpperCase(),
        nome: novoNome.trim(),
      })
      await carregar()
      aoMudar(data.unidade.sigla)
      setNovaSigla('')
      setNovoNome('')
      setMostrarCadastro(false)
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao cadastrar unidade'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <SelectPadrao
            rotulo={rotulo}
            valor={valor}
            aoMudar={aoMudar}
            obrigatorio={obrigatorio}
            opcoes={unidades.map((u) => ({
              value: u.sigla,
              label: `${u.sigla} — ${u.nome}`,
            }))}
            disabled={disabled}
          />
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-0.5 shrink-0"
            onClick={() => setMostrarCadastro((v) => !v)}
          >
            <Plus className="mr-1 size-4" />
            Nova unidade
          </Button>
        )}
      </div>

      {mostrarCadastro && !disabled && (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
          <InputPadrao
            rotulo="Sigla *"
            value={novaSigla}
            onChange={(e) => setNovaSigla(e.target.value.toUpperCase())}
            placeholder="Ex.: UN"
            maxLength={10}
          />
          <InputPadrao
            rotulo="Nome da unidade *"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Ex.: Unidade"
          />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMostrarCadastro(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={salvando || novaSigla.trim().length < 1 || novoNome.trim().length < 2}
              onClick={() => void cadastrarUnidade()}
            >
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </div>
          {erro && <p className="sm:col-span-2 text-sm text-destructive">{erro}</p>}
        </div>
      )}
    </div>
  )
}
