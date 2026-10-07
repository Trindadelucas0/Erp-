'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CircleDollarSign,
  Eye,
  EyeOff,
  Gavel,
  Link2,
  Save,
  Settings2,
} from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  formatarMoedaInput,
  formatarPercentualBr,
  parseNumeroBr,
} from '@/components/cartoes-pagamento/tipos-cartao'

type ParametroBoletoDetalhe = {
  id: string
  nome: string
  ativo: boolean
  padrao: boolean
  valorMinimo: number | null
  valorMaximo: number | null
  prazoMedioMaximoDias: number | null
  permitirParcelamento: boolean
  quantidadeMaximaParcelas: number | null
  multaAtrasoPercentual: number | null
  jurosAtrasoPercentualDia: number | null
  permitirPagamentoAposVencimento: boolean
  diasMaximosAposVencimento: number | null
  negativarAutomaticamente: boolean
  diasParaNegativar: number | null
  banco: string | null
  ambiente: string | null
  tipoIntegracao: string | null
  urlApi: string | null
  clientId: string | null
  clientSecretMascarado: string | null
  clientSecretDefinido: boolean
  certificadoNome: string | null
  ultimoTesteEm: string | null
  ultimoTesteSucesso: boolean | null
  ultimoTesteMensagem: string | null
}

const OPCOES_BANCO = [
  { value: 'itau', label: 'Itaú' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'banco_do_brasil', label: 'Banco do Brasil' },
  { value: 'santander', label: 'Santander' },
  { value: 'sicoob', label: 'Sicoob' },
  { value: 'c6', label: 'C6' },
] as const

const OPCOES_AMBIENTE = [
  { value: 'producao', label: 'Produção' },
  { value: 'homologacao', label: 'Homologação' },
] as const

type Props = {
  registroId: string | null
  aoCancelar: () => void
  aoSalvo: () => void
  podeSalvar: boolean
}

function formatarDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function numeroParaCampo(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return ''
  return String(valor)
}

function moedaParaCampo(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return ''
  return formatarMoedaInput(valor)
}

function percentualParaCampo(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return ''
  return formatarPercentualBr(valor)
}

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => {
      const resultado = leitor.result
      if (typeof resultado !== 'string') {
        reject(new Error('Leitura inválida'))
        return
      }
      resolve(resultado)
    }
    leitor.onerror = () => reject(leitor.error ?? new Error('Erro ao ler arquivo'))
    leitor.readAsDataURL(arquivo)
  })
}

