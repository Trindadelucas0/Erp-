'use client'

import { useCallback, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Label } from '@/components/ui/label'
import { classesCampoLista } from '@/components/ui/classes-campo'

type ConfigZapsign = {
  configurado: boolean
  sandbox: boolean
  apiTokenMascarado: string | null
  webhookSecret: string | null
  fonte: string
}

type ResultadoTeste = {
  sucesso: boolean
  mensagem: string
  ambiente?: string
  totalDocumentos?: number
} | null

const extrairMensagem = extrairMensagemApi

export function PainelConfiguracaoZapsign() {
  const [config, setConfig] = useState<ConfigZapsign | null>(null)
  const [carregando, setCarregando] = useState(true)

  const [apiToken, setApiToken] = useState('')
  const [sandbox, setSandbox] = useState(true)
  const [webhookSecret, setWebhookSecret] = useState('')
  const [mostrarToken, setMostrarToken] = useState(false)

  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)

  const [mensagemSalvo, setMensagemSalvo] = useState('')
  const [erroSalvo, setErroSalvo] = useState('')
  const [resultadoTeste, setResultadoTeste] = useState<ResultadoTeste>(null)

  const carregarConfig = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await clienteHttp.get<{ config: ConfigZapsign }>('/zapsign/config')
      setConfig(data.config)
      setSandbox(data.config.sandbox)
      setWebhookSecret(data.config.webhookSecret ?? '')
    } catch (err) {
      setErroSalvo(extrairMensagem(err, 'Não foi possível carregar a configuração.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarConfig()
  }, [carregarConfig])

  async function salvar() {
    if (!apiToken && !config?.configurado) {
      setErroSalvo('Informe o API token antes de salvar.')
      return
    }

    setSalvando(true)
    setErroSalvo('')
    setMensagemSalvo('')
    setResultadoTeste(null)

    try {
      const corpo: Record<string, unknown> = { sandbox, webhookSecret }
      if (apiToken) corpo.apiToken = apiToken

      if (!apiToken && config?.configurado) {
        setErroSalvo('Para atualizar, insira o token novamente (não exibimos o token salvo por segurança).')
        return
      }

      await clienteHttp.post('/zapsign/config', corpo)
      setMensagemSalvo('Configuração salva com sucesso.')
      setApiToken('')
      await carregarConfig()
    } catch (err) {
      setErroSalvo(extrairMensagem(err, 'Erro ao salvar configuração.'))
    } finally {
      setSalvando(false)
    }
  }

  async function testar() {
    setTestando(true)
    setResultadoTeste(null)
    setErroSalvo('')

    try {
      const { data } = await clienteHttp.post<ResultadoTeste>('/zapsign/testar-conexao')
      setResultadoTeste(data)
    } catch (err) {
      const mensagem = extrairMensagem(err, 'Erro ao testar conexão.')
      setResultadoTeste({ sucesso: false, mensagem })
    } finally {
      setTestando(false)
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando configuração...</p>
  }

  const temConfigSalva = config?.configurado && config.fonte === 'banco'
  const temConfigEnv = config?.fonte === 'env'

  return (
    <div className="space-y-4">
      {temConfigEnv && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          API key carregada da variável de ambiente <code>ZAPSIGN_API_TOKEN</code>. Para
          gerenciar pelo painel, salve uma nova configuração abaixo.
        </p>
      )}

      {mensagemSalvo && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {mensagemSalvo}
        </p>
      )}
      {erroSalvo && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erroSalvo}
        </p>
      )}

      <CardPadrao
        titulo="Credenciais ZapSign"
        descricao="Configure a API key da sua conta ZapSign. O token não é exibido após salvar."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-token">
              API Token{temConfigSalva ? ' (salvo — insira novo para alterar)' : ''}
            </Label>
            <div className="flex gap-2">
              <input
                id="api-token"
                type={mostrarToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={
                  temConfigSalva
                    ? config.apiTokenMascarado ?? 'Token salvo'
                    : 'Cole sua API key aqui'
                }
                className={classesCampoLista}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMostrarToken((v) => !v)}
                className="shrink-0"
              >
                {mostrarToken ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
          </div>

          <InputPadrao
            rotulo="Webhook Secret (opcional)"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Chave secreta para validar webhooks"
          />

          <div className="flex items-center gap-3">
            <input
              id="sandbox"
              type="checkbox"
              checked={sandbox}
              onChange={(e) => setSandbox(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="sandbox" className="cursor-pointer">
              Usar ambiente de testes (sandbox)
              <span className="ml-1 text-xs text-muted-foreground">
                — desmarque para produção
              </span>
            </Label>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <BotaoPrimario
              type="button"
              onClick={salvar}
              disabled={salvando || testando}
            >
              {salvando ? 'Salvando...' : 'Salvar configuração'}
            </BotaoPrimario>

            <Button
              type="button"
              variant="outline"
              onClick={testar}
              disabled={testando || salvando || !config?.configurado}
              title={!config?.configurado ? 'Salve uma configuração antes de testar' : undefined}
            >
              {testando ? 'Testando...' : 'Testar conexão'}
            </Button>
          </div>
        </div>
      </CardPadrao>

      {resultadoTeste && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            resultadoTeste.sucesso
              ? 'bg-primary/10 text-primary'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          <p className="font-medium">
            {resultadoTeste.sucesso ? '✓ Conexão bem-sucedida' : '✗ Falha na conexão'}
          </p>
          <p>{resultadoTeste.mensagem}</p>
          {resultadoTeste.sucesso && resultadoTeste.totalDocumentos !== undefined && (
            <p className="text-xs opacity-70">
              Ambiente: {resultadoTeste.ambiente} · {resultadoTeste.totalDocumentos} documento(s) na conta
            </p>
          )}
        </div>
      )}

      <CardPadrao titulo="Como obter sua API key" descricao="">
        <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            Acesse{' '}
            <a
              href="https://app.zapsign.com.br/conta/integracoes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              app.zapsign.com.br → Integrações
            </a>
          </li>
          <li>Copie o <strong>API Token</strong> exibido na página</li>
          <li>Para testes, mantenha <strong>Sandbox</strong> marcado</li>
          <li>
            Para produção, desmarque Sandbox — a conta precisa de um{' '}
            <a
              href="https://app.zapsign.com.br/conta/configuracoes?tab=plans"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              plano API ativo
            </a>
          </li>
        </ol>
      </CardPadrao>
    </div>
  )
}
