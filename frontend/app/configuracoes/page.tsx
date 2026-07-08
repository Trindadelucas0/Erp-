'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useAtalhos } from '@/components/compartilhado/provedor-de-atalhos'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { REGISTRO_DE_ACOES } from '@/lib/atalhos/registro-de-acoes'
import {
  montarAtalhosPadrao,
  teclaTemConflitoNavegador,
} from '@/lib/atalhos/atalhos-padrao'
import {
  formatarTeclaParaExibicao,
  interpretarTecla,
  normalizarTecla,
} from '@/lib/atalhos/interpretar-tecla'
import type { AtalhoConfigurado, ChaveDaAcao } from '@/lib/atalhos/tipos'

function extrairMensagemDeErro(erro: unknown, mensagemPadrao: string): string {
  const resposta = (erro as { response?: { data?: { message?: string } } })
    ?.response?.data?.message
  return resposta || mensagemPadrao
}

function ConteudoDaPaginaDeConfiguracoes() {
  const { recarregarAtalhos } = useAtalhos()
  const [atalhos, setAtalhos] = useState<AtalhoConfigurado[]>(montarAtalhosPadrao())
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [capturandoAcao, setCapturandoAcao] = useState<ChaveDaAcao | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const carregarAtalhos = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await clienteHttp.get<{ atalhos: AtalhoConfigurado[] }>(
        '/configuracoes/atalhos'
      )
      setAtalhos(data.atalhos)
    } catch {
      setAtalhos(montarAtalhosPadrao())
      setErro('Não foi possível carregar os atalhos. Exibindo padrões locais.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarAtalhos()
  }, [carregarAtalhos])

  useEffect(() => {
    if (!capturandoAcao) return

    function aoCapturarTecla(evento: KeyboardEvent) {
      evento.preventDefault()
      evento.stopPropagation()

      if (evento.key === 'Escape') {
        setCapturandoAcao(null)
        return
      }

      const tecla = interpretarTecla(evento)
      if (!tecla || ['Control', 'Alt', 'Shift', 'Meta'].includes(evento.key)) {
        return
      }

      setAtalhos((lista) =>
        lista.map((item) =>
          item.acao === capturandoAcao
            ? { ...item, tecla: normalizarTecla(tecla) }
            : item
        )
      )
      setCapturandoAcao(null)
    }

    document.addEventListener('keydown', aoCapturarTecla, true)
    return () => document.removeEventListener('keydown', aoCapturarTecla, true)
  }, [capturandoAcao])

  const duplicatas = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const atalho of atalhos) {
      if (!atalho.ativo) continue
      const tecla = normalizarTecla(atalho.tecla)
      const lista = mapa.get(tecla) ?? []
      lista.push(atalho.acao)
      mapa.set(tecla, lista)
    }
    return [...mapa.entries()].filter(([, acoes]) => acoes.length > 1)
  }, [atalhos])

  function alterarAtivo(acao: ChaveDaAcao, ativo: boolean) {
    setAtalhos((lista) =>
      lista.map((item) => (item.acao === acao ? { ...item, ativo } : item))
    )
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    setMensagem('')
    try {
      const { data } = await clienteHttp.put<{ atalhos: AtalhoConfigurado[] }>(
        '/configuracoes/atalhos',
        { atalhos }
      )
      setAtalhos(data.atalhos)
      await recarregarAtalhos()
      setMensagem('Atalhos salvos com sucesso.')
    } catch (err) {
      setErro(extrairMensagemDeErro(err, 'Erro ao salvar atalhos'))
    } finally {
      setSalvando(false)
    }
  }

  async function restaurarPadroes() {
    setSalvando(true)
    setErro('')
    setMensagem('')
    try {
      const { data } = await clienteHttp.post<{ atalhos: AtalhoConfigurado[] }>(
        '/configuracoes/atalhos/restaurar-padroes'
      )
      setAtalhos(data.atalhos)
      await recarregarAtalhos()
      setMensagem('Atalhos restaurados para o padrão.')
    } catch (err) {
      setErro(extrairMensagemDeErro(err, 'Erro ao restaurar padrões'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Defina os atalhos de teclado usados em todo o sistema
        </p>
      </div>

      <CardPadrao
        titulo="Assinatura Digital"
        descricao="Configure a integração ZapSign para envio de documentos para assinatura eletrônica."
        acoes={
          <Link href="/configuracoes/assinatura">
            <Button variant="outline" size="sm">
              Acessar
            </Button>
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Gerencie API key, ambiente sandbox/produção e acompanhe documentos enviados.
        </p>
      </CardPadrao>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {mensagem}
        </p>
      )}
      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {duplicatas.length > 0 && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Teclas duplicadas:{' '}
          {duplicatas
            .map(([tecla, acoes]) => `${formatarTeclaParaExibicao(tecla)} (${acoes.join(', ')})`)
            .join('; ')}
        </p>
      )}

      <CardPadrao
        titulo="Atalhos de teclado"
        descricao="Clique em Capturar tecla e pressione a combinação desejada. Esc cancela a captura."
      >
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Ação</th>
                    <th className="px-4 py-3 text-left font-medium">Tecla</th>
                    <th className="px-4 py-3 text-left font-medium">Ativo</th>
                    <th className="px-4 py-3 text-left font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {REGISTRO_DE_ACOES.map((def) => {
                    const atalho = atalhos.find((a) => a.acao === def.chave)
                    if (!atalho) return null
                    const conflito = teclaTemConflitoNavegador(atalho.tecla)

                    return (
                      <tr key={def.chave} className="border-b border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium">{def.rotulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {def.descricao}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <kbd className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
                            {formatarTeclaParaExibicao(atalho.tecla)}
                          </kbd>
                          {conflito && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                              Pode conflitar com o navegador
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={atalho.ativo}
                            onChange={(e) =>
                              alterarAtivo(def.chave, e.target.checked)
                            }
                            className="size-4 rounded border-input"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCapturandoAcao(def.chave)}
                          >
                            {capturandoAcao === def.chave
                              ? 'Pressione uma tecla...'
                              : 'Capturar tecla'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <BotaoPrimario
                type="button"
                onClick={salvar}
                disabled={salvando || duplicatas.length > 0}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </BotaoPrimario>
              <Button
                type="button"
                variant="outline"
                onClick={restaurarPadroes}
                disabled={salvando}
              >
                Restaurar padrões
              </Button>
            </div>
          </div>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaDeConfiguracoes() {
  return (
    <ProtegerRota somenteAdmin>
      <ConteudoDaPaginaDeConfiguracoes />
    </ProtegerRota>
  )
}