export function FormularioParametrosBoleto({
  registroId,
  aoCancelar,
  aoSalvo,
  podeSalvar,
}: Props) {
  const [carregando, setCarregando] = useState(Boolean(registroId))
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [resultadoTeste, setResultadoTeste] = useState<{
    sucesso: boolean
    mensagem: string
  } | null>(null)

  const [nome, setNome] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [padrao, setPadrao] = useState(false)
  const [valorMinimo, setValorMinimo] = useState('')
  const [valorMaximo, setValorMaximo] = useState('')
  const [prazoMedioMaximoDias, setPrazoMedioMaximoDias] = useState('')
  const [permitirParcelamento, setPermitirParcelamento] = useState(false)
  const [quantidadeMaximaParcelas, setQuantidadeMaximaParcelas] = useState('')
  const [multaAtrasoPercentual, setMultaAtrasoPercentual] = useState('')
  const [jurosAtrasoPercentualDia, setJurosAtrasoPercentualDia] = useState('')
  const [permitirPagamentoAposVencimento, setPermitirPagamentoAposVencimento] =
    useState(false)
  const [diasMaximosAposVencimento, setDiasMaximosAposVencimento] = useState('')
  const [negativarAutomaticamente, setNegativarAutomaticamente] = useState(false)
  const [diasParaNegativar, setDiasParaNegativar] = useState('')
  const [banco, setBanco] = useState('')
  const [ambiente, setAmbiente] = useState('producao')
  const [urlApi, setUrlApi] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [mostrarSegredo, setMostrarSegredo] = useState(false)
  const [segredoMascarado, setSegredoMascarado] = useState<string | null>(null)
  const [segredoDefinido, setSegredoDefinido] = useState(false)
  const [certificadoNome, setCertificadoNome] = useState<string | null>(null)
  const [certificadoBase64, setCertificadoBase64] = useState<string | null>(null)
  const [certificadoMime, setCertificadoMime] = useState<string | null>(null)
  const [certificadoNomeArquivo, setCertificadoNomeArquivo] = useState<string | null>(
    null
  )
  const [removerCertificado, setRemoverCertificado] = useState(false)
  const [ultimoTesteEm, setUltimoTesteEm] = useState<string | null>(null)

  const aplicarResposta = useCallback((p: ParametroBoletoDetalhe) => {
    setNome(p.nome)
    setAtivo(p.ativo)
    setPadrao(p.padrao)
    setValorMinimo(moedaParaCampo(p.valorMinimo))
    setValorMaximo(moedaParaCampo(p.valorMaximo))
    setPrazoMedioMaximoDias(numeroParaCampo(p.prazoMedioMaximoDias))
    setPermitirParcelamento(p.permitirParcelamento)
    setQuantidadeMaximaParcelas(numeroParaCampo(p.quantidadeMaximaParcelas))
    setMultaAtrasoPercentual(percentualParaCampo(p.multaAtrasoPercentual))
    setJurosAtrasoPercentualDia(percentualParaCampo(p.jurosAtrasoPercentualDia))
    setPermitirPagamentoAposVencimento(p.permitirPagamentoAposVencimento)
    setDiasMaximosAposVencimento(numeroParaCampo(p.diasMaximosAposVencimento))
    setNegativarAutomaticamente(p.negativarAutomaticamente)
    setDiasParaNegativar(numeroParaCampo(p.diasParaNegativar))
    setBanco(p.banco ?? '')
    setAmbiente(p.ambiente ?? 'producao')
    setUrlApi(p.urlApi ?? '')
    setClientId(p.clientId ?? '')
    setClientSecret('')
    setSegredoMascarado(p.clientSecretMascarado)
    setSegredoDefinido(p.clientSecretDefinido)
    setCertificadoNome(p.certificadoNome)
    setCertificadoBase64(null)
    setCertificadoMime(null)
    setCertificadoNomeArquivo(null)
    setRemoverCertificado(false)
    setUltimoTesteEm(p.ultimoTesteEm)
    if (p.ultimoTesteMensagem && p.ultimoTesteSucesso != null) {
      setResultadoTeste({
        sucesso: p.ultimoTesteSucesso,
        mensagem: p.ultimoTesteMensagem,
      })
    } else {
      setResultadoTeste(null)
    }
  }, [])

  useEffect(() => {
    if (!registroId) {
      setCarregando(false)
      return
    }
    let cancelado = false
    ;(async () => {
      setCarregando(true)
      setErro('')
      try {
        const { data } = await clienteHttp.get<{ parametro: ParametroBoletoDetalhe }>(
          `/parametros-boleto/${registroId}`
        )
        if (!cancelado) aplicarResposta(data.parametro)
      } catch (err) {
        if (!cancelado) {
          setErro(extrairMensagemApi(err, 'Não foi possível carregar o parâmetro.'))
        }
      } finally {
        if (!cancelado) setCarregando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [registroId, aplicarResposta])

  async function aoSelecionarCertificado(arquivo: File | null) {
    if (!arquivo) return
    setRemoverCertificado(false)
    try {
      const base64 = await lerArquivoComoBase64(arquivo)
      setCertificadoBase64(base64)
      setCertificadoMime(arquivo.type || 'application/octet-stream')
      setCertificadoNomeArquivo(arquivo.name)
      setCertificadoNome(arquivo.name)
    } catch {
      setErro('Não foi possível ler o certificado.')
    }
  }

  function montarPayload() {
    const min = valorMinimo.trim() ? parseNumeroBr(valorMinimo) : null
    const max = valorMaximo.trim() ? parseNumeroBr(valorMaximo) : null
    const prazo = prazoMedioMaximoDias.trim()
      ? parseInt(prazoMedioMaximoDias, 10)
      : null
    const parcelas = quantidadeMaximaParcelas.trim()
      ? parseInt(quantidadeMaximaParcelas, 10)
      : null
    const multa = multaAtrasoPercentual.trim()
      ? parseNumeroBr(multaAtrasoPercentual)
      : null
    const juros = jurosAtrasoPercentualDia.trim()
      ? parseNumeroBr(jurosAtrasoPercentualDia)
      : null
    const diasApos = diasMaximosAposVencimento.trim()
      ? parseInt(diasMaximosAposVencimento, 10)
      : null
    const diasNeg = diasParaNegativar.trim() ? parseInt(diasParaNegativar, 10) : null

    return {
      nome: nome.trim(),
      ativo,
      padrao,
      valorMinimo: min != null && !Number.isNaN(min) ? min : null,
      valorMaximo: max != null && !Number.isNaN(max) ? max : null,
      prazoMedioMaximoDias: prazo != null && !Number.isNaN(prazo) ? prazo : null,
      permitirParcelamento,
      quantidadeMaximaParcelas: parcelas != null && !Number.isNaN(parcelas) ? parcelas : null,
      multaAtrasoPercentual: multa != null && !Number.isNaN(multa) ? multa : null,
      jurosAtrasoPercentualDia: juros != null && !Number.isNaN(juros) ? juros : null,
      permitirPagamentoAposVencimento,
      diasMaximosAposVencimento: diasApos != null && !Number.isNaN(diasApos) ? diasApos : null,
      negativarAutomaticamente,
      diasParaNegativar: diasNeg != null && !Number.isNaN(diasNeg) ? diasNeg : null,
      banco: banco || null,
      ambiente: ambiente || null,
      tipoIntegracao: 'api' as const,
      urlApi: urlApi.trim() || null,
      clientId: clientId.trim() || null,
      clientSecret: clientSecret.trim() || null,
      certificadoBase64: certificadoBase64 ?? undefined,
      certificadoMime: certificadoMime ?? undefined,
      certificadoNomeArquivo: certificadoNomeArquivo ?? undefined,
      removerCertificado,
    }
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    setMensagem('')
    setResultadoTeste(null)
    try {
      const payload = montarPayload()
      if (registroId) {
        await clienteHttp.put(`/parametros-boleto/${registroId}`, payload)
      } else {
        await clienteHttp.post('/parametros-boleto', payload)
      }
      aoSalvo()
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar parâmetros de boleto.'))
    } finally {
      setSalvando(false)
    }
  }

  async function testarConexao() {
    if (!registroId) return
    setTestando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post<{
        sucesso: boolean
        mensagem: string
        ultimoTesteEm?: string
      }>(`/parametros-boleto/${registroId}/testar-conexao`)
      setResultadoTeste({ sucesso: data.sucesso, mensagem: data.mensagem })
      if (data.ultimoTesteEm) setUltimoTesteEm(data.ultimoTesteEm)
    } catch (err) {
      const msg = extrairMensagemApi(err, 'Erro ao testar conexão.')
      setErro(msg)
      setResultadoTeste({ sucesso: false, mensagem: msg })
    } finally {
      setTestando(false)
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>
  }

  const desabilitado = !podeSalvar

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={aoCancelar}>
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
        Voltar à lista
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">
            {registroId ? 'Editar parâmetro' : 'Novo parâmetro de boleto'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Limites, encargos e credenciais da API do banco.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <BotaoPrimario
            type="button"
            onClick={() => void salvar()}
            disabled={desabilitado || salvando}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {salvando ? 'Salvando…' : 'Salvar'}
          </BotaoPrimario>
        </div>
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {mensagem && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{mensagem}</p>
      )}

      <CardPadrao titulo="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputPadrao
            rotulo="Nome do parâmetro"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={desabilitado}
            placeholder="Ex.: Itaú produção"
            obrigatorio
          />
          <div className="flex flex-wrap items-end gap-4 pt-6 sm:pt-0">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                disabled={desabilitado}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Ativo
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={padrao}
                onChange={(e) => setPadrao(e.target.checked)}
                disabled={desabilitado}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Padrão da empresa
            </label>
          </div>
        </div>
      </CardPadrao>

      <CardPadrao titulo="Limites financeiros">
        <p className="-mt-2 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleDollarSign className="h-4 w-4 text-primary" aria-hidden />
          Valores e prazos para emissão de boletos.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InputPadrao
            rotulo="Valor mínimo do boleto"
            value={valorMinimo}
            onChange={(e) => setValorMinimo(e.target.value)}
            disabled={desabilitado}
            placeholder="0,00"
          />
          <InputPadrao
            rotulo="Valor máximo do boleto"
            value={valorMaximo}
            onChange={(e) => setValorMaximo(e.target.value)}
            disabled={desabilitado}
            placeholder="0,00"
          />
          <InputPadrao
            rotulo="Prazo médio máximo em dias"
            type="number"
            min={1}
            value={prazoMedioMaximoDias}
            onChange={(e) => setPrazoMedioMaximoDias(e.target.value)}
            disabled={desabilitado}
          />
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={permitirParcelamento}
              onChange={(e) => setPermitirParcelamento(e.target.checked)}
              disabled={desabilitado}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Permitir parcelamento
          </label>
          <div className="pl-6 sm:max-w-xs">
            <InputPadrao
              rotulo="Quantidade máxima de parcelas"
              type="number"
              min={1}
              value={quantidadeMaximaParcelas}
              onChange={(e) => setQuantidadeMaximaParcelas(e.target.value)}
              disabled={desabilitado || !permitirParcelamento}
            />
          </div>
        </div>
      </CardPadrao>

      <div className="grid gap-6 lg:grid-cols-2">
        <CardPadrao titulo="Cobrança (Multa e Juros)">
          <p className="-mt-2 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Gavel className="h-4 w-4 text-primary" aria-hidden />
            Encargos por atraso de pagamento.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputPadrao
              rotulo="Multa por atraso"
              value={multaAtrasoPercentual}
              onChange={(e) => setMultaAtrasoPercentual(e.target.value)}
              disabled={desabilitado}
              placeholder="0,00"
            />
            <InputPadrao
              rotulo="Juros por atraso (% ao mês)"
              value={jurosAtrasoPercentualDia}
              onChange={(e) => setJurosAtrasoPercentualDia(e.target.value)}
              disabled={desabilitado}
              placeholder="0,0000"
            />
          </div>
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={permitirPagamentoAposVencimento}
                onChange={(e) => setPermitirPagamentoAposVencimento(e.target.checked)}
                disabled={desabilitado}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Permitir pagamento após vencimento
            </label>
            <div className="pl-6 sm:max-w-xs">
              <InputPadrao
                rotulo="Dias máximos após vencimento"
                type="number"
                min={1}
                value={diasMaximosAposVencimento}
                onChange={(e) => setDiasMaximosAposVencimento(e.target.value)}
                disabled={desabilitado || !permitirPagamentoAposVencimento}
              />
            </div>
            <label className="flex flex-wrap cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={negativarAutomaticamente}
                onChange={(e) => setNegativarAutomaticamente(e.target.checked)}
                disabled={desabilitado}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Negativar automaticamente após
              <input
                type="number"
                min={1}
                value={diasParaNegativar}
                onChange={(e) => setDiasParaNegativar(e.target.value)}
                disabled={desabilitado || !negativarAutomaticamente}
                className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
              />
              dias
            </label>
          </div>
        </CardPadrao>

        <CardPadrao titulo="API com o banco">
          <p className="-mt-2 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Settings2 className="h-4 w-4 text-primary" aria-hidden />
            Credenciais e certificado para integração futura.
          </p>
          <div className="space-y-4">
            <SelectPadrao
              rotulo="Banco"
              valor={banco}
              aoMudar={setBanco}
              opcoes={OPCOES_BANCO}
              disabled={desabilitado}
              placeholder="Selecione o banco"
            />
            <SelectPadrao
              rotulo="Ambiente"
              valor={ambiente}
              aoMudar={setAmbiente}
              opcoes={OPCOES_AMBIENTE}
              disabled={desabilitado}
            />
            <SelectPadrao
              rotulo="Tipo de integração"
              valor="api"
              aoMudar={() => {}}
              opcoes={[{ value: 'api', label: 'API (Web Service)' }]}
              disabled
            />
            <InputPadrao
              rotulo="URL da API"
              value={urlApi}
              onChange={(e) => setUrlApi(e.target.value)}
              disabled={desabilitado}
              placeholder="https://"
            />
            <InputPadrao
              rotulo="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={desabilitado}
            />
            <div className="space-y-1.5">
              <Label htmlFor="client-secret-boleto-form">Client Secret</Label>
              <div className="relative">
                <input
                  id="client-secret-boleto-form"
                  type={mostrarSegredo ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  disabled={desabilitado}
                  placeholder={
                    !clientSecret && segredoDefinido && segredoMascarado
                      ? segredoMascarado
                      : '••••••••'
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-10 text-sm"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setMostrarSegredo((v) => !v)}
                  tabIndex={-1}
                  aria-label={mostrarSegredo ? 'Ocultar segredo' : 'Mostrar segredo'}
                >
                  {mostrarSegredo ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Certificado digital (mTLS)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={desabilitado} asChild>
                  <label className="cursor-pointer">
                    Selecionar arquivo
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pem,.crt,.cer,.pfx,.p12"
                      disabled={desabilitado}
                      onChange={(e) => void aoSelecionarCertificado(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </Button>
                <span className="text-sm text-muted-foreground">
                  {certificadoNome ?? 'Nenhum arquivo selecionado'}
                </span>
                {certificadoNome && !desabilitado && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRemoverCertificado(true)
                      setCertificadoNome(null)
                      setCertificadoBase64(null)
                    }}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={desabilitado || testando || !registroId}
              title={!registroId ? 'Salve o parâmetro para testar a conexão' : undefined}
              onClick={() => void testarConexao()}
            >
              <Link2 className="mr-2 h-4 w-4" aria-hidden />
              {testando ? 'Testando…' : 'Testar conexão'}
            </Button>
            {!registroId && (
              <p className="text-xs text-muted-foreground">
                Salve o parâmetro uma vez para habilitar o teste de conexão.
              </p>
            )}
            {resultadoTeste && (
              <div
                className={cn(
                  'rounded-md px-3 py-2 text-sm',
                  resultadoTeste.sucesso
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border border-destructive/30 bg-destructive/10 text-destructive'
                )}
              >
                <p>{resultadoTeste.mensagem}</p>
                {ultimoTesteEm && (
                  <p className="mt-1 text-xs opacity-80">
                    Último teste em {formatarDataHoraBr(ultimoTesteEm)}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardPadrao>
      </div>
    </div>
  )
}
