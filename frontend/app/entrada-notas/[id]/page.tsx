'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { Abas } from '@/components/ui/abas'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'
import { BarraCarregamentoDownload } from '@/components/entrada-notas/barra-carregamento-download'
import { ItemVinculoCadastroGrid } from '@/components/entrada-notas/item-vinculo-cadastro-grid'
import {
  ItemVinculoFiscalGrid,
  type CfopOpcaoEntrada,
} from '@/components/entrada-notas/item-vinculo-fiscal-grid'
import { CfopEntradaFreteCampos } from '@/components/entrada-notas/cfop-entrada-frete'
import { CheckCircle2 } from 'lucide-react'
import { distribuirParcelasIguais } from '@/lib/parcelas-pagamento-pedido'
import {
  ehDocumentalEntrada,
  prefixoPdfDocumento,
  rotuloTipoDocumentoLongo,
} from '@/lib/tipo-documento-entrada'
import { gravarDeepLinkFornecedor } from '@/lib/fornecedor-deep-link'
import type { StatusDaAba } from '@/hooks/use-validacao-de-abas'

type ResultadoEtapa = {
  status: string
  avisos: string[]
  bloqueios: string[]
  bloqueiosNaoLiberaveis?: string[]
  exigeManifesto?: boolean
}

type Analise = {
  cadastro: ResultadoEtapa
  fiscal: ResultadoEtapa
  negociacao: ResultadoEtapa
  frete?: ResultadoEtapa
  autoLancado?: boolean
  motivoParada?: string | null
}

type ItemNota = {
  id: string
  nItem: number
  descricao: string | null
  gtin: string | null
  codigoProduto: string | null
  unidade?: string | null
  ncm: string | null
  cfop: string | null
  cst: string | null
  origem: string | null
  quantidade: number | null
  valorUnitario: number | null
  valorTotal: number | null
  pesoKg?: number | null
  custoFreteRateado?: number | null
  produtoId: string | null
  vinculoModo: string | null
  criticaCadastro: boolean
  criticaFiscal: boolean
  criticaNegociacao: boolean
  /** cProd da NF já está em ProdutoFornecedor.codigoFornecedor */
  codigoOriginalGravado?: boolean
  /** Código do fornecedor gravado no vínculo produto × fornecedor */
  codigoFornecedorVinculo?: string | null
  /** Múltiplo de compra (itens por embalagem) do vínculo produto × fornecedor da nota; 1 quando não configurado */
  itensPorEmbalagem?: number
  /** quantidade (NF) × itensPorEmbalagem — prévia da quantidade em unidade de venda */
  qtdTotalUn?: number | null
  cfopEntrada: { id: string; codigo: string; nome: string } | null
  produto: {
    id: string
    nomeVenda: string
    sku: string | null
    codigoBarras: string | null
    marca: string | null
    unidade: string | null
    ncm: string | null
    codigoOrigem: string | null
  } | null
}

type ParcelaFinanceiroFrete = {
  numeroDocumento: string
  vencimento: string
  valor: string
}

type FinanceiroStub = {
  id: string
  numeroDocumento: string | null
  vencimento: string | null
  valor: number | null
  status: string
  parcelas?: Array<{
    numeroDocumento: string | null
    vencimento: string | null
    valor: number | null
  }>
}

type SugestaoFinanceiroFrete = {
  numeroDocumento: string | null
  valor: number | null
}

type CteVinculado = {
  id: string
  origemVinculo: string
  chaveNfeReferenciada: string | null
  valorFrete: number | null
  cfop?: string | null
  cfopEntrada?: { id: string; codigo: string; nome: string } | null
  sugestaoFinanceiroFrete?: SugestaoFinanceiroFrete | null
  icms?: {
    baseCalculoIcms: number | null
    aliquotaIcms: number | null
    valorIcms: number | null
  } | null
  financeiro?: FinanceiroStub | null
  cte: {
    id: string
    chaveNfe: string
    nomeEmitente: string | null
    documentoEmitente: string | null
    valorTotal: number | null
    dataEmissao: string | null
    statusEntrada: string
  } | null
}

type TransporteXml = {
  qtdVolumes: number | null
  pesoBruto: number | null
  pesoLiquido: number | null
  valorFreteNf: number | null
}

type TratativaNota = {
  id: string
  texto: string
  createdAt: string
  usuario: { id: string; name: string; email: string } | null
}

type DetalheNota = {
  id: string
  chaveNfe: string
  tipoDocumento?: string | null
  nomeEmitente: string | null
  documentoEmitente: string | null
  valorTotal: number | null
  dataEmissao: string | null
  statusEntrada: string
  manifestacaoDestinatario?: string | null
  origem: string
  etapaAtual: string
  criticasLiberadas: boolean
  observacaoContato: string | null
  pedidoCompraId: string | null
  origemLancamento: string | null
  prazoPagamentoXml: string | null
  prazoPagamentoTexto: string | null
  problemaDesfecho?: string | null
  problemaMarcadoEm?: string | null
  problemaResolvidoEm?: string | null
  tratativas?: TratativaNota[]
  modFrete?: string | null
  chaveNfeReferenciada?: string | null
  cfopXml?: string | null
  cfopEntrada?: { id: string; codigo: string; nome: string } | null
  sugestaoFinanceiroFrete?: SugestaoFinanceiroFrete | null
  exigeCte?: boolean
  regraRateioFrete?: string | null
  transporteXml?: TransporteXml | null
  fornecedor: {
    id: string
    nome: string
    cnpj: string | null
    nomeFantasia: string | null
    tipoRevenda?: boolean
    tipoConsumo?: boolean
    tipoPrestadorServico?: boolean
    exigirItensEntrada?: boolean
    permitirVinculoManual?: boolean
    modoDocumental?: boolean
  } | null
  analise: Analise | null
  ctesVinculados?: CteVinculado[]
  nfesVinculadas?: Array<{
    id: string
    origemVinculo: string
    nfe: { id: string; chaveNfe: string; nomeEmitente: string | null; valorTotal: number | null; statusEntrada: string } | null
  }>
  despesasFrete?: Array<{
    id: string
    valor: number | null
    status: string
    origem: string
    pessoaId: string | null
    numeroDocumento?: string | null
    vencimento?: string | null
    parcelas?: Array<{
      numeroDocumento: string | null
      vencimento: string | null
      valor: number | null
    }>
  }>
  itens: ItemNota[]
}

type ProdutoBusca = {
  id: string
  nomeVenda: string
  sku?: string | null
  codigoBarras?: string | null
  marca?: string | null
}

type AbaId = 'cadastro' | 'fiscal' | 'negociacao' | 'frete' | 'lancamento'

type EtapaPipeline = 'cadastro' | 'fiscal' | 'negociacao' | 'frete'

const ORDEM_ETAPAS: EtapaPipeline[] = ['cadastro', 'fiscal', 'negociacao', 'frete']

const ROTULOS_ETAPA: Record<EtapaPipeline, string> = {
  cadastro: 'Cadastro',
  fiscal: 'Fiscal',
  negociacao: 'Negociação',
  frete: 'Frete / CT-e',
}

function statusAbaDeEtapa(etapa?: ResultadoEtapa | null): StatusDaAba {
  if (!etapa || etapa.status === 'pendente') return 'idle'
  if (etapa.status === 'ok') return 'valid'
  if (etapa.status === 'bloqueante') return 'error'
  return 'idle'
}

function abasValidasParaNota(nota: DetalheNota): AbaId[] {
  if (nota.tipoDocumento === 'nfse') return ['cadastro', 'lancamento']
  if (nota.tipoDocumento === 'cte') return ['cadastro', 'frete', 'lancamento']
  return ['cadastro', 'fiscal', 'negociacao', 'frete', 'lancamento']
}

function abaInicial(nota: DetalheNota): AbaId {
  const etapa = nota.etapaAtual
  const motivo = nota.analise?.motivoParada
  if (nota.statusEntrada === 'entrada_contagem' || nota.statusEntrada === 'entrada_consolidada') {
    return 'lancamento'
  }
  // Gate frete (modFrete=1 sem CT-e) ou CT-e aguardando NF
  if (motivo === 'frete' || motivo === 'vinculo_nfe' || etapa === 'frete') return 'frete'
  if (motivo === 'negociacao' || etapa === 'negociacao') return 'negociacao'
  if (motivo === 'fiscal' || etapa === 'fiscal') return 'fiscal'
  if (motivo === 'cadastro' || etapa === 'cadastro' || etapa === 'servico') return 'cadastro'
  if (etapa === 'lancamento') return 'lancamento'
  return 'cadastro'
}

function resolverAbaInicial(nota: DetalheNota, abaQuery: string | null): AbaId {
  const validas = abasValidasParaNota(nota)
  if (abaQuery && validas.includes(abaQuery as AbaId)) {
    return abaQuery as AbaId
  }
  return abaInicial(nota)
}

