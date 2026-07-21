'use client'

import { useCallback, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type CheckFiscal = 'ncm' | 'origem' | 'cst_cfop'

type RegrasFiscais = {
  versaoSchema: 1
  ativo: boolean
  checks: CheckFiscal[]
  observacao?: string | null
}

type ConfigFocus = {
  configurado: boolean
  homologacao: boolean
  apiTokenMascarado: string | null
  ultimaVersaoNfeRecebida: number
  fonte: string
  cnpjEmpresa?: string | null
  cnpjMascarado?: string | null
  nomeEmpresa?: string | null
  regrasFiscaisJson?: RegrasFiscais | null
}

type ResultadoTeste = {
  sucesso: boolean
  mensagem: string
  ambiente?: string
  fonte?: string
  cnpjMascarado?: string
} | null

const REGRAS_PADRAO: RegrasFiscais = {
  versaoSchema: 1,
  ativo: true,
  checks: ['ncm', 'origem', 'cst_cfop'],
  observacao:
    'Confere NCM, origem e CST/CFOP (NF × produto). Divergência NCM/origem: importar da NF. CST/CFOP: bloqueia — desconhecimento ou devolução.',
}

function formatarCnpjExibicao(cnpj: string | null | undefined): string {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function normalizarRegras(raw: RegrasFiscais | null | undefined): RegrasFiscais {
  if (!raw || typeof raw !== 'object') return { ...REGRAS_PADRAO }
  const checks = Array.isArray(raw.checks)
    ? raw.checks.filter((c): c is CheckFiscal =>
        c === 'ncm' || c === 'origem' || c === 'cst_cfop'
      )
    : [...REGRAS_PADRAO.checks]
  let observacao = (raw.observacao ?? '').trim()
  const mencionaPessoa =
    /preencher\s+com\s+paulo/i.test(observacao) ||
    (/\bpaulo\b/i.test(observacao) && !/s[aã]o\s+paulo/i.test(observacao))
  if (mencionaPessoa || /^preencher\b/i.test(observacao)) {
    observacao = REGRAS_PADRAO.observacao ?? ''
  }
  return {
    versaoSchema: 1,
    ativo: raw.ativo === true,
    checks: checks.length > 0 ? checks : [...REGRAS_PADRAO.checks],
    observacao,
  }
}

export function PainelConfiguracaoFocusNfe() {
  const [config, setConfig] = useState<ConfigFocus | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [apiToken, setApiToken] = useState('')
  const [homologacao, setHomologacao] = useState(true)
  const [mostrarToken, setMostrarToken] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [mensagemSalvo, setMensagemSalvo] = useState('')
  const [erroSalvo, setErroSalvo] = useState('')
  const [resultadoTeste, setResultadoTeste] = useState<ResultadoTeste>(null)

  const [fiscalAtivo, setFiscalAtivo] = useState(false)
  const [fiscalChecks, setFiscalChecks] = useState<CheckFiscal[]>([
    'ncm',
    'origem',
    'cst_cfop',
  ])
  const [fiscalObs, setFiscalObs] = useState('')
  const [salvandoFiscal, setSalvandoFiscal] = useState(false)
  const [mensagemFiscal, setMensagemFiscal] = useState('')
  const [erroFiscal, setErroFiscal] = useState('')

  const carregarConfig = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await clienteHttp.get<{ config: ConfigFocus }>('/focus-nfe/config')
      setConfig(data.config)
      setHomologacao(data.config.homologacao)
      const regras = normalizarRegras(data.config.regrasFiscaisJson)
      setFiscalAtivo(regras.ativo)
      setFiscalChecks(regras.checks)
      setFiscalObs(regras.observacao ?? '')
    } catch (err) {
      setErroSalvo(extrairMensagemApi(err, 'Não foi possível carregar a configuração Focus.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarConfig()
  }, [carregarConfig])

  function alternarCheck(check: CheckFiscal, ligado: boolean) {
    setFiscalChecks((atual) => {
      if (ligado) {
        return atual.includes(check) ? atual : [...atual, check]
      }
      return atual.filter((c) => c !== check)
    })
  }

  async function salvar() {
    if (!apiToken && !config?.configurado) {
      setErroSalvo('Informe o token Focus antes de salvar.')
      return
    }
    if (!apiToken && config?.configurado) {
      setErroSalvo('Para atualizar, insira o token novamente (não exibimos o token salvo).')
      return
    }

    setSalvando(true)
    setErroSalvo('')
    setMensagemSalvo('')
    setResultadoTeste(null)
    try {
      await clienteHttp.post('/focus-nfe/config', { apiToken, homologacao })
      setMensagemSalvo(
        'Configuração salva para esta empresa. Clique em “Testar conexão” para validar token + CNPJ.'
      )
      setApiToken('')
      await carregarConfig()
    } catch (err) {
      setErroSalvo(extrairMensagemApi(err, 'Erro ao salvar configuração Focus.'))
    } finally {
      setSalvando(false)
    }
  }

  async function testar() {
    setTestando(true)
    setResultadoTeste(null)
    setErroSalvo('')
    try {
      const { data } = await clienteHttp.post<ResultadoTeste>('/focus-nfe/testar-conexao')
      setResultadoTeste(data)
    } catch (err) {
      setResultadoTeste({
        sucesso: false,
        mensagem: extrairMensagemApi(err, 'Erro ao testar conexão Focus.'),
      })
    } finally {
      setTestando(false)
    }
  }

  async function salvarRegrasFiscais() {
    setSalvandoFiscal(true)
    setErroFiscal('')
    setMensagemFiscal('')
    try {
      await clienteHttp.put('/focus-nfe/regras-fiscais', {
        versaoSchema: 1,
        ativo: fiscalAtivo,
        checks: fiscalChecks,
        observacao: fiscalObs.trim() || null,
      })
      setMensagemFiscal(
        fiscalAtivo
          ? 'Regras fiscais ativas. Reanalise as notas em Entrada de Notas para aplicar.'
          : 'Regras fiscais salvas com análise desligada. O card Fiscal só avisa até reativar.'
      )
      await carregarConfig()
    } catch (err) {
      setErroFiscal(extrairMensagemApi(err, 'Erro ao salvar regras fiscais.'))
    } finally {
      setSalvandoFiscal(false)
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando configuração Focus…</p>
  }

  const temConfigEnv = config?.fonte === 'env'
  const temConfigSalva = config?.configurado && config.fonte === 'banco'
  const podeSalvarFiscal = config?.fonte === 'banco'

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">Configuração desta empresa ativa</span>
        {config?.nomeEmpresa ? ` — ${config.nomeEmpresa}` : ''}. CNPJ:{' '}
        <code>{formatarCnpjExibicao(config?.cnpjEmpresa)}</code>
        {config?.cnpjMascarado ? (
          <span className="text-muted-foreground"> (logs: {config.cnpjMascarado})</span>
        ) : null}
        . Token e CNPJ devem ser da <strong>mesma</strong> empresa no painel Focus; cada empresa do
        ERP tem seu próprio token.
      </p>

      {temConfigEnv && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Usando fallback <code>fonte=env</code> (
          {config?.apiTokenMascarado ? (
            <>
              fingerprint <code>{config.apiTokenMascarado}</code>, ambiente{' '}
              {config.homologacao ? 'homologação' : 'produção'}
            </>
          ) : (
            <>FOCUS_NFE_TOKEN</>
          )}
          ). O .env é global — <strong>salve o token abaixo nesta empresa</strong> (fonte=banco).
          Se o teste der 400 com CNPJ certo: Focus → Detalhes → habilitar{' '}
          <strong>manifestação / NFe recebidas</strong> (<code>habilita_manifestacao</code>).
        </p>
      )}

      {temConfigSalva && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          Token desta empresa no banco (fonte=banco)
          {config?.apiTokenMascarado ? (
            <>
              {' '}
              — fingerprint <code>{config.apiTokenMascarado}</code>
            </>
          ) : null}
          . Preferível ao .env.
        </p>
      )}

      {mensagemSalvo && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagemSalvo}</p>
      )}
      {erroSalvo && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erroSalvo}</p>
      )}

      <CardPadrao
        titulo="Credenciais Focus NFe"
        descricao="Preferível salvar por empresa (banco). Homologação marcada → token_homologacao; desmarcada → token_producao. Alinhe com o painel Focus."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="focus-token">
              Token{temConfigSalva ? ' (salvo — informe novo para alterar)' : ''}
            </Label>
            <div className="flex gap-2">
              <input
                id="focus-token"
                type={mostrarToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={
                  temConfigSalva
                    ? config.apiTokenMascarado ?? 'Token salvo'
                    : 'Cole o token_homologacao aqui'
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
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

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={homologacao}
              onChange={(e) => setHomologacao(e.target.checked)}
            />
            Ambiente de homologação (desmarque para produção)
          </label>

          {config && (
            <p className="text-xs text-muted-foreground">
              Fonte: {config.fonte}
              {config.apiTokenMascarado ? ` · fingerprint ${config.apiTokenMascarado}` : ''} · Ambiente:{' '}
              {config.homologacao ? 'homologação' : 'produção'} · Última versão DistDFe:{' '}
              {config.ultimaVersaoNfeRecebida}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <BotaoPrimario type="button" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </BotaoPrimario>
            <Button type="button" variant="outline" onClick={testar} disabled={testando}>
              {testando ? 'Testando…' : 'Testar conexão'}
            </Button>
          </div>

          {resultadoTeste && (
            <p
              className={
                resultadoTeste.sucesso
                  ? 'rounded-md bg-primary/10 px-3 py-2 text-sm text-primary'
                  : 'rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'
              }
            >
              {resultadoTeste.mensagem}
              {!resultadoTeste.sucesso &&
              /manifestação|habilita_manifestacao|não autorizado|nao autorizado/i.test(
                resultadoTeste.mensagem
              ) ? (
                <span className="mt-1 block text-xs opacity-90">
                  Checklist: (1) Focus → Documentos fiscais → ligar Recebimento de NFes (em homolog:
                  habilita_manifestacao_homologacao); (2) Salvar na Focus; (3) re-copiar token; (4)
                  Salvar neste painel; (5) Testar de novo.
                </span>
              ) : null}
              {resultadoTeste.fonte || resultadoTeste.cnpjMascarado ? (
                <span className="mt-1 block text-xs opacity-80">
                  {[
                    resultadoTeste.fonte ? `fonte=${resultadoTeste.fonte}` : null,
                    resultadoTeste.ambiente ? `ambiente=${resultadoTeste.ambiente}` : null,
                    resultadoTeste.cnpjMascarado
                      ? `cnpj=${resultadoTeste.cnpjMascarado}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Documentação:{' '}
            <a
              href="https://doc.focusnfe.com.br/reference/introducao"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Focus NFe API
            </a>
            {' · '}
            Manual interno: <code>MANUAL-FOCUS-NFE.md</code>
          </p>
        </div>
      </CardPadrao>

      <CardPadrao
        titulo="Análise fiscal (Entrada de Notas)"
        descricao="Documento Entrada de Notas: mantenha ativo com os três checks. Divergência NCM/origem → importar da NF (ou senha gerente). CST/CFOP ausente → só desconhecimento/devolução (não libera por senha). Não se aplica a NFS-e."
      >
        <div className="space-y-4">
          {!podeSalvarFiscal && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Salve o token Focus desta empresa (fonte=banco) antes de gravar as regras fiscais.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={fiscalAtivo}
              onChange={(e) => setFiscalAtivo(e.target.checked)}
              disabled={!podeSalvarFiscal}
            />
            Ativar análise fiscal
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium">Verificações</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fiscalChecks.includes('ncm')}
                onChange={(e) => alternarCheck('ncm', e.target.checked)}
                disabled={!podeSalvarFiscal}
              />
              NCM (NF × produto) — divergência bloqueia; dá para importar da NF na nota
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fiscalChecks.includes('origem')}
                onChange={(e) => alternarCheck('origem', e.target.checked)}
                disabled={!podeSalvarFiscal}
              />
              Código de origem — divergência bloqueia; dá para importar da NF na nota
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fiscalChecks.includes('cst_cfop')}
                onChange={(e) => alternarCheck('cst_cfop', e.target.checked)}
                disabled={!podeSalvarFiscal}
              />
              CST/CFOP — item sem CST ou CFOP na NF bloqueia (desconhecimento da operação ou
              devolução)
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fiscal-obs">Observação (interna)</Label>
            <textarea
              id="fiscal-obs"
              rows={2}
              value={fiscalObs}
              onChange={(e) => setFiscalObs(e.target.value)}
              disabled={!podeSalvarFiscal}
              placeholder="Ex.: conferência NCM/origem/CST-CFOP na entrada"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {mensagemFiscal && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
              {mensagemFiscal}
            </p>
          )}
          {erroFiscal && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroFiscal}
            </p>
          )}

          <BotaoPrimario
            type="button"
            onClick={salvarRegrasFiscais}
            disabled={salvandoFiscal || !podeSalvarFiscal}
          >
            {salvandoFiscal ? 'Salvando…' : 'Salvar regras fiscais'}
          </BotaoPrimario>
        </div>
      </CardPadrao>
    </div>
  )
}
