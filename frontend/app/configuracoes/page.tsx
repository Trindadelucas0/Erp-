'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useAtalhos } from '@/components/compartilhado/provedor-de-atalhos'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { usePermissao } from '@/hooks/use-permissao'
import { PortaoAssinaturaComSenha } from '@/components/compartilhado/portao-assinatura-com-senha'
import { PainelConfiguracaoZapsign } from '@/components/assinatura-zapsign/painel-configuracao-zapsign'
import { ListaDocumentosZapsign } from '@/components/assinatura-zapsign/lista-documentos-zapsign'
import { PainelConfiguracaoFocusNfe } from '@/components/focus-nfe/painel-configuracao-focus-nfe'
import { PainelUnidadesMedida } from '@/components/configuracoes/painel-unidades-medida'
import { ConteudoDaPaginaCfops } from '@/app/cfops/conteudo-pagina-cfops'
import { ConteudoDaPaginaPlanosFinanceiros } from '@/app/planos-financeiros/conteudo-pagina-planos-financeiros'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Abas } from '@/components/ui/abas'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
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

type AbaConfig = 'geral' | 'vendas' | 'logistica' | 'financeiro' | 'fiscal'
type SecaoFiscal = 'cfop' | 'buscador'

const ABAS_ASSINATURA = [
  { id: 'configuracao', rotulo: 'Configuração' },
  { id: 'documentos', rotulo: 'Documentos' },
]

const ABAS_FISCAL = [
  { id: 'cfop', rotulo: 'CFOP' },
  { id: 'buscador', rotulo: 'Buscador de NF' },
]

function extrairMensagemDeErro(erro: unknown, mensagemPadrao: string): string {
  const resposta = (erro as { response?: { data?: { message?: string } } })
    ?.response?.data?.message
  return resposta || mensagemPadrao
}

function PlaceholderAba({ nome }: { nome: string }) {
  return (
    <CardPadrao titulo={nome} descricao="Parâmetros desta área.">
      <p className="text-sm text-muted-foreground">
        Nenhuma configuração nesta aba ainda.
      </p>
    </CardPadrao>
  )
}

function SecaoAssinaturaDigital() {
  const [abaAtiva, setAbaAtiva] = useState('configuracao')

  return (
    <CardPadrao
      titulo="Assinatura digital"
      descricao="Integração ZapSign — envio de documentos para assinatura eletrônica."
    >
      <div className="space-y-4">
        <Abas abas={ABAS_ASSINATURA} abaAtiva={abaAtiva} aoMudar={setAbaAtiva} />
        {abaAtiva === 'configuracao' && <PainelConfiguracaoZapsign />}
        {abaAtiva === 'documentos' && (
          <PortaoAssinaturaComSenha descricao="Para visualizar o status e enviar documentos de assinatura, confirme sua senha de administrador.">
            <ListaDocumentosZapsign />
          </PortaoAssinaturaComSenha>
        )}
      </div>
    </CardPadrao>
  )
}