/** Posição efetiva no pipeline — nota finalizada conta como além do fim (pode voltar de qualquer etapa). */
function etapaEfetiva(nota: DetalheNota): EtapaPipeline | 'lancamento' {
  if (nota.statusEntrada === 'entrada_contagem' || nota.statusEntrada === 'entrada_consolidada') {
    return 'lancamento'
  }
  const motivo = nota.analise?.motivoParada
  if (motivo === 'cadastro' || motivo === 'fiscal' || motivo === 'negociacao' || motivo === 'frete') {
    return motivo
  }
  const etapa = nota.etapaAtual
  if (etapa === 'cadastro' || etapa === 'fiscal' || etapa === 'negociacao' || etapa === 'frete') {
    return etapa
  }
  return 'lancamento'
}

/** Etapas anteriores à posição atual — únicas para as quais faz sentido "voltar". */
function etapasVoltarDisponiveis(nota: DetalheNota, ehDocumental: boolean): EtapaPipeline[] {
  if (
    nota.statusEntrada === 'cancelada' ||
    nota.statusEntrada === 'com_problema' ||
    nota.statusEntrada === 'problema_resolvido'
  ) {
    return []
  }
  const validas: EtapaPipeline[] = ehDocumental ? ['cadastro'] : ORDEM_ETAPAS
  const atual = etapaEfetiva(nota)
  const indiceAtual = atual === 'lancamento' ? ORDEM_ETAPAS.length : ORDEM_ETAPAS.indexOf(atual)
  return validas.filter((e) => ORDEM_ETAPAS.indexOf(e) < indiceAtual)
}

/** Mensagem explícita após Reanalisar / Buscar NF (não deixa a ação “muda”). */
function mensagemAposAnalisar(nota: DetalheNota): string | null {
  const motivo = nota.analise?.motivoParada
  const tipo = nota.tipoDocumento

  if (tipo === 'cte') {
    const vinculos = nota.nfesVinculadas ?? []
    if (vinculos.length > 0) {
      const chave = vinculos[0]?.nfe?.chaveNfe
      return `CT-e vinculado à NF …${chave?.slice(-8) ?? ''}. Custo entra na análise da mercadoria.`
    }
    if (motivo === 'vinculo_nfe') {
      const bloqueio = nota.analise?.negociacao?.bloqueios?.[0]
      if (bloqueio) return bloqueio
      if (nota.chaveNfeReferenciada) {
        return `Focus não trouxe a NF …${nota.chaveNfeReferenciada.slice(-8)}. Importe o XML — o sistema vincula sozinho.`
      }
      return 'CT-e sem chave de NF no XML. Vincule manualmente pela NF de mercadoria.'
    }
    if (motivo === 'cadastro') {
      const b = nota.analise?.cadastro?.bloqueios?.[0]
      return b ? `Parou em cadastro: ${b}` : 'Parou em cadastro: cadastre a transportadora.'
    }
    return 'CT-e reanalisado.'
  }

  if (motivo === 'cadastro') {
    const b = nota.analise?.cadastro?.bloqueios?.[0]
    return b ? `Parou em cadastro: ${b}` : 'Parou em cadastro.'
  }
  if (motivo === 'fiscal') {
    const b =
      nota.analise?.fiscal?.bloqueios?.[0] ??
      nota.analise?.fiscal?.bloqueiosNaoLiberaveis?.[0]
    return b ? `Parou em fiscal: ${b}` : 'Parou em fiscal.'
  }
  if (motivo === 'negociacao') {
    const b = nota.analise?.negociacao?.bloqueios?.[0]
    return b ? `Parou em negociação: ${b}` : 'Parou em negociação.'
  }
  if (motivo === 'frete') {
    const b = nota.analise?.frete?.bloqueios?.[0]
    return b
      ? `Parou em frete: ${b}`
      : 'Parou em frete: vincule o CT-e (frete por conta do destinatário).'
  }

  if (nota.origemLancamento === 'automatica') {
    return 'Entrada automática concluída (Liberar para contagem).'
  }
  if (
    nota.statusEntrada === 'entrada_contagem' ||
    nota.statusEntrada === 'entrada_consolidada'
  ) {
    return `Nota lançada: ${nota.statusEntrada}.`
  }
  if (!motivo) return 'Reanálise concluída — sem bloqueios nesta etapa.'
  return `Reanálise concluída (parada: ${motivo}).`
}

function rotuloModFrete(mod: string | null | undefined): string {
  const m = (mod ?? '').trim()
  const mapa: Record<string, string> = {
    '0': '0 — Remetente',
    '1': '1 — Destinatário',
    '2': '2 — Terceiros',
    '3': '3 — Próprio remetente',
    '4': '4 — Próprio destinatário',
    '9': '9 — Sem frete',
  }
  return mapa[m] ?? (m || '—')
}

function rotuloRegraRateio(regra: string | null | undefined): string {
  const r = (regra ?? '').trim().toLowerCase()
  if (!r) return '—'
  const mapa: Record<string, string> = {
    valor: 'Por valor',
    peso: 'Por peso',
    quantidade: 'Por quantidade',
    igual: 'Igual entre itens',
  }
  return mapa[r] ?? r
}

function bloqueioRegraRateioAusente(etapa?: ResultadoEtapa | null): boolean {
  return (etapa?.bloqueios ?? []).some((b) =>
    b.toLowerCase().includes('regra de rateio')
  )
}

function formatNumBr(n: number | null | undefined, casas = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

function formatMoedaBr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TOLERANCIA_PARCELAS_FRETE = 0.01

function parcelaFinanceiroVazia(): ParcelaFinanceiroFrete {
  return { numeroDocumento: '', vencimento: '', valor: '' }
}

function stubParaParcelasUi(
  stub:
    | {
        numeroDocumento?: string | null
        vencimento?: string | null
        valor?: number | null
        parcelas?: Array<{
          numeroDocumento: string | null
          vencimento: string | null
          valor: number | null
        }>
      }
    | null
    | undefined,
  defaults: { numeroDocumento?: string; valor?: number | null }
): ParcelaFinanceiroFrete[] {
  if (stub?.parcelas && stub.parcelas.length > 0) {
    return stub.parcelas.map((p) => ({
      numeroDocumento: p.numeroDocumento ?? '',
      vencimento: p.vencimento ?? '',
      valor: p.valor != null && Number.isFinite(p.valor) ? String(p.valor) : '',
    }))
  }
  const valor =
    stub?.valor ?? defaults.valor ?? null
  return [
    {
      numeroDocumento: stub?.numeroDocumento ?? defaults.numeroDocumento ?? '',
      vencimento: stub?.vencimento ?? '',
      valor: valor != null && Number.isFinite(valor) ? String(valor) : '',
    },
  ]
}

function somaParcelasFinanceiro(parcelas: ParcelaFinanceiroFrete[]): number {
  return Math.round(
    parcelas.reduce((s, p) => {
      const n = Number(p.valor)
      return s + (Number.isFinite(n) ? n : 0)
    }, 0) * 100
  ) / 100
}

/** Divide o total do transporte igualmente entre as parcelas (centavos na última). */
function ratearParcelasIguaisFrete(
  parcelas: ParcelaFinanceiroFrete[],
  totalTransporte: number
): ParcelaFinanceiroFrete[] {
  if (parcelas.length === 0) return parcelas
  const valores = distribuirParcelasIguais(parcelas.length, totalTransporte)
  return parcelas.map((p, i) => ({
    ...p,
    valor: String(valores[i] ?? 0),
  }))
}

function resolverTotalTransporteUi(nota: DetalheNota): number {
  if (nota.tipoDocumento === 'cte') {
    return nota.valorTotal != null && Number.isFinite(nota.valorTotal) ? nota.valorTotal : 0
  }
  const ctes = nota.ctesVinculados ?? []
  const soma = ctes.reduce((acc, v) => {
    const n = v.valorFrete ?? v.cte?.valorTotal ?? 0
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)
  if (soma > 0) return Math.round(soma * 100) / 100
  const nf = nota.transporteXml?.valorFreteNf
  return nf != null && Number.isFinite(nf) ? Math.round(nf * 100) / 100 : 0
}

function CardManifestoDestinatario({
  acao,
  justificativa,
  onJustificativaChange,
  senha,
  onSenhaChange,
  onManifestar,
}: {
  acao: boolean
  justificativa: string
  onJustificativaChange: (valor: string) => void
  senha: string
  onSenhaChange: (valor: string) => void
  onManifestar: (tipo: 'desconhecimento' | 'nao_realizada') => void
}) {
  return (
    <CardPadrao titulo="Manifestação do destinatário">
      <p className="mb-3 text-sm text-muted-foreground">
        Use quando a nota não pode seguir no fluxo normal (ex.: CST/CFOP impeditivo ou operação que
        a empresa não reconhece). A nota vai para o painel <strong>Canceladas</strong> e não pode
        mais ser lançada. <strong>Desconhecer operação</strong> exige senha.
      </p>
      <textarea
        className="mb-3 min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={justificativa}
        onChange={(e) => onJustificativaChange(e.target.value)}
        placeholder="Justificativa (obrigatória para operação não realizada)"
      />
      <div className="mb-3 max-w-xs">
        <Label htmlFor="senha-desconhecer">Senha (desconhecer operação)</Label>
        <input
          id="senha-desconhecer"
          type="password"
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={senha}
          onChange={(e) => onSenhaChange(e.target.value)}
          placeholder="Senha do usuário"
          autoComplete="current-password"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={acao || !senha.trim()}
          onClick={() => onManifestar('desconhecimento')}
        >
          Desconhecer operação
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={acao || justificativa.trim().length < 15}
          onClick={() => onManifestar('nao_realizada')}
        >
          Operação não realizada
        </Button>
      </div>
    </CardPadrao>
  )
}

function CardProblemaNota({
  acao,
  statusEntrada,
  problemaDesfecho,
  tratativas,
  textoTratativa,
  onTextoTratativaChange,
  senha,
  onSenhaChange,
  onEnviarTratativa,
  onResolver,
  onDesconhecer,
}: {
  acao: boolean
  statusEntrada: string
  problemaDesfecho?: string | null
  tratativas: TratativaNota[]
  textoTratativa: string
  onTextoTratativaChange: (valor: string) => void
  senha: string
  onSenhaChange: (valor: string) => void
  onEnviarTratativa: () => void
  onResolver: () => void
  onDesconhecer: () => void
}) {
  const aberta = statusEntrada === 'com_problema'
  const resolvida = statusEntrada === 'problema_resolvido'

  return (
    <CardPadrao titulo="Nota com problema">
      <p className="mb-3 text-sm text-muted-foreground">
        {resolvida
          ? `Problema encerrado com desfecho: ${problemaDesfecho === 'solucao' ? 'Solução' : problemaDesfecho ?? '—'}. A nota saiu do fluxo de entrada.`
          : 'Registre as tratativas com o fornecedor. O desfecho pode ser solução (sai do fluxo) ou desconhecer operação (Canceladas).'}
      </p>

      <div className="mb-4 max-h-64 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3">
        {tratativas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tratativa registrada ainda.</p>
        ) : (
          tratativas.map((t) => (
            <div key={t.id} className="rounded-md border bg-background p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t.usuario?.name ?? 'Usuário'}</span>
                <span>
                  {t.createdAt
                    ? new Date(t.createdAt).toLocaleString('pt-BR')
                    : '—'}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{t.texto}</p>
            </div>
          ))
        )}
      </div>

      {aberta && (
        <div className="mb-4 space-y-2">
          <Label htmlFor="tratativa-texto">Nova tratativa</Label>
          <textarea
            id="tratativa-texto"
            className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={textoTratativa}
            onChange={(e) => onTextoTratativaChange(e.target.value)}
            placeholder="Ex.: liguei no fornecedor; vão bonificar X itens / desconto no boleto…"
          />
          <Button
            type="button"
            size="sm"
            disabled={acao || !textoTratativa.trim()}
            onClick={onEnviarTratativa}
          >
            Registrar tratativa
          </Button>
        </div>
      )}

      {aberta && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">Desfecho</p>
          <div className="max-w-xs">
            <Label htmlFor="senha-problema-desconhecer">Senha (desconhecer operação)</Label>
            <input
              id="senha-problema-desconhecer"
              type="password"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={senha}
              onChange={(e) => onSenhaChange(e.target.value)}
              placeholder="Senha do usuário"
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={acao} onClick={onResolver}>
              Registrar solução
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={acao || !senha.trim()}
              onClick={onDesconhecer}
            >
              Desconhecer operação
            </Button>
          </div>
        </div>
      )}
    </CardPadrao>
  )
}

