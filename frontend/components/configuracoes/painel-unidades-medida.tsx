'use client'

import { useCallback, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { usePermissao } from '@/hooks/use-permissao'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'

type UnidadeMedida = {
  id: string
  sigla: string
  nome: string
}

export function PainelUnidadesMedida() {
  const podeCriar = usePermissao('produtos:create')

  const [unidades, setUnidades] = useState<UnidadeMedida[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mostrarCadastro, setMostrarCadastro] = useState(false)
  const [sigla, setSigla] = useState('')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get('/produtos/unidades-medida')
      setUnidades(data.unidades ?? [])
    } catch (err: unknown) {
      setUnidades([])
      setErro(extrairMensagemApi(err, 'Não foi possível carregar as unidades.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function cadastrarUnidade() {
    setErro('')
    setMensagem('')
    setSalvando(true)
    try {
      await clienteHttp.post('/produtos/unidades-medida', {
        sigla: sigla.trim().toUpperCase(),
        nome: nome.trim(),
      })
      setSigla('')
      setNome('')
      setMostrarCadastro(false)
      setMensagem('Unidade cadastrada.')
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao cadastrar unidade'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <CardPadrao
      titulo="Unidades de medida"
      descricao="Catálogo usado na unidade de venda, unidade na entrada e unidade logística do produto."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Cadastre novas unidades aqui. No produto, só é possível selecionar.
          </p>
          {podeCriar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMostrarCadastro((v) => !v)
                setErro('')
                setMensagem('')
              }}
            >
              {mostrarCadastro ? 'Fechar formulário' : '+ Nova unidade'}
            </Button>
          )}
        </div>

        {mostrarCadastro && podeCriar && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
            <InputPadrao
              rotulo="Sigla *"
              value={sigla}
              onChange={(e) => setSigla(e.target.value.toUpperCase())}
              placeholder="Ex.: UN"
              maxLength={10}
            />
            <InputPadrao
              rotulo="Nome da unidade *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Unidade"
            />
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMostrarCadastro(false)}
              >
                Cancelar
              </Button>
              <BotaoPrimario
                type="button"
                disabled={salvando || sigla.trim().length < 1 || nome.trim().length < 2}
                onClick={() => void cadastrarUnidade()}
              >
                {salvando ? 'Salvando...' : 'Cadastrar'}
              </BotaoPrimario>
            </div>
          </div>
        )}

        {mensagem && <p className="text-sm text-green-700 dark:text-green-400">{mensagem}</p>}
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[320px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium">Sigla</th>
                <th className="px-4 py-3 font-medium">Nome</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={2} linhas={5} />
              ) : unidades.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhuma unidade cadastrada.
                  </td>
                </tr>
              ) : (
                unidades.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{u.sigla}</td>
                    <td className="px-4 py-3">{u.nome}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CardPadrao>
  )
}