function SecaoAtalhosTeclado() {
  const { recarregarAtalhos } = useAtalhos()
  const [atalhos, setAtalhos] = useState<AtalhoConfigurado[]>(montarAtalhosPadrao())
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [capturandoAcao, setCapturandoAcao] = useState<ChaveDaAcao | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<'acao' | 'tecla' | 'ativo'>()

  const acoesExibidas = useMemo(
    () =>
      ordenarLista([...REGISTRO_DE_ACOES], ordenacao, (def, coluna) => {
        const atalho = atalhos.find((a) => a.acao === def.chave)
        switch (coluna) {
          case 'acao':
            return def.rotulo
          case 'tecla':
            return atalho?.tecla ?? ''
          case 'ativo':
            return atalho?.ativo ? 1 : 0
        }
      }),
    [atalhos, ordenacao]
  )

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
    void carregarAtalhos()
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
    <CardPadrao
      titulo="Atalhos de teclado"
      descricao="Clique em Capturar tecla e pressione a combinação desejada. Esc cancela a captura."
    >
      {mensagem && (
        <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {mensagem}
        </p>
      )}
      {erro && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {duplicatas.length > 0 && (
        <p className="mb-3 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Teclas duplicadas:{' '}
          {duplicatas
            .map(([tecla, acoes]) => `${formatarTeclaParaExibicao(tecla)} (${acoes.join(', ')})`)
            .join('; ')}
        </p>
      )}

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <CabecalhoColunaOrdenavel
                    className="px-4 py-3"
                    rotulo="Ação"
                    coluna="acao"
                    ordenacao={ordenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                  <CabecalhoColunaOrdenavel
                    className="px-4 py-3"
                    rotulo="Tecla"
                    coluna="tecla"
                    ordenacao={ordenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                  <CabecalhoColunaOrdenavel
                    className="px-4 py-3"
                    rotulo="Ativo"
                    coluna="ativo"
                    ordenacao={ordenacao}
                    onOrdenar={alternarOrdenacao}
                  />
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {acoesExibidas.map((def) => {
                  const atalho = atalhos.find((a) => a.acao === def.chave)
                  if (!atalho) return null
                  const conflito = teclaTemConflitoNavegador(atalho.tecla)

                  return (
                    <tr key={def.chave} className="border-b border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium">{def.rotulo}</p>
                        <p className="text-xs text-muted-foreground">{def.descricao}</p>
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
                          onChange={(e) => alterarAtivo(def.chave, e.target.checked)}
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
              onClick={() => void salvar()}
              disabled={salvando || duplicatas.length > 0}
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </BotaoPrimario>
            <Button
              type="button"
              variant="outline"
              onClick={() => void restaurarPadroes()}
              disabled={salvando}
            >
              Restaurar padrões
            </Button>
          </div>
        </div>
      )}
    </CardPadrao>
  )
}

function ConteudoDaPaginaDeConfiguracoes() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { perfil } = useSessaoDoUsuario()
  const ehAdmin = perfil?.ehAdmin === true
  const podeFinanceiro = usePermissao('financeiro:view')
  const podeConfig = usePermissao('configuracoes:view')

  const podeProdutos = usePermissao('produtos:view')
  const podeGeral = ehAdmin || podeConfig
  const podeAssinatura = ehAdmin
  const podeAtalhos = ehAdmin || podeConfig
  const podeLogistica = ehAdmin || podeConfig || podeProdutos
  const podeFinanceiroAba = ehAdmin || podeFinanceiro
  const podeFiscalCfop = ehAdmin || podeFinanceiro
  const podeBuscadorNf = ehAdmin
  const podeFiscal = podeFiscalCfop || podeBuscadorNf

  const abasDisponiveis = useMemo(() => {
    const lista: Array<{ id: AbaConfig; rotulo: string }> = []
    if (podeGeral || podeAssinatura || podeAtalhos) {
      lista.push({ id: 'geral', rotulo: 'Geral' })
    }
    if (ehAdmin) {
      lista.push({ id: 'vendas', rotulo: 'Vendas' })
    }
    if (podeLogistica) lista.push({ id: 'logistica', rotulo: 'Logística' })
    if (podeFinanceiroAba) lista.push({ id: 'financeiro', rotulo: 'Financeiro' })
    if (podeFiscal) lista.push({ id: 'fiscal', rotulo: 'Fiscal' })
    return lista
  }, [
    podeGeral,
    podeAssinatura,
    podeAtalhos,
    ehAdmin,
    podeLogistica,
    podeFinanceiroAba,
    podeFiscal,
  ])

  const abaParam = searchParams.get('aba') as AbaConfig | null
  const secaoParam = searchParams.get('secao') as SecaoFiscal | null

  const abaAtiva: AbaConfig = useMemo(() => {
    if (abaParam && abasDisponiveis.some((a) => a.id === abaParam)) return abaParam
    return abasDisponiveis[0]?.id ?? 'geral'
  }, [abaParam, abasDisponiveis])

  const secoesFiscal = useMemo(() => {
    return ABAS_FISCAL.filter((s) => {
      if (s.id === 'cfop') return podeFiscalCfop
      if (s.id === 'buscador') return podeBuscadorNf
      return false
    })
  }, [podeFiscalCfop, podeBuscadorNf])

  const secaoFiscal: SecaoFiscal = useMemo(() => {
    if (secaoParam && secoesFiscal.some((s) => s.id === secaoParam)) return secaoParam
    return (secoesFiscal[0]?.id as SecaoFiscal) ?? 'cfop'
  }, [secaoParam, secoesFiscal])

  function mudarAba(id: string) {
    const params = new URLSearchParams()
    params.set('aba', id)
    if (id === 'fiscal' && secaoFiscal) params.set('secao', secaoFiscal)
    router.replace(`/configuracoes?${params.toString()}`)
  }

  function mudarSecaoFiscal(id: string) {
    router.replace(`/configuracoes?aba=fiscal&secao=${id}`)
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Parâmetros do sistema organizados por área
        </p>
      </div>

      <Abas abas={abasDisponiveis} abaAtiva={abaAtiva} aoMudar={mudarAba} />

      {abaAtiva === 'geral' && (
        <div className="space-y-6">
          {podeAssinatura && <SecaoAssinaturaDigital />}
          {podeAtalhos && <SecaoAtalhosTeclado />}
          {!podeAssinatura && !podeAtalhos && (
            <p className="text-sm text-muted-foreground">
              Sem permissão para os parâmetros gerais.
            </p>
          )}
        </div>
      )}

      {abaAtiva === 'vendas' && <PlaceholderAba nome="Vendas" />}

      {abaAtiva === 'logistica' && podeLogistica && <PainelUnidadesMedida />}

      {abaAtiva === 'financeiro' && podeFinanceiroAba && (
        <ConteudoDaPaginaPlanosFinanceiros />
      )}

      {abaAtiva === 'fiscal' && podeFiscal && (
        <div className="space-y-4">
          <Abas abas={secoesFiscal} abaAtiva={secaoFiscal} aoMudar={mudarSecaoFiscal} />
          {secaoFiscal === 'cfop' && podeFiscalCfop && <ConteudoDaPaginaCfops />}
          {secaoFiscal === 'buscador' && podeBuscadorNf && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Buscador de NF</h2>
                <p className="text-sm text-muted-foreground">
                  Token e ambiente Focus NFe para notas recebidas (Entrada de Notas)
                </p>
              </div>
              <PainelConfiguracaoFocusNfe />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PaginaDeConfiguracoes() {
  return (
    <ProtegerRota chaveDaPagina="configuracoes">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <ConteudoDaPaginaDeConfiguracoes />
      </Suspense>
    </ProtegerRota>
  )
}