function EtapaResumo({ etapa }: { etapa?: ResultadoEtapa | null }) {
  if (!etapa) return <p className="text-sm text-muted-foreground">Pendente</p>
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium uppercase tracking-wide">{etapa.status}</p>
      {etapa.bloqueios?.map((b) => (
        <p key={b} className="text-destructive">
          {b}
        </p>
      ))}
      {etapa.bloqueiosNaoLiberaveis?.map((b) => (
        <p key={b} className="text-destructive">
          {b}
        </p>
      ))}
      {etapa.avisos?.map((a) => (
        <p key={a} className="text-muted-foreground">
          {a}
        </p>
      ))}
    </div>
  )
}

function ConteudoDetalheEntrada() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = String(params.id)
  const [nota, setNota] = useState<DetalheNota | null>(null)
  const [pedidos, setPedidos] = useState<Array<{ id: string; numero: number; status: string }>>([])
  const [cfopsEntrada, setCfopsEntrada] = useState<CfopOpcaoEntrada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [senhaDesconhecer, setSenhaDesconhecer] = useState('')
  const [obsContato, setObsContato] = useState('')
  const [justificativaManifesto, setJustificativaManifesto] = useState('')
  const [textoTratativa, setTextoTratativa] = useState('')
  const [prazo, setPrazo] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtos, setProdutos] = useState<ProdutoBusca[]>([])
  const [itemVinculando, setItemVinculando] = useState<string | null>(null)
  const [acao, setAcao] = useState(false)
  const [xmlBusy, setXmlBusy] = useState(false)
  const [downloadRotulo, setDownloadRotulo] = useState('')
  const [xmlModal, setXmlModal] = useState<{ visualizacao: VisualizacaoNota } | null>(null)
  const [modalMarcarProblema, setModalMarcarProblema] = useState(false)
  const [danfeBloqueado, setDanfeBloqueado] = useState(false)
  const [recursosDoc, setRecursosDoc] = useState({
    verNota: true,
    baixarXml: true,
    baixarPdfFocus: true,
  })
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('cadastro')
  const [etapaVoltarSelecionada, setEtapaVoltarSelecionada] = useState<EtapaPipeline | ''>('')
  const [chaveCteManual, setChaveCteManual] = useState('')
  const [finParcelas, setFinParcelas] = useState<ParcelaFinanceiroFrete[]>([
    parcelaFinanceiroVazia(),
  ])
  const [codigosOriginaisGravados, setCodigosOriginaisGravados] = useState<Record<string, true>>(
    {}
  )

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.get<{
        nota: DetalheNota
        pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
      }>(`/entrada-notas/${id}`)
      setNota(data.nota)
      setPedidos(data.pedidosDisponiveis ?? [])
      setObsContato(data.nota.observacaoContato ?? '')
      setPrazo(data.nota.prazoPagamentoTexto ?? '')
      setAbaAtiva(resolverAbaInicial(data.nota, searchParams.get('aba')))
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao carregar nota.'))
      setNota(null)
    } finally {
      setCarregando(false)
    }
  }, [id, searchParams])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!nota) return
    if (nota.tipoDocumento === 'cte') {
      const fin = (nota.despesasFrete ?? [])[0]
      const sugestao = nota.sugestaoFinanceiroFrete
      setFinParcelas(
        stubParaParcelasUi(fin, {
          numeroDocumento: sugestao?.numeroDocumento ?? '',
          valor: sugestao?.valor ?? null,
        })
      )
      return
    }
    const primeiro = (nota.ctesVinculados ?? [])[0]
    const fin = primeiro?.financeiro
    const sugestao = primeiro?.sugestaoFinanceiroFrete
    setFinParcelas(
      stubParaParcelasUi(fin, {
        numeroDocumento: sugestao?.numeroDocumento ?? '',
        valor: sugestao?.valor ?? null,
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reidrata só quando vínculos/despesa mudam
  }, [
    nota?.id,
    nota?.tipoDocumento,
    nota?.sugestaoFinanceiroFrete?.numeroDocumento,
    nota?.sugestaoFinanceiroFrete?.valor,
    (nota?.despesasFrete ?? [])
      .map(
        (d) =>
          `${d.id}:${d.numeroDocumento ?? ''}:${d.vencimento ?? ''}:${d.valor ?? ''}:${(d.parcelas ?? [])
            .map((p) => `${p.numeroDocumento ?? ''}:${p.vencimento ?? ''}:${p.valor ?? ''}`)
            .join(',')}`
      )
      .join('|'),
    (nota?.ctesVinculados ?? [])
      .map(
        (v) =>
          `${v.id}:${v.financeiro?.id ?? ''}:${v.financeiro?.valor ?? ''}:${v.sugestaoFinanceiroFrete?.numeroDocumento ?? ''}:${v.sugestaoFinanceiroFrete?.valor ?? ''}:${(v.financeiro?.parcelas ?? [])
            .map((p) => `${p.numeroDocumento ?? ''}:${p.vencimento ?? ''}:${p.valor ?? ''}`)
            .join(',')}`
      )
      .join('|'),
  ])

  useEffect(() => {
    let ativo = true
    clienteHttp
      .get<{
        recursos: {
          verNota: boolean
          baixarXml: boolean
          baixarPdfFocus: boolean
        }
      }>('/focus-nfe/recursos-documento')
      .then(({ data }) => {
        if (ativo && data.recursos) setRecursosDoc(data.recursos)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    let ativo = true
    clienteHttp
      .get<{ cfops: CfopOpcaoEntrada[] }>('/cfops', { params: { tipo: 'entrada' } })
      .then(({ data }) => {
        if (ativo) setCfopsEntrada(data.cfops ?? [])
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  async function baixarXml() {
    setXmlBusy(true)
    setDownloadRotulo('Baixando XML…')
    try {
      const resp = await clienteHttp.get(`/focus-nfe/nfe-recebidas/${id}/xml`, {
        responseType: 'blob',
      })
      const blob = new Blob([resp.data], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefixoPdfDocumento(nota?.tipoDocumento)}-${nota?.chaveNfe || id}.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao baixar XML.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function baixarDanfe() {
    setXmlBusy(true)
    setDownloadRotulo('Baixando PDF…')
    try {
      const resp = await clienteHttp.get(`/focus-nfe/nfe-recebidas/${id}/danfe`, {
        responseType: 'blob',
      })
      const blob = new Blob([resp.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prefixoPdfDocumento(nota?.tipoDocumento)}-${nota?.chaveNfe || id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setDanfeBloqueado(false)
    } catch (err) {
      setDanfeBloqueado(true)
      setErro(extrairMensagemApi(err, 'Falha ao baixar PDF.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function visualizarXml() {
    setXmlBusy(true)
    setDownloadRotulo('Abrindo nota…')
    try {
      const { data } = await clienteHttp.get<{ visualizacao: VisualizacaoNota }>(
        `/focus-nfe/nfe-recebidas/${id}/xml`,
        { params: { modo: 'visualizar' } }
      )
      setXmlModal({ visualizacao: data.visualizacao })
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao abrir nota.'))
    } finally {
      setXmlBusy(false)
      setDownloadRotulo('')
    }
  }

  async function postAcao(path: string, body?: Record<string, unknown>): Promise<boolean> {
    setAcao(true)
    setErro(null)
    setMensagem(null)
    try {
      const { data } = await clienteHttp.post<{
        nota?: DetalheNota
        pedidosDisponiveis?: Array<{ id: string; numero: number; status: string }>
        mensagem?: string
        sucesso?: boolean
      }>(`/entrada-notas/${id}${path}`, body ?? {})
      if (data.nota) {
        setNota(data.nota)
        setPedidos(data.pedidosDisponiveis ?? [])
        if (path !== '/financeiro-frete' && path !== '/definir-cfop-entrada-cte') {
          setAbaAtiva(abaInicial(data.nota))
        }
        if (path === '/analisar' || path.startsWith('/analisar')) {
          setMensagem(mensagemAposAnalisar(data.nota))
        } else if (path === '/financeiro-frete') {
          setMensagem('Prévia financeira do frete salva (stub — sem contas a pagar).')
        } else if (data.nota.origemLancamento === 'automatica') {
          setMensagem('Entrada automática concluída (Liberar para contagem).')
        } else if (
          data.nota.statusEntrada === 'entrada_contagem' ||
          data.nota.statusEntrada === 'entrada_consolidada'
        ) {
          setMensagem(`Nota lançada: ${data.nota.statusEntrada}.`)
        } else if (path === '/manifestar') {
          setMensagem(
            'Manifestação enviada à Focus. Nota marcada como cancelada — veja o painel Canceladas.'
          )
        } else if (path === '/descancelar') {
          setMensagem('Cancelamento desfeito. Nota de volta ao painel Em análise.')
        } else if (path === '/marcar-problema') {
          setMensagem('Nota marcada com problema — veja o painel Com problemas.')
        } else if (path === '/resolver-problema') {
          setMensagem('Problema resolvido. A nota saiu do fluxo de entrada.')
        } else if (path === '/tratativas') {
          setMensagem('Tratativa registrada.')
        } else if (path.includes('vincular-cte') || path.includes('definir-prazo')) {
          setMensagem(mensagemAposAnalisar(data.nota))
        } else if (path === '/voltar-etapa') {
          const rotulo = ROTULOS_ETAPA[(body?.etapaDestino as EtapaPipeline) ?? 'cadastro']
          setMensagem(`Nota reaberta em ${rotulo}. Corrija o necessário e clique em Reanalisar.`)
        } else if (path === '/desvincular-item') {
          setMensagem('Produto desvinculado. Concilie o produto correto e clique em Reanalisar.')
        } else if (path === '/vincular-item') {
          setMensagem('Produto vinculado. Concilie os demais itens e clique em Reanalisar.')
        }
        return true
      }
      if (path === '/gravar-codigo-original' && (data.mensagem || data.sucesso)) {
        if (data.mensagem) setMensagem(data.mensagem)
        return true
      }
      if (data.mensagem) {
        setMensagem(data.mensagem)
        await carregar()
        return true
      }
      return false
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha na ação.'))
      return false
    } finally {
      setAcao(false)
    }
  }

  /** Define CFOP de entrada no documento CT-e e recarrega a nota atual (NF ou o próprio CT-e). */
  async function definirCfopEntradaCte(cteId: string, cfopId: string): Promise<boolean> {
    if (cteId === id) {
      return postAcao('/definir-cfop-entrada-cte', { cfopId })
    }
    setAcao(true)
    setErro(null)
    setMensagem(null)
    try {
      await clienteHttp.post(`/entrada-notas/${cteId}/definir-cfop-entrada-cte`, { cfopId })
      const { data } = await clienteHttp.get<{
        nota: DetalheNota
        pedidosDisponiveis: Array<{ id: string; numero: number; status: string }>
      }>(`/entrada-notas/${id}`)
      setNota(data.nota)
      setPedidos(data.pedidosDisponiveis ?? [])
      setMensagem('CFOP de entrada do CT-e atualizado.')
      return true
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao definir CFOP de entrada do CT-e.'))
      return false
    } finally {
      setAcao(false)
    }
  }

  async function manifestar(tipo: 'desconhecimento' | 'nao_realizada') {
    const rotulo = tipo === 'desconhecimento' ? 'Desconhecer operação' : 'Operação não realizada'
    const confirmado = window.confirm(
      `${rotulo}: a nota vai para o painel Canceladas e não poderá mais ser lançada. Confirma?`
    )
    if (!confirmado) return
    if (tipo === 'desconhecimento' && !senhaDesconhecer.trim()) {
      setErro('Senha obrigatória para desconhecer a operação.')
      return
    }
    const justificativa = justificativaManifesto.trim()
    const ok = await postAcao('/manifestar', {
      tipo,
      ...(justificativa ? { justificativa } : {}),
      ...(tipo === 'desconhecimento' ? { senha: senhaDesconhecer } : {}),
    })
    if (ok) {
      setJustificativaManifesto('')
      setSenhaDesconhecer('')
    }
  }

  async function marcarComProblema() {
    const ok = await postAcao('/marcar-problema', {})
    if (ok) setModalMarcarProblema(false)
  }

  async function enviarTratativa() {
    const texto = textoTratativa.trim()
    if (!texto) return
    const ok = await postAcao('/tratativas', { texto })
    if (ok) setTextoTratativa('')
  }

  async function resolverProblemaSolucao() {
    const confirmado = window.confirm(
      'Registrar solução? A nota sai do fluxo de entrada (painel Com problemas como Resolvida).'
    )
    if (!confirmado) return
    await postAcao('/resolver-problema', { desfecho: 'solucao' })
  }

  async function descancelarNota() {
    const confirmado = window.confirm(
      'Desfazer cancelamento: a nota volta para o painel Em análise e o fluxo de entrada é reaberto. Confirma?'
    )
    if (!confirmado) return
    await postAcao('/descancelar')
  }

  async function deleteVinculo(vinculoId: string) {
    setAcao(true)
    setErro(null)
    try {
      const { data } = await clienteHttp.delete<{
        nota?: DetalheNota
        pedidosDisponiveis?: Array<{ id: string; numero: number; status: string }>
      }>(`/entrada-notas/${id}/vinculos-cte/${vinculoId}`)
      if (data.nota) {
        setNota(data.nota)
        setPedidos(data.pedidosDisponiveis ?? [])
        setAbaAtiva(abaInicial(data.nota))
      } else {
        await carregar()
      }
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Falha ao desvincular CT-e.'))
    } finally {
      setAcao(false)
    }
  }

  function termoBuscaProdutoItem(item: ItemNota): string {
    const descricao = item.descricao?.trim() ?? ''
    if (descricao.length >= 2) return descricao
    const cProd = item.codigoProduto?.trim() ?? ''
    if (cProd.length >= 2) return cProd
    const gtin = item.gtin?.trim() ?? ''
    if (gtin.length >= 2) return gtin
    return descricao || cProd || gtin
  }

  async function buscarProdutos(termo?: string) {
    const q = (termo ?? buscaProduto).trim()
    if (q.length < 2) {
      setProdutos([])
      return
    }
    try {
      const { data } = await clienteHttp.get<{ produtos?: ProdutoBusca[] }>('/produtos', {
        params: { q, pagina: 1, limite: 20, resumo: 'true' },
      })
      setProdutos(data.produtos ?? [])
    } catch {
      setProdutos([])
    }
  }

  function abrirBuscaProduto(item: ItemNota) {
    if (item.produtoId) return
    const termo = termoBuscaProdutoItem(item)
    setItemVinculando(item.id)
    setBuscaProduto(termo)
    setProdutos([])
    void buscarProdutos(termo)
  }

  const finalizada =
    nota?.statusEntrada === 'entrada_contagem' ||
    nota?.statusEntrada === 'entrada_consolidada' ||
    nota?.statusEntrada === 'cancelada' ||
    nota?.statusEntrada === 'problema_resolvido'

  const comProblema = nota?.statusEntrada === 'com_problema'
  const problemaResolvido = nota?.statusEntrada === 'problema_resolvido'
  const pipelineBloqueado = finalizada || comProblema
  const podeMarcarProblema =
    Boolean(nota) &&
    !['entrada_contagem', 'entrada_consolidada', 'cancelada', 'com_problema', 'problema_resolvido'].includes(
      nota!.statusEntrada
    )

  const ehDocumental = ehDocumentalEntrada(nota?.tipoDocumento)
  const ehNfse = nota?.tipoDocumento === 'nfse'
  const ehCte = nota?.tipoDocumento === 'cte'
  const ehNfe55 = !ehDocumental

  const fiscalExigeManifesto =
    nota?.analise?.fiscal?.exigeManifesto === true ||
    (nota?.analise?.fiscal?.bloqueiosNaoLiberaveis?.length ?? 0) > 0 ||
    (nota?.analise?.fiscal?.bloqueios ?? []).some((m) =>
      /sem CFOP|sem CST|desconhecimento da opera/i.test(m)
    )
  const cadastroBloqueante = nota?.analise?.cadastro?.status === 'bloqueante'
  const fiscalBloqueante = nota?.analise?.fiscal?.status === 'bloqueante'
  const negociacaoBloqueante = nota?.analise?.negociacao?.status === 'bloqueante'
  const freteBloqueante = nota?.analise?.frete?.status === 'bloqueante'
  const podeLiberarCriticas = !cadastroBloqueante && !fiscalExigeManifesto
  const motivoBloqueioLiberacao = cadastroBloqueante
    ? nota?.fornecedor
      ? 'Cadastro bloqueante não libera por senha — concilie os produtos sem vínculo e reanalise.'
      : 'Cadastro bloqueante não libera por senha — cadastre o fornecedor e vincule produtos, depois reanalise.'
    : fiscalExigeManifesto
      ? 'CST/CFOP impeditivo não libera por senha — use desconhecimento da operação ou devolução.'
      : null

  const abas = useMemo(() => {
    if (!nota) return []
    if (ehNfse) {
      return [
        { id: 'cadastro', rotulo: 'Cadastro', status: statusAbaDeEtapa(nota.analise?.cadastro) },
        { id: 'lancamento', rotulo: 'Lançamento', status: 'idle' as StatusDaAba },
      ]
    }
    if (ehCte) {
      return [
        { id: 'cadastro', rotulo: 'Cadastro', status: statusAbaDeEtapa(nota.analise?.cadastro) },
        { id: 'frete', rotulo: 'Vínculo NF', status: statusAbaDeEtapa(nota.analise?.negociacao) },
        { id: 'lancamento', rotulo: 'Lançamento', status: 'idle' as StatusDaAba },
      ]
    }
    return [
      { id: 'cadastro', rotulo: 'Cadastro', status: statusAbaDeEtapa(nota.analise?.cadastro) },
      { id: 'fiscal', rotulo: 'Fiscal', status: statusAbaDeEtapa(nota.analise?.fiscal) },
      { id: 'negociacao', rotulo: 'Negociação', status: statusAbaDeEtapa(nota.analise?.negociacao) },
      { id: 'frete', rotulo: 'Frete / CT-e', status: statusAbaDeEtapa(nota.analise?.frete) },
      { id: 'lancamento', rotulo: 'Lançamento', status: 'idle' as StatusDaAba },
    ]
  }, [nota, ehNfse, ehCte])

  const opcoesVoltarEtapa = useMemo(() => {
    if (!nota) return []
    return etapasVoltarDisponiveis(nota, ehDocumental)
  }, [nota, ehDocumental])

  useEffect(() => {
    if (opcoesVoltarEtapa.length === 0) {
      setEtapaVoltarSelecionada('')
      return
    }
    if (!opcoesVoltarEtapa.includes(etapaVoltarSelecionada as EtapaPipeline)) {
      setEtapaVoltarSelecionada(opcoesVoltarEtapa[opcoesVoltarEtapa.length - 1])
    }
  }, [opcoesVoltarEtapa, etapaVoltarSelecionada])

  function abaBloqueada(idAba: string): boolean {
    if (finalizada) return false
    if (ehNfse) return idAba === 'lancamento' && cadastroBloqueante
    if (ehCte) {
      if (idAba === 'frete') return cadastroBloqueante
      if (idAba === 'lancamento') return cadastroBloqueante || negociacaoBloqueante
      return false
    }
    if (idAba === 'fiscal') return cadastroBloqueante
    if (idAba === 'negociacao') {
      return cadastroBloqueante || (fiscalBloqueante && !nota?.criticasLiberadas)
    }
    if (idAba === 'frete') {
      return false
    }
    if (idAba === 'lancamento') {
      return (
        cadastroBloqueante ||
        fiscalExigeManifesto ||
        (fiscalBloqueante && !nota?.criticasLiberadas) ||
        (negociacaoBloqueante && !nota?.criticasLiberadas) ||
        freteBloqueante
      )
    }
    return false
  }

  if (carregando) {
    return (
      <div className="min-w-0 space-y-6">
        <p className="text-sm text-muted-foreground">Carregando nota…</p>
      </div>
    )
  }

  if (!nota) {
    return (
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-destructive">{erro || 'Nota não encontrada.'}</p>
        <Button asChild variant="outline">
          <Link href="/entrada-notas">Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <BarraCarregamentoDownload ativo={xmlBusy} rotulo={downloadRotulo || 'Carregando…'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/entrada-notas">← Lista</Link>
          </Button>
          <h1 className="text-xl font-semibold">Análise de entrada</h1>
          <p className="font-mono text-xs text-muted-foreground">{nota.chaveNfe}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recursosDoc.verNota && (
          <Button type="button" variant="outline" size="sm" disabled={xmlBusy} onClick={() => void visualizarXml()}>
            Ver nota
          </Button>
          )}
          {recursosDoc.baixarXml && (
          <Button type="button" variant="outline" size="sm" disabled={xmlBusy} onClick={() => void baixarXml()}>
            Baixar XML
          </Button>
          )}
          {recursosDoc.baixarPdfFocus && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={xmlBusy || danfeBloqueado}
            title="Baixar DANFE/DACTe oficial da Focus"
            onClick={() => void baixarDanfe()}
          >
            Baixar PDF
          </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={acao || pipelineBloqueado}
            onClick={() => postAcao('/analisar', { forcarReparseItens: true })}
          >
            Reanalisar
          </Button>
          {podeMarcarProblema && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={acao}
              onClick={() => setModalMarcarProblema(true)}
            >
              Marcar com problema
            </Button>
          )}
          {opcoesVoltarEtapa.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                className="h-8 rounded-md border bg-background px-2 text-sm"
                aria-label="Etapa para voltar"
                value={etapaVoltarSelecionada}
                disabled={acao}
                onChange={(e) => setEtapaVoltarSelecionada(e.target.value as EtapaPipeline)}
              >
                {opcoesVoltarEtapa.map((etapa) => (
                  <option key={etapa} value={etapa}>
                    {ROTULOS_ETAPA[etapa]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={acao || !etapaVoltarSelecionada}
                onClick={() =>
                  postAcao('/voltar-etapa', { etapaDestino: etapaVoltarSelecionada })
                }
              >
                Voltar etapa
              </Button>
            </div>
          )}
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {mensagem && <p className="text-sm text-emerald-700 dark:text-emerald-400">{mensagem}</p>}

      {(comProblema || problemaResolvido) && nota && (
        <CardProblemaNota
          acao={acao}
          statusEntrada={nota.statusEntrada}
          problemaDesfecho={nota.problemaDesfecho}
          tratativas={nota.tratativas ?? []}
          textoTratativa={textoTratativa}
          onTextoTratativaChange={setTextoTratativa}
          senha={senhaDesconhecer}
          onSenhaChange={setSenhaDesconhecer}
          onEnviarTratativa={() => void enviarTratativa()}
          onResolver={() => void resolverProblemaSolucao()}
          onDesconhecer={() => void manifestar('desconhecimento')}
        />
      )}

      <ModalConfirmacao
        aberto={modalMarcarProblema}
        titulo="Marcar com problema?"
        mensagem="A nota sai do fluxo normal (Em análise) e vai para o painel Com problemas, onde você registra tratativas com o fornecedor."
        textoConfirmar="Marcar com problema"
        textoCancelar="Cancelar"
        aoConfirmar={() => void marcarComProblema()}
        aoCancelar={() => !acao && setModalMarcarProblema(false)}
      />

      <Modal
        aberto={Boolean(xmlModal)}
        aoFechar={() => setXmlModal(null)}
        titulo="Visualizar nota"
        descricao="Documento fiscal legível (emitente, itens e totais)."
        largura="5xl"
        alturaMinimaConteudo="md"
        rodape={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setXmlModal(null)}>
              Fechar
            </Button>
          </div>
        }
      >
        {xmlModal?.visualizacao && <ConteudoVisualizacaoNota visualizacao={xmlModal.visualizacao} />}
      </Modal>

      <CardPadrao titulo="Resumo">
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">Tipo:</span>{' '}
            {rotuloTipoDocumentoLongo(nota.tipoDocumento)}
            {((nota.nfesVinculadas?.length ?? 0) > 0 ||
              (nota.ctesVinculados?.length ?? 0) > 0) && (
              <span
                title="CT-e e NF de mercadoria vinculados"
                className="inline-flex text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="size-4" aria-label="Vinculado" />
              </span>
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Emitente:</span> {nota.nomeEmitente ?? '—'} (
            {nota.documentoEmitente ?? '—'})
          </p>
          <p>
            <span className="text-muted-foreground">Fornecedor ERP:</span>{' '}
            {nota.fornecedor?.nome ?? 'não vinculado'}
          </p>
          <p>
            <span className="text-muted-foreground">Valor:</span>{' '}
            {nota.valorTotal != null
              ? nota.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span> {nota.statusEntrada}
          </p>
          <p>
            <span className="text-muted-foreground">Etapa:</span> {nota.etapaAtual}
          </p>
          {ehNfe55 && (
            <p>
              <span className="text-muted-foreground">Frete (modFrete):</span> {rotuloModFrete(nota.modFrete)}
            </p>
          )}
        </div>
        {ehNfe55 && (nota.ctesVinculados ?? []).length > 0 && (
          <div className="mt-3 border-t pt-3 text-sm">
            <p className="font-medium text-muted-foreground">CT-es vinculados</p>
            <ul className="mt-1 space-y-1">
              {nota.ctesVinculados!.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    CT-e …{v.cte?.chaveNfe?.slice(-8) ?? '—'}
                    {v.cte?.nomeEmitente ? ` — ${v.cte.nomeEmitente}` : ''}
                  </span>
                  {v.cte?.id && (
                    <Link className="text-primary underline" href={`/entrada-notas/${v.cte.id}`}>
                      Abrir CT-e
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardPadrao>

      <Abas
        abas={abas}
        abaAtiva={abaAtiva}
        aoMudar={(idAba) => setAbaAtiva(idAba as AbaId)}
        abaDesabilitada={abaBloqueada}
      />

      {abaAtiva === 'cadastro' && (
        <div className="space-y-4">
          <CardPadrao titulo="Análise de cadastro">
            <EtapaResumo etapa={nota.analise?.cadastro} />
            {cadastroBloqueante && !nota.fornecedor && nota.documentoEmitente ? (
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    gravarDeepLinkFornecedor({
                      documento: nota.documentoEmitente!,
                      nome: nota.nomeEmitente ?? undefined,
                      retorno: `/entrada-notas/${nota.id}`,
                    })
                    router.push('/fornecedores')
                  }}
                >
                  Cadastrar fornecedor
                </Button>
              </div>
            ) : null}
          </CardPadrao>

          <CardPadrao
            titulo={ehNfse ? 'Serviço (NFS-e)' : ehCte ? 'Transporte (CTe)' : 'Itens — vínculo de produtos'}
          >
            {ehDocumental ? (
              <p className="text-sm text-muted-foreground">
                {ehCte
                  ? 'CTe: cadastre a transportadora (emitente) como fornecedor. O vínculo com a NF de mercadoria fica na aba Vínculo NF / Frete.'
                  : 'NFS-e: cadastre o prestador como fornecedor. Sem itens de produto.'}
              </p>
            ) : (
              <div className="space-y-4">
                {nota.fornecedor?.modoDocumental ? (
                  <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Entrada documental (uso/consumo) — vínculo de produto não exigido
                    {nota.fornecedor.permitirVinculoManual
                      ? '. Você pode conciliar manualmente se quiser.'
                      : '.'}
                  </p>
                ) : null}
                {nota.itens.map((item) => (
                  <ItemVinculoCadastroGrid
                    key={item.id}
                    item={item}
                    finalizada={pipelineBloqueado}
                    acao={acao}
                    buscando={itemVinculando === item.id}
                    buscaProduto={buscaProduto}
                    produtos={produtos}
                    permitirAcoesVinculo={
                      !nota.fornecedor?.modoDocumental ||
                      Boolean(nota.fornecedor.permitirVinculoManual)
                    }
                    vinculoNaoExigido={Boolean(nota.fornecedor?.modoDocumental)}
                    onAbrirBusca={() => abrirBuscaProduto(item)}
                    onFecharBusca={() => {
                      setItemVinculando(null)
                      setProdutos([])
                      setBuscaProduto('')
                    }}
                    onBuscaChange={setBuscaProduto}
                    onBuscar={() => void buscarProdutos()}
                    onVincular={async (produtoId) => {
                      await postAcao('/vincular-item', {
                        itemId: item.id,
                        produtoId,
                      })
                      setItemVinculando(null)
                      setProdutos([])
                      setBuscaProduto('')
                    }}
                    codigoOriginalGravado={
                      Boolean(item.codigoOriginalGravado) ||
                      Boolean(codigosOriginaisGravados[item.id])
                    }
                    onGravarCodigoOriginal={
                      item.produtoId && item.codigoProduto
                        ? async () => {
                            const ok = await postAcao('/gravar-codigo-original', {
                              itemId: item.id,
                            })
                            if (ok) {
                              setCodigosOriginaisGravados((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }))
                            }
                          }
                        : undefined
                    }
                  />
                ))}
                {nota.itens.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem itens. Reanalisar ou reimporte o XML.</p>
                )}
              </div>
            )}
          </CardPadrao>
        </div>
      )}

      {abaAtiva === 'fiscal' && ehNfe55 && (
        <div className="space-y-4">
          <CardPadrao titulo="Análise fiscal">
            <EtapaResumo etapa={nota.analise?.fiscal} />
            <p className="mt-2 text-sm text-muted-foreground">
              Divergência de NCM/origem: importe da NF ou liberar críticas. CST/CFOP: desconhecimento ou
              devolução.
            </p>
          </CardPadrao>
          <CardPadrao titulo="Itens — NCM / origem / CST / CFOP de entrada">
            <div className="space-y-4">
              {nota.itens.map((item) => (
                <ItemVinculoFiscalGrid
                  key={item.id}
                  item={item}
                  finalizada={pipelineBloqueado}
                  acao={acao}
                  cfopsEntrada={cfopsEntrada}
                  onImportarFiscal={() =>
                    postAcao('/importar-fiscal-produto', {
                      itemId: item.id,
                      ncm: true,
                      origem: true,
                    })
                  }
                  onDefinirCfopEntrada={async (cfopId) => {
                    await postAcao('/definir-cfop-entrada', { itemId: item.id, cfopId })
                  }}
                />
              ))}
              {nota.itens.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem itens. Reanalisar ou reimporte o XML.</p>
              )}
            </div>
          </CardPadrao>
          {!pipelineBloqueado && (
            <CardPadrao titulo="Liberar críticas (NCM/origem)">
              {motivoBloqueioLiberacao && (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">{motivoBloqueioLiberacao}</p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label htmlFor="senha-criticas-f">Senha gerente</Label>
                  <input
                    id="senha-criticas-f"
                    type="password"
                    className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={!podeLiberarCriticas}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={acao || !senha.trim() || !podeLiberarCriticas}
                  onClick={() => postAcao('/liberar-criticas', { senha })}
                >
                  Liberar críticas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acao}
                  onClick={() => postAcao('/cancelar-liberacao')}
                >
                  Cancelar liberação
                </Button>
              </div>
            </CardPadrao>
          )}
          {!pipelineBloqueado && (
            <CardManifestoDestinatario
              acao={acao}
              justificativa={justificativaManifesto}
              onJustificativaChange={setJustificativaManifesto}
              senha={senhaDesconhecer}
              onSenhaChange={setSenhaDesconhecer}
              onManifestar={(tipo) => void manifestar(tipo)}
            />
          )}
        </div>
      )}

      {abaAtiva === 'negociacao' && ehNfe55 && (
        <div className="space-y-4">
          <CardPadrao titulo="Análise de negociação">
            <EtapaResumo etapa={nota.analise?.negociacao} />
          </CardPadrao>
          <CardPadrao titulo="Pedido e prazo">
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <div>
                <Label>Pedido de compra</Label>
                <select
                  className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                  value={nota.pedidoCompraId ?? ''}
                  disabled={pipelineBloqueado || acao}
                  onChange={(e) => {
                    if (e.target.value)
                      void postAcao('/definir-pedido', { pedidoCompraId: e.target.value })
                  }}
                >
                  <option value="">Selecione…</option>
                  {pedidos.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.numero} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="prazo">Prazo (se NF sem prazo)</Label>
                <input
                  id="prazo"
                  className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                  value={prazo}
                  disabled={pipelineBloqueado}
                  onChange={(e) => setPrazo(e.target.value)}
                  placeholder={nota.prazoPagamentoXml ?? 'Ex.: 30/60 dias'}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pipelineBloqueado || acao || !prazo.trim()}
                onClick={() => postAcao('/definir-prazo', { prazo })}
              >
                Salvar prazo e reanalisar
              </Button>
            </div>
            {nota.prazoPagamentoXml && (
              <p className="mt-2 text-xs text-muted-foreground">Prazo no XML: {nota.prazoPagamentoXml}</p>
            )}
          </CardPadrao>
          {!pipelineBloqueado && (
            <CardPadrao titulo="Controles">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={acao || !senha.trim() || !podeLiberarCriticas}
                  onClick={() => postAcao('/liberar-criticas', { senha })}
                >
                  Liberar críticas (senha)
                </Button>
                <input
                  type="password"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Senha gerente"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acao || !obsContato.trim()}
                  onClick={() => postAcao('/contato-fornecedor', { observacao: obsContato })}
                >
                  Contato fornecedor
                </Button>
              </div>
              <textarea
                className="mt-3 min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={obsContato}
                onChange={(e) => setObsContato(e.target.value)}
                placeholder="Observação contato"
              />
            </CardPadrao>
          )}
          {!pipelineBloqueado && (
            <CardManifestoDestinatario
              acao={acao}
              justificativa={justificativaManifesto}
              onJustificativaChange={setJustificativaManifesto}
              senha={senhaDesconhecer}
              onSenhaChange={setSenhaDesconhecer}
              onManifestar={(tipo) => void manifestar(tipo)}
            />
          )}
        </div>
      )}

      {abaAtiva === 'frete' && (
        <div className="space-y-4">
          {ehNfe55 && (
            <CardPadrao titulo="Frete da mercadoria">
              <EtapaResumo etapa={nota.analise?.frete} />
              {bloqueioRegraRateioAusente(nota.analise?.frete) && (
                <div className="mt-3 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive">
                    Ajuste o cadastro do fornecedor (aba Outros → Regra de rateio do frete) e
                    depois clique em Reanalisar nesta nota.
                  </p>
                  {nota.fornecedor?.id && (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href="/fornecedores">Abrir fornecedores</Link>
                    </Button>
                  )}
                </div>
              )}
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">modFrete:</span> {rotuloModFrete(nota.modFrete)}
              </p>
              {nota.exigeCte && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                  Frete por conta do destinatário — é obrigatório ter CT-e vinculado.
                </p>
              )}

              {(() => {
                const transp = nota.transporteXml
                const ctes = nota.ctesVinculados ?? []
                const icms =
                  ctes.find(
                    (v) =>
                      v.icms &&
                      (v.icms.baseCalculoIcms != null ||
                        v.icms.aliquotaIcms != null ||
                        v.icms.valorIcms != null)
                  )?.icms ?? null
                const cteComCfop =
                  ctes.find((v) => v.cfop || v.cfopEntrada || v.cte?.id) ?? ctes[0] ?? null
                const valorFreteSoma = ctes.reduce((acc, v) => {
                  const n = v.valorFrete ?? v.cte?.valorTotal ?? 0
                  return acc + (Number.isFinite(n) ? n : 0)
                }, 0)
                const valorFreteExibir =
                  valorFreteSoma > 0 ? valorFreteSoma : (transp?.valorFreteNf ?? null)
                return (
                  <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Qtd Volumes</dt>
                      <dd className="font-medium">{formatNumBr(transp?.qtdVolumes, 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Peso Bruto</dt>
                      <dd className="font-medium">
                        {transp?.pesoBruto != null ? `${formatNumBr(transp.pesoBruto, 3)} kg` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Peso Líquido</dt>
                      <dd className="font-medium">
                        {transp?.pesoLiquido != null
                          ? `${formatNumBr(transp.pesoLiquido, 3)} kg`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Base Cálculo ICMS</dt>
                      <dd className="font-medium">{formatMoedaBr(icms?.baseCalculoIcms)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Alíq ICMS</dt>
                      <dd className="font-medium">
                        {icms?.aliquotaIcms != null && Number.isFinite(icms.aliquotaIcms)
                          ? `${formatNumBr(icms.aliquotaIcms, 2)}%`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Valor ICMS</dt>
                      <dd className="font-medium">{formatMoedaBr(icms?.valorIcms)}</dd>
                    </div>
                    {cteComCfop?.cte?.id ? (
                      <CfopEntradaFreteCampos
                        cfopXml={cteComCfop.cfop}
                        cfopEntrada={cteComCfop.cfopEntrada}
                        cfopsEntrada={cfopsEntrada}
                        finalizada={finalizada}
                        acao={acao}
                        onDefinirCfopEntrada={(cfopId) =>
                          void definirCfopEntradaCte(cteComCfop.cte!.id, cfopId)
                        }
                      />
                    ) : (
                      <>
                        <div>
                          <dt className="text-muted-foreground">CFOP do CT-e</dt>
                          <dd className="font-medium">—</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">CFOP de entrada</dt>
                          <dd className="font-medium">—</dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt className="text-muted-foreground">Forma de rateio</dt>
                      <dd className="font-medium">
                        {rotuloRegraRateio(nota.regraRateioFrete)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (cadastro do fornecedor)
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Valor Frete</dt>
                      <dd className="font-medium">{formatMoedaBr(valorFreteExibir)}</dd>
                    </div>
                  </dl>
                )
              })()}
            </CardPadrao>
          )}

          {ehCte && (
            <CardPadrao titulo="CFOP do frete">
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <CfopEntradaFreteCampos
                  cfopXml={nota.cfopXml}
                  cfopEntrada={nota.cfopEntrada}
                  cfopsEntrada={cfopsEntrada}
                  finalizada={finalizada}
                  acao={acao}
                  onDefinirCfopEntrada={(cfopId) => void definirCfopEntradaCte(nota.id, cfopId)}
                />
              </dl>
            </CardPadrao>
          )}

          {ehCte && (
            <CardPadrao titulo="NF-e referenciada">
              <EtapaResumo etapa={nota.analise?.negociacao} />
              <p className="mt-2 text-sm break-all">
                Chave no XML: {nota.chaveNfeReferenciada ?? 'não encontrada'}
              </p>
              {(nota.nfesVinculadas ?? []).length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {nota.nfesVinculadas!.map((v) => (
                    <li key={v.id}>
                      <Link className="underline" href={`/entrada-notas/${v.nfe?.id}?aba=frete`}>
                        NF …{v.nfe?.chaveNfe?.slice(-8)} — {v.nfe?.nomeEmitente}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ainda sem vínculo com NF de mercadoria. O sistema busca na Focus pela chave
                    acima.
                  </p>
                  {nota.chaveNfeReferenciada && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={acao || finalizada}
                      onClick={() => postAcao('/analisar')}
                    >
                      Buscar NF pela chave
                    </Button>
                  )}
                </div>
              )}
            </CardPadrao>
          )}

          {ehNfe55 && (
            <CardPadrao titulo="CT-es vinculados">
              {(nota.ctesVinculados ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum CT-e vinculado.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {nota.ctesVinculados!.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          …{v.cte?.chaveNfe?.slice(-8)} · {v.cte?.nomeEmitente ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.origemVinculo} ·{' '}
                          {(v.valorFrete ?? v.cte?.valorTotal)?.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }) ?? '—'}
                        </p>
                        {v.cte?.id && (
                          <CfopEntradaFreteCampos
                            compacto
                            cfopXml={v.cfop}
                            cfopEntrada={v.cfopEntrada}
                            cfopsEntrada={cfopsEntrada}
                            finalizada={finalizada}
                            acao={acao}
                            onDefinirCfopEntrada={(cfopId) =>
                              void definirCfopEntradaCte(v.cte!.id, cfopId)
                            }
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        {v.cte?.id && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/entrada-notas/${v.cte.id}`}>Abrir CT-e</Link>
                          </Button>
                        )}
                        {!finalizada && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={acao}
                            onClick={() => void deleteVinculo(v.id)}
                          >
                            Desvincular
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!finalizada && (
                <div
                  className={
                    nota.exigeCte && (nota.ctesVinculados ?? []).length === 0
                      ? 'mt-4 space-y-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-3'
                      : 'mt-4 space-y-2'
                  }
                >
                  {nota.exigeCte && (nota.ctesVinculados ?? []).length === 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        Incluir CT-e manualmente
                      </p>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                        Frete por conta do destinatário exige CT-e. Se o sync não vinculou
                        automaticamente, cole a chave de acesso do CT-e (44 dígitos) — o
                        documento precisa já estar na Entrada de Notas desta empresa.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Opcional: vincular outro CT-e pela chave.
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[240px] flex-1">
                      <Label htmlFor="chave-cte">Chave do CT-e</Label>
                      <input
                        id="chave-cte"
                        className="mt-1 block w-full max-w-xl rounded-md border bg-background px-3 py-2 font-mono text-sm"
                        value={chaveCteManual}
                        onChange={(e) =>
                          setChaveCteManual(e.target.value.replace(/\D/g, '').slice(0, 44))
                        }
                        placeholder="44 dígitos da chave de acesso"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={acao || chaveCteManual.length < 44}
                      onClick={() =>
                        postAcao('/vincular-cte', { chaveCte: chaveCteManual }).then(() =>
                          setChaveCteManual('')
                        )
                      }
                    >
                      Vincular CT-e
                    </Button>
                  </div>
                </div>
              )}
            </CardPadrao>
          )}

          {(ehNfe55 || ehCte) && (
            <CardPadrao titulo="Financeiro (prévia)">
              <p className="mb-3 text-xs text-muted-foreground">
                Prévia — contas a pagar será gerado no lançamento (futuro). Hoje só grava stub
                (duplicatas: número, vencimento e valor) sem título no financeiro. Ao adicionar
                parcela o valor é dividido por igual; você pode ajustar depois. A soma deve bater
                com o Valor Frete (total do transporte).
              </p>
              {ehNfe55 && (nota.ctesVinculados ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Vincule um CT-e para preencher o financeiro do frete.
                </p>
              ) : (
                (() => {
                  const totalTransporte = resolverTotalTransporteUi(nota)
                  const somaDup = somaParcelasFinanceiro(finParcelas)
                  const somaBate =
                    totalTransporte > 0 &&
                    Math.abs(somaDup - totalTransporte) <= TOLERANCIA_PARCELAS_FRETE
                  const valoresOk = finParcelas.every((p) => {
                    const n = Number(p.valor)
                    return p.valor !== '' && Number.isFinite(n) && n > 0
                  })
                  const vencOk =
                    finParcelas.length === 1 ||
                    finParcelas.every((p) => Boolean(p.vencimento?.trim()))
                  const podeSalvar = !acao && valoresOk && vencOk && somaBate
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <p>
                          <span className="text-muted-foreground">Total transporte (Valor Frete): </span>
                          <span className="font-medium">{formatMoedaBr(totalTransporte || null)}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Soma das duplicatas: </span>
                          <span
                            className={
                              somaBate
                                ? 'font-medium text-emerald-700 dark:text-emerald-400'
                                : 'font-medium text-amber-700 dark:text-amber-400'
                            }
                          >
                            {formatMoedaBr(somaDup)}
                          </span>
                        </p>
                      </div>
                      {!somaBate && valoresOk && totalTransporte > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          A soma das duplicatas deve ser igual ao Valor Frete (
                          {formatMoedaBr(totalTransporte)}).
                        </p>
                      )}
                      <div className="space-y-2">
                        {finParcelas.map((parcela, index) => (
                          <div
                            key={index}
                            className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 p-2"
                          >
                            <div className="min-w-[120px] flex-1">
                              <Label htmlFor={`fin-numero-doc-${index}`}>Número do documento</Label>
                              <input
                                id={`fin-numero-doc-${index}`}
                                className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                                value={parcela.numeroDocumento}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFinParcelas((prev) =>
                                    prev.map((p, i) =>
                                      i === index ? { ...p, numeroDocumento: v } : p
                                    )
                                  )
                                }}
                                disabled={finalizada || pipelineBloqueado}
                                autoComplete="off"
                              />
                            </div>
                            <div className="min-w-[140px]">
                              <Label htmlFor={`fin-vencimento-${index}`}>Data de vencimento</Label>
                              <input
                                id={`fin-vencimento-${index}`}
                                type="date"
                                className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                                value={parcela.vencimento}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFinParcelas((prev) =>
                                    prev.map((p, i) =>
                                      i === index ? { ...p, vencimento: v } : p
                                    )
                                  )
                                }}
                                disabled={finalizada || pipelineBloqueado}
                              />
                            </div>
                            <div className="min-w-[120px]">
                              <Label htmlFor={`fin-valor-${index}`}>Valor</Label>
                              <input
                                id={`fin-valor-${index}`}
                                type="number"
                                step="0.01"
                                min="0"
                                className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                                value={parcela.valor}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFinParcelas((prev) =>
                                    prev.map((p, i) => (i === index ? { ...p, valor: v } : p))
                                  )
                                }}
                                disabled={finalizada || pipelineBloqueado}
                              />
                            </div>
                            {!finalizada && !pipelineBloqueado && finParcelas.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={acao}
                                onClick={() =>
                                  setFinParcelas((prev) =>
                                    ratearParcelasIguaisFrete(
                                      prev.filter((_, i) => i !== index),
                                      totalTransporte
                                    )
                                  )
                                }
                              >
                                Remover
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      {!finalizada && !pipelineBloqueado && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={acao}
                            onClick={() =>
                              setFinParcelas((prev) =>
                                ratearParcelasIguaisFrete(
                                  [...prev, parcelaFinanceiroVazia()],
                                  totalTransporte
                                )
                              )
                            }
                          >
                            Adicionar parcela
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!podeSalvar}
                            onClick={() => {
                              const cteId =
                                ehCte ? nota.id : (nota.ctesVinculados ?? [])[0]?.cte?.id
                              void postAcao('/financeiro-frete', {
                                cteId,
                                parcelas: finParcelas.map((p) => ({
                                  numeroDocumento: p.numeroDocumento || null,
                                  vencimento: p.vencimento || null,
                                  valor: Number(p.valor),
                                })),
                              })
                            }}
                          >
                            Salvar prévia
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
            </CardPadrao>
          )}
        </div>
      )}

      {abaAtiva === 'lancamento' && (
        <div className="space-y-4">
          {!pipelineBloqueado ? (
            <CardPadrao titulo="Lançamento">
              <p className="mb-3 text-sm text-muted-foreground">
                {ehDocumental
                  ? 'Conferência documental. Liberar para contagem não movimenta estoque.'
                  : 'Conferência final. Consolidar exige senha (só status; ledger futuro).'}
              </p>
              {abaBloqueada('lancamento') && (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                  Resolva as etapas anteriores (cadastro → fiscal → negociação → frete) antes de lançar.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <BotaoPrimario
                  type="button"
                  disabled={acao || abaBloqueada('lancamento')}
                  onClick={() => postAcao('/lancar', { modo: 'contagem' })}
                >
                  Liberar para contagem
                </BotaoPrimario>
                <div>
                  <Label htmlFor="senha-consolidar">Senha gerente</Label>
                  <input
                    id="senha-consolidar"
                    type="password"
                    className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={acao || !senha || abaBloqueada('lancamento')}
                  onClick={() => postAcao('/lancar', { modo: 'consolidar', senha })}
                >
                  {ehDocumental ? 'Consolidar (documental)' : 'Consolidar estoque'}
                </Button>
              </div>
            </CardPadrao>
          ) : (
            <CardPadrao
              titulo={
                comProblema || problemaResolvido
                  ? 'Fora do fluxo (com problema)'
                  : 'Finalizada'
              }
            >
              <p className="text-sm">
                Status <strong>{nota.statusEntrada}</strong>
                {nota.origemLancamento ? ` · origem ${nota.origemLancamento}` : ''}.
                {comProblema
                  ? ' Use o card Nota com problema para tratativas e desfecho.'
                  : problemaResolvido
                    ? ' Problema resolvido — nota fora do fluxo de entrada.'
                    : ''}
              </p>
              {nota.statusEntrada === 'cancelada' && nota.manifestacaoDestinatario && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Manifestação registrada:{' '}
                  <strong>
                    {nota.manifestacaoDestinatario === 'desconhecimento_da_operacao'
                      ? 'Desconhecimento da operação'
                      : nota.manifestacaoDestinatario === 'operacao_nao_realizada'
                        ? 'Operação não realizada'
                        : nota.manifestacaoDestinatario}
                  </strong>
                </p>
              )}
              {(nota.despesasFrete ?? []).length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="font-medium">Despesas de frete (CT-e)</p>
                  <ul className="mt-1 space-y-1">
                    {nota.despesasFrete!.map((d) => (
                      <li key={d.id}>
                        {d.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} —{' '}
                        {d.status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {nota.statusEntrada === 'cancelada' && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={acao}
                    onClick={() => void descancelarNota()}
                  >
                    Desfazer cancelamento
                  </Button>
                )}
                <Button type="button" onClick={() => router.push('/entrada-notas')}>
                  Voltar à lista
                </Button>
              </div>
            </CardPadrao>
          )}
        </div>
      )}
    </div>
  )
}

export default function PaginaDetalheEntradaNota() {
  return (
    <ProtegerRota chaveDaPagina="entrada-notas">
      <ConteudoDetalheEntrada />
    </ProtegerRota>
  )
}
