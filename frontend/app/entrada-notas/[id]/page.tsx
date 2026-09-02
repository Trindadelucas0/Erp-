'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { blobParecePdf, dispararDownloadArquivo } from '@/lib/disparar-download-arquivo'
import { CardPadrao } from '@/components/ui/card-padrao'
import { TituloPagina } from '@/components/ui/titulo-pagina'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmacao } from '@/components/compartilhado/modal-confirmacao'
import { ModalCiencia } from '@/components/compartilhado/modal-ciencia'
import { Abas } from '@/components/ui/abas'
import {
  ConteudoVisualizacaoNota,
  type VisualizacaoNota,
} from '@/components/entrada-notas/conteudo-visualizacao-nota'
import { BarraCarregamentoDownload } from '@/components/entrada-notas/barra-carregamento-download'
import {
  ItemVinculoCadastroGrid,
  MSG_GRAVAR_CODIGO_ORIGINAL_SEM_FORNECEDOR,
} from '@/components/entrada-notas/item-vinculo-cadastro-grid'
import {
  ItemVinculoFiscalGrid,
  type CfopOpcaoEntrada,
} from '@/components/entrada-notas/item-vinculo-fiscal-grid'
import { CfopEntradaFreteCampos } from '@/components/entrada-notas/cfop-entrada-frete'
import {
  NegociacaoResumo,
  type AchadoNegociacao,
} from '@/components/entrada-notas/negociacao-resumo'
import { CadastroResumo } from '@/components/entrada-notas/cadastro-resumo'
import { EtapaResumo } from '@/components/entrada-notas/etapa-resumo'
import { CheckCircle2, Paperclip, Download } from 'lucide-react'
import { formatarQtdEstoque } from '@/lib/estoque'
import { SUBTIPO_CFOP_CONHECIMENTO_FRETE } from '@/lib/cfop'
import { distribuirParcelasIguais } from '@/lib/parcelas-pagamento-pedido'
import {
  ehDocumentalEntrada,
  ehSemContagemFisicaEntrada,
  prefixoPdfDocumento,
  rotuloTipoDocumentoLongo,
} from '@/lib/tipo-documento-entrada'
import { AcoesConsolidarDocumental } from '@/components/entrada-notas/acoes-consolidar-documental'
import {
  BlocoFinanceiroDocumental,
  type PreviaFinanceira,
} from '@/components/entrada-notas/bloco-financeiro-documental'
import { CardDadosNotaEntrada } from '@/components/entrada-notas/card-dados-nota-entrada'
import {
  TabelaPedidoDivergencias,
  type ResumoPedidoCompra,
} from '@/components/entrada-notas/tabela-pedido-divergencias'
import { ComboboxPlanoFinanceiro } from '@/components/contas-a-pagar/combobox-plano-financeiro'
import type { PlanoFinanceiroOpcao } from '@/lib/contas-a-pagar'
import { extrairSerieNumeroChave, tituloAnaliseEntrada } from '@/lib/chave-acesso-nfe'
import { gravarDeepLinkFornecedor } from '@/lib/fornecedor-deep-link'
import { prepararImagemAteBytes } from '@/lib/comprimir-imagem-ate-bytes'
import type { StatusDaAba } from '@/hooks/use-validacao-de-abas'

const MAX_BYTES_ANEXO_DIVERGENCIA = 2 * 1024 * 1024
const MIMES_ANEXO_DIVERGENCIA_OK = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

function mimeAnexoDivergenciaPelaExtensao(nome: string): string {
  const n = nome.toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.webp')) return 'image/webp'
  return ''
}

function resolverMimeAnexoDivergencia(file: File): string {
  const informado = (file.type || '').toLowerCase()
  if (informado && MIMES_ANEXO_DIVERGENCIA_OK.has(informado)) {
    return informado === 'image/jpg' ? 'image/jpeg' : informado
  }
  return mimeAnexoDivergenciaPelaExtensao(file.name)
}

function lerArquivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

type ResultadoEtapa = {
  status: string
  avisos: string[]
  bloqueios: string[]
  bloqueiosNaoLiberaveis?: string[]
  exigeManifesto?: boolean
  detalhes?: {
    achados?: AchadoNegociacao[]
    pedidoCompraId?: string
    numero?: number
    classificacao?: string
    [key: string]: unknown
  }
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

type EstoqueResumoLancamento = {
  movimentou: boolean
  itensProcessados: number
  itensIgnorados: number
  movimentosGravados: number
  produtos: Array<{ produtoId: string; nomeVenda: string; quantidade: number }>
}

type PedidoDisponivelNegociacao = {
  id: string
  numero: number
  status: string
  fornecedorPessoaId?: string
  fornecedorNome?: string | null
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
  /** NFe 55: revenda | uso_consumo | null */
  finalidadeEntrada?: 'revenda' | 'uso_consumo' | null
  prazoPagamentoXml: string | null
  prazoPagamentoTexto: string | null
  problemaDesfecho?: string | null
  problemaMarcadoEm?: string | null
  problemaResolvidoEm?: string | null
  /// bloqueio | null — desfecho da correção de divergência de contagem (§7.17)
  divergenciaDesfecho?: string | null
  divergenciaResolvidaEm?: string | null
  anexoDivergencia?: { id: string; nomeArquivo: string; tipoAnexo?: string } | null
  anexos?: Array<{ id: string; tipoAnexo: string; nomeArquivo: string; createdAt?: string }>
  divergenciaGestao?: {
    bloqueioExplicacao?: string
    bloqueioEm?: string
    desbloqueioExplicacao?: string
    desbloqueioEm?: string
  } | null
  auditoriaChegada?: {
    achados: Array<{
      tipo: 'preco' | 'nome'
      itemId: string
      nItem: number
      produto: string
      mensagem: string
      nomeNf?: string
      nomeSistema?: string
      precoAtual?: number
      precoUltima?: number
    }>
    fingerprint: string
    aceitoEm?: string | null
    pendente: boolean
  } | null
  contagemBaixada?: boolean
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
  /** Preenchido quando o reparo automático de XML via Focus falhou (ex.: 429). */
  avisoReparoXml?: string | null
  /** NFe consolidada com movimentos de estoque (origem nfe). */
  estoqueLancado?: boolean
  /** Resumo persistente dos movimentos (reabre no detalhe consolidado). */
  estoqueResumo?: EstoqueResumoLancamento | null
  /** Itens retidos por Bloquear estoque (§7.17) — situação atual no ledger. */
  itensBloqueados?: {
    itens: Array<{
      produtoId: string
      nomeVenda: string
      quantidadeBloqueada: number
      status: 'bloqueado' | 'desbloqueado'
    }>
    totais: { itens: number; aindaBloqueados: number; desbloqueados: number }
  } | null
  /** Títulos gerados em Contas a Pagar (mercadoria + frete). */
  contasPagar?: Array<{
    id: string
    codigo: string
    origem: string
    status: string
    valorTotal: number
    nfeRecebidaId: string | null
  }>
  planoFinanceiroId?: string | null
  parcelasFinanceiras?: Array<{
    numeroDocumento: string | null
    vencimento: string | null
    valor: number | null
  }>
  recorrenciaFinanceiraId?: string | null
  recorrenciaFinanceira?: {
    id: string
    valor: number | null
    diaVencimento: number
    periodicidade: string
  } | null
  previaFinanceira?: PreviaFinanceira | null
  resumoPedidoCompra?: ResumoPedidoCompra | null
  planoFinanceiro?: { id: string; codigo: string; nome: string } | null
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

const ORDEM_ETAPAS: EtapaPipeline[] = ['frete', 'cadastro', 'fiscal', 'negociacao']

const ROTULOS_ETAPA: Record<EtapaPipeline, string> = {
  frete: 'Frete / CT-e',
  cadastro: 'Cadastro',
  fiscal: 'Fiscal',
  negociacao: 'Negociação',
}

function statusAbaDeEtapa(etapa?: ResultadoEtapa | null): StatusDaAba {
  if (!etapa || etapa.status === 'pendente') return 'idle'
  if (etapa.status === 'ok') return 'valid'
  if (etapa.status === 'bloqueante') return 'error'
  return 'idle'
}

function notaLiberadaOuConsolidada(status: string): boolean {
  return (
    status === 'aguardando_chegada' ||
    status === 'entrada_contagem' ||
    status === 'entrada_contagem_ok' ||
    status === 'entrada_contagem_divergente' ||
    status === 'pronta_para_consolidar' ||
    status === 'entrada_consolidada'
  )
}

function abasValidasParaNota(nota: DetalheNota): AbaId[] {
  if (nota.tipoDocumento === 'nfse') return ['cadastro', 'lancamento']
  if (nota.tipoDocumento === 'cte') return ['cadastro', 'frete', 'lancamento']
  return ['frete', 'cadastro', 'fiscal', 'negociacao', 'lancamento']
}

function abaInicial(nota: DetalheNota): AbaId {
  const etapa = nota.etapaAtual
  const motivo = nota.analise?.motivoParada
  if (notaLiberadaOuConsolidada(nota.statusEntrada)) {
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
  if (notaLiberadaOuConsolidada(nota.statusEntrada)) {
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
  // NFS-e/CT-e: só cadastro. NFe 55 (revenda ou consumo): frete → cadastro → …
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
      return `CT-e vinculado à NF …${chave?.slice(-8) ?? ''}. Custo e título a pagar saem na NF de mercadoria — abra a NF (aba Frete/CT-e).`
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
      return b
        ? `Parou em cadastro: ${b}`
        : 'Parou em cadastro: cadastre a transportadora (ou fornecedor) do emitente.'
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
    notaLiberadaOuConsolidada(nota.statusEntrada)
  ) {
    return `Nota lançada: ${rotuloStatusEntrada(nota.statusEntrada)}.`
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

function rotuloStatusEntrada(status: string): string {
  const mapa: Record<string, string> = {
    pendente: 'Pendente',
    em_analise: 'Em análise',
    stand_by: 'Em espera',
    aguardando_chegada: 'Aguardando chegada',
    entrada_contagem: 'Liberada para contagem',
    entrada_contagem_ok: 'Contagem OK — pronta para consolidar',
    entrada_contagem_divergente: 'Contagem divergente — pendente correção admin',
    pronta_para_consolidar: 'Pronta para consolidar',
    entrada_consolidada: 'Entrada consolidada',
    cancelada: 'Cancelada',
    com_problema: 'Com problema',
    problema_resolvido: 'Problema resolvido',
  }
  return mapa[status] ?? status
}

function rotuloOrigemLancamento(origem: string | null | undefined): string {
  if (origem === 'automatica') return 'automática'
  if (origem === 'humana') return 'manual'
  return origem ?? ''
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

function textoBloqueioEtapa(b: unknown): string {
  return typeof b === 'string' ? b : ''
}

function bloqueioRegraRateioAusente(etapa?: ResultadoEtapa | null): boolean {
  return (etapa?.bloqueios ?? []).some((b) =>
    textoBloqueioEtapa(b).toLowerCase().includes('regra de rateio')
  )
}

function bloqueioValorFreteAusente(etapa?: ResultadoEtapa | null): boolean {
  return (etapa?.bloqueios ?? []).some((b) =>
    textoBloqueioEtapa(b).toLowerCase().includes('valor do frete')
  )
}

function bloqueioCfopEntradaFrete(etapa?: ResultadoEtapa | null): boolean {
  return (etapa?.bloqueios ?? []).some((b) =>
    textoBloqueioEtapa(b).toLowerCase().includes('cfop de entrada')
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

/**
 * Valor default da prévia sem stub: prefere Valor Frete / total transporte
 * (para a soma já bater no Salvar). Fallback: vRec do XML.
 */
function valorDefaultFinanceiroFrete(
  totalTransporte: number,
  sugestaoValor: number | null | undefined
): number | null {
  if (totalTransporte > 0) return Math.round(totalTransporte * 100) / 100
  if (sugestaoValor != null && Number.isFinite(sugestaoValor) && sugestaoValor > 0) {
    return Math.round(sugestaoValor * 100) / 100
  }
  return null
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
  const parcelas = Array.isArray(stub?.parcelas) ? stub!.parcelas! : []
  if (parcelas.length > 0) {
    return parcelas.map((p) => ({
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

function assinaturaParcelas(
  parcelas: Array<{ numeroDocumento?: string | null; vencimento?: string | null; valor?: number | null }> | null | undefined
): string {
  if (!Array.isArray(parcelas) || parcelas.length === 0) return ''
  return parcelas
    .map((p) => `${p.numeroDocumento ?? ''}:${p.vencimento ?? ''}:${p.valor ?? ''}`)
    .join(',')
}

function assinaturaDespesasFrete(nota: DetalheNota | null | undefined): string {
  return (nota?.despesasFrete ?? [])
    .map(
      (d) =>
        `${d.id}:${d.numeroDocumento ?? ''}:${d.vencimento ?? ''}:${d.valor ?? ''}:${assinaturaParcelas(d.parcelas)}`
    )
    .join('|')
}

function assinaturaCtesFinanceiro(nota: DetalheNota | null | undefined): string {
  return (nota?.ctesVinculados ?? [])
    .map(
      (v) =>
        `${v.id}:${v.financeiro?.id ?? ''}:${v.financeiro?.valor ?? ''}:${v.valorFrete ?? ''}:${v.cte?.valorTotal ?? ''}:${v.sugestaoFinanceiroFrete?.numeroDocumento ?? ''}:${v.sugestaoFinanceiroFrete?.valor ?? ''}:${assinaturaParcelas(v.financeiro?.parcelas)}`
    )
    .join('|')
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
  onManifestar,
}: {
  acao: boolean
  justificativa: string
  onJustificativaChange: (valor: string) => void
  onManifestar: (tipo: 'desconhecimento' | 'nao_realizada') => void
}) {
  return (
    <CardPadrao titulo="Manifestação do destinatário">
      <p className="mb-3 text-sm text-muted-foreground">
        Use quando a nota não pode seguir no fluxo normal (ex.: CST/CFOP impeditivo ou operação que
        a empresa não reconhece). A nota vai para o painel <strong>Canceladas</strong> e não pode
        mais ser lançada.
      </p>
      <textarea
        className="mb-3 min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={justificativa}
        onChange={(e) => onJustificativaChange(e.target.value)}
        placeholder="Justificativa (obrigatória para operação não realizada)"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={acao}
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={acao} onClick={onResolver}>
              Registrar solução
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={acao}
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

function ConteudoDetalheEntrada() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = String(params.id)
  const [nota, setNota] = useState<DetalheNota | null>(null)
  const [pedidos, setPedidos] = useState<PedidoDisponivelNegociacao[]>([])
  const [cfopsEntrada, setCfopsEntrada] = useState<CfopOpcaoEntrada[]>([])
  const [cfopsEntradaFrete, setCfopsEntradaFrete] = useState<CfopOpcaoEntrada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [estoqueResumo, setEstoqueResumo] = useState<EstoqueResumoLancamento | null>(null)
  const [senha, setSenha] = useState('')
  const [senhaDivergencia, setSenhaDivergencia] = useState('')
  const [explicacaoDivergencia, setExplicacaoDivergencia] = useState('')
  const [explicacaoDesbloqueio, setExplicacaoDesbloqueio] = useState('')
  const [anexoDivergenciaArquivo, setAnexoDivergenciaArquivo] = useState<{
    nomeArquivo: string
    mimeType: string
    base64Arquivo: string
  } | null>(null)
  const [infoAnexoDivergencia, setInfoAnexoDivergencia] = useState<string | null>(null)
  const [erroAnexoDivergencia, setErroAnexoDivergencia] = useState<string | null>(null)
  const [obsContato, setObsContato] = useState('')
  const [justificativaManifesto, setJustificativaManifesto] = useState('')
  const [textoTratativa, setTextoTratativa] = useState('')
  const [prazo, setPrazo] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtos, setProdutos] = useState<ProdutoBusca[]>([])
  const [carregandoBuscaProduto, setCarregandoBuscaProduto] = useState(false)
  const [itemVinculando, setItemVinculando] = useState<string | null>(null)
  const buscaProdutoSeq = useRef(0)
  const [acao, setAcao] = useState(false)
  const [xmlBusy, setXmlBusy] = useState(false)
  const [downloadRotulo, setDownloadRotulo] = useState('')
  const [xmlModal, setXmlModal] = useState<{ visualizacao: VisualizacaoNota } | null>(null)
  const [modalMarcarProblema, setModalMarcarProblema] = useState(false)
  const [modalEstoqueBloqueado, setModalEstoqueBloqueado] = useState<{
    aberto: boolean
    motivo: string
  }>({ aberto: false, motivo: '' })
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
  const [planoDocumentalId, setPlanoDocumentalId] = useState('')
  const [planosFinanceiros, setPlanosFinanceiros] = useState<PlanoFinanceiroOpcao[]>([])
  const [codigosOriginaisGravados, setCodigosOriginaisGravados] = useState<Record<string, true>>(
    {}
  )

  const abaQuery = searchParams.get('aba')
  const carregarEmVoo = useRef<{ id: string; promise: Promise<void> } | null>(null)

  const carregar = useCallback(async () => {
    if (carregarEmVoo.current?.id === id) {
      await carregarEmVoo.current.promise
      return
    }

    const run = (async () => {
      setCarregando(true)
      setErro(null)
      try {
        const { data } = await clienteHttp.get<{
          nota: DetalheNota
          pedidosDisponiveis: PedidoDisponivelNegociacao[]
        }>(`/entrada-notas/${id}`, { timeout: 30_000 })
        setNota(data.nota)
        setPedidos(data.pedidosDisponiveis ?? [])
        setObsContato(data.nota.observacaoContato ?? '')
        setPrazo(data.nota.prazoPagamentoTexto ?? '')
        setEstoqueResumo(data.nota.estoqueResumo ?? null)
        setAbaAtiva(resolverAbaInicial(data.nota, abaQuery))
        if (data.nota.avisoReparoXml) {
          setErro(data.nota.avisoReparoXml)
        }
      } catch (err) {
        const axiosCode =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: string }).code ?? '')
            : ''
        const msgTimeout =
          axiosCode === 'ECONNABORTED' || axiosCode === 'ETIMEDOUT'
            ? 'A nota demorou demais para abrir. Tente de novo; se persistir, use Reanalisar ou Importar XML.'
            : extrairMensagemApi(err, 'Falha ao carregar nota.')
        setErro(msgTimeout)
        setNota(null)
      } finally {
        setCarregando(false)
      }
    })()

    carregarEmVoo.current = { id, promise: run }
    try {
      await run
    } finally {
      if (carregarEmVoo.current?.promise === run) carregarEmVoo.current = null
    }
  }, [id, abaQuery])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    let ativo = true
    clienteHttp
      .get<{ planos: PlanoFinanceiroOpcao[] }>('/planos-financeiros', {
        params: { tipo: 'despesa', ativo: true },
      })
      .then(({ data }) => {
        if (ativo) setPlanosFinanceiros(data.planos ?? [])
      })
      .catch(() => {
        if (ativo) setPlanosFinanceiros([])
      })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!nota) return
    const semContagem = ehSemContagemFisicaEntrada(
      nota.tipoDocumento,
      nota.finalidadeEntrada === 'uso_consumo'
    )
    if (semContagem) {
      setPlanoDocumentalId(
        nota.planoFinanceiroId ?? nota.previaFinanceira?.planoFinanceiroId ?? ''
      )
      const parcelas = nota.parcelasFinanceiras ?? []
      if (parcelas.length > 0) {
        setFinParcelas(
          parcelas.map((p) => ({
            numeroDocumento: p.numeroDocumento ?? '',
            vencimento: p.vencimento ?? '',
            valor: p.valor != null ? String(p.valor) : '',
          }))
        )
      } else if ((nota.previaFinanceira?.parcelas?.length ?? 0) > 0) {
        setFinParcelas(
          nota.previaFinanceira!.parcelas.map((p) => ({
            numeroDocumento: p.numeroDocumento ?? '',
            vencimento: p.vencimento ?? '',
            valor: p.valor != null ? String(p.valor) : '',
          }))
        )
      } else {
        setFinParcelas([
          {
            numeroDocumento: '',
            vencimento: '',
            valor: nota.valorTotal != null ? String(nota.valorTotal) : '',
          },
        ])
      }
      return
    }
    const totalTransporte = resolverTotalTransporteUi(nota)
    if (nota.tipoDocumento === 'cte') {
      const fin = (nota.despesasFrete ?? [])[0]
      const sugestao = nota.sugestaoFinanceiroFrete
      setFinParcelas(
        stubParaParcelasUi(fin, {
          numeroDocumento: sugestao?.numeroDocumento ?? '',
          valor: valorDefaultFinanceiroFrete(totalTransporte, sugestao?.valor),
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
        valor: valorDefaultFinanceiroFrete(totalTransporte, sugestao?.valor),
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reidrata só quando vínculos/despesa/total frete mudam
  }, [
    nota?.id,
    nota?.tipoDocumento,
    nota?.valorTotal,
    nota?.sugestaoFinanceiroFrete?.numeroDocumento,
    nota?.sugestaoFinanceiroFrete?.valor,
    assinaturaDespesasFrete(nota),
    nota?.parcelasFinanceiras,
    nota?.planoFinanceiroId,
    nota?.finalidadeEntrada,
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

  useEffect(() => {
    let ativo = true
    clienteHttp
      .get<{ cfops: CfopOpcaoEntrada[] }>('/cfops', {
        params: { tipo: 'entrada', subtipo: SUBTIPO_CFOP_CONHECIMENTO_FRETE },
      })
      .then(({ data }) => {
        if (ativo) setCfopsEntradaFrete(data.cfops ?? [])
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
      dispararDownloadArquivo(
        new Blob([resp.data], { type: 'application/xml' }),
        `${prefixoPdfDocumento(nota?.tipoDocumento)}-${nota?.chaveNfe || id}.xml`
      )
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
      const blob =
        resp.data instanceof Blob
          ? resp.data
          : new Blob([resp.data], { type: 'application/pdf' })
      if (!(await blobParecePdf(blob))) {
        throw new Error('Resposta não é um PDF válido.')
      }
      dispararDownloadArquivo(
        blob,
        `${prefixoPdfDocumento(nota?.tipoDocumento)}-${nota?.chaveNfe || id}.pdf`
      )
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
        pedidosDisponiveis?: PedidoDisponivelNegociacao[]
        mensagem?: string
        sucesso?: boolean
        estoqueResumo?: EstoqueResumoLancamento
        contasPagarResumo?: { gerados: number; contas: Array<{ codigo: string; origem: string }> }
      }>(`/entrada-notas/${id}${path}`, body ?? {})
      if (data.nota) {
        setNota(data.nota)
        setPedidos(data.pedidosDisponiveis ?? [])
        if (data.nota.estoqueResumo) setEstoqueResumo(data.nota.estoqueResumo)
        if (
          path !== '/financeiro-frete' &&
          path !== '/definir-cfop-entrada' &&
          path !== '/definir-cfop-entrada-cte' &&
          path !== '/finalidade-entrada'
        ) {
          setAbaAtiva(abaInicial(data.nota))
        }
        const sufixoContas =
          data.contasPagarResumo && data.contasPagarResumo.gerados > 0
            ? ` · ${data.contasPagarResumo.gerados} título(s) em Contas a Pagar.`
            : data.nota.contasPagar && data.nota.contasPagar.length > 0
              ? ` · ${data.nota.contasPagar.length} título(s) em Contas a Pagar.`
              : ''
        if (path === '/analisar' || path.startsWith('/analisar')) {
          setMensagem(mensagemAposAnalisar(data.nota))
        } else if (path === '/financeiro-frete') {
          setMensagem('Prévia financeira do frete salva (vira Contas a Pagar ao consolidar).')
        } else if (path === '/definir-cfop-entrada' || path === '/definir-cfop-entrada-cte') {
          setMensagem('CFOP de entrada atualizado.')
        } else if (path === '/finalidade-entrada') {
          setMensagem(mensagemAposAnalisar(data.nota))
        } else if (path === '/lancar' && body?.modo === 'consolidar') {
          setSenha('')
          const resumo = data.estoqueResumo ?? data.nota.estoqueResumo ?? null
          if (resumo) setEstoqueResumo(resumo)
          if (resumo?.movimentou) {
            setMensagem(
              `Estoque consolidado: ${resumo.itensProcessados} produto(s) no estoque (físico e fiscal).${sufixoContas}`
            )
          } else if (ehDocumentalEntrada(data.nota.tipoDocumento)) {
            setMensagem(`Nota consolidada (documental — sem movimentação de estoque).${sufixoContas}`)
          } else {
            setMensagem(
              `Nota consolidada. Nenhum item com controle de estoque foi lançado.${sufixoContas}`
            )
          }
        } else if (path === '/resolver-divergencia') {
          const motivoBloqueio =
            data.nota.divergenciaGestao?.bloqueioExplicacao?.trim() ||
            (typeof body?.explicacao === 'string' ? body.explicacao.trim() : '') ||
            'Negociação com o fornecedor após contagem divergente.'
          setSenhaDivergencia('')
          setExplicacaoDivergencia('')
          setAnexoDivergenciaArquivo(null)
          setInfoAnexoDivergencia(null)
          setMensagem(
            `Estoque bloqueado após divergência. A nota foi para Entradas consolidadas.${sufixoContas}`
          )
          setModalEstoqueBloqueado({ aberto: true, motivo: motivoBloqueio })
        } else if (path === '/baixar-contagem') {
          setSenha('')
          if (data.nota.statusEntrada === 'entrada_consolidada') {
            const resumo = data.estoqueResumo ?? data.nota.estoqueResumo ?? null
            if (resumo) setEstoqueResumo(resumo)
            setMensagem(`Contagem baixada e estoque consolidado.${sufixoContas}`)
          } else {
            setMensagem('Contagem baixada. A logística não pode mais alterar. Você pode bloquear o estoque ou voltar para contagem.')
          }
        } else if (path === '/voltar-para-contagem') {
          setMensagem('Baixa cancelada. A logística pode contar de novo.')
        } else if (path === '/desbloquear-estoque') {
          setSenhaDivergencia('')
          setExplicacaoDesbloqueio('')
          setAnexoDivergenciaArquivo(null)
          setMensagem('Estoque desbloqueado — disponível voltou a circular.')
        } else if (path === '/aceitar-auditoria-chegada') {
          setMensagem('Divergências conferidas. Você pode liberar para contagem.')
        } else if (path === '/liberar-para-contagem') {
          setMensagem(
            'Liberada para contagem — a logística confere em Contagens de entrada.'
          )
        } else if (data.nota.statusEntrada === 'aguardando_chegada') {
          setMensagem(
            'Nota lançada — aguardando chegada física para liberar a contagem.'
          )
        } else if (data.nota.origemLancamento === 'automatica') {
          setMensagem('Entrada automática concluída (Liberar para contagem — sem estoque).')
        } else if (notaLiberadaOuConsolidada(data.nota.statusEntrada)) {
          setMensagem(`Nota lançada: ${rotuloStatusEntrada(data.nota.statusEntrada)}.${sufixoContas}`)
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
          const destino = (body?.etapaDestino as EtapaPipeline) ?? 'cadastro'
          const rotulo = ROTULOS_ETAPA[destino]
          setMensagem(
            destino === 'frete'
              ? `Nota reaberta em ${rotulo}. Confira e use Avançar para Cadastro (etapa a etapa — Reanalisar completa o fluxo inteiro).`
              : `Nota reaberta em ${rotulo}. Corrija o necessário e avance etapa a etapa (ou Reanalisar para o fluxo completo).`
          )
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

  async function aoEscolherArquivoDivergencia(file: File | null) {
    if (!file) return
    setErroAnexoDivergencia(null)
    setInfoAnexoDivergencia(null)

    const mime = resolverMimeAnexoDivergencia(file)
    if (!mime || !MIMES_ANEXO_DIVERGENCIA_OK.has(mime)) {
      setErroAnexoDivergencia('Tipo não permitido. Use PDF, JPG, PNG ou WEBP.')
      return
    }

    const ehPdf = mime === 'application/pdf'
    if (ehPdf && file.size > MAX_BYTES_ANEXO_DIVERGENCIA) {
      setErroAnexoDivergencia('PDF não pode ser superior a 2 MB')
      return
    }

    try {
      let nomeArquivo = file.name
      let mimeType = mime
      let base64Arquivo: string

      if (!ehPdf) {
        const preparado = await prepararImagemAteBytes(file, MAX_BYTES_ANEXO_DIVERGENCIA)
        nomeArquivo = preparado.nomeArquivo
        mimeType = preparado.mimeType
        base64Arquivo = preparado.dataUrl
        if (preparado.feedback) setInfoAnexoDivergencia(preparado.feedback)
      } else {
        base64Arquivo = await lerArquivoBase64(file)
      }

      setAnexoDivergenciaArquivo({ nomeArquivo, mimeType, base64Arquivo })
    } catch (e) {
      setErroAnexoDivergencia(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.')
    }
  }

  async function baixarAnexoDivergencia(anexoId: string, nomeArquivo: string) {
    setErro(null)
    try {
      const resposta = await clienteHttp.get(
        `/entrada-notas/${id}/anexo-divergencia/${anexoId}/download`,
        { responseType: 'blob' }
      )
      const blob = new Blob([resposta.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nomeArquivo
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao baixar o anexo.'))
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
          pedidosDisponiveis: PedidoDisponivelNegociacao[]
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
    const justificativa = justificativaManifesto.trim()
    const ok = await postAcao('/manifestar', {
      tipo,
      ...(justificativa ? { justificativa } : {}),
    })
    if (ok) {
      setJustificativaManifesto('')
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
        pedidosDisponiveis?: PedidoDisponivelNegociacao[]
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
      setCarregandoBuscaProduto(false)
      return
    }
    const seq = ++buscaProdutoSeq.current
    setCarregandoBuscaProduto(true)
    try {
      const { data } = await clienteHttp.get<{ produtos?: ProdutoBusca[] }>('/produtos', {
        params: { q, pagina: 1, limite: 20, resumo: 'true' },
      })
      if (seq !== buscaProdutoSeq.current) return
      setProdutos(data.produtos ?? [])
    } catch {
      if (seq !== buscaProdutoSeq.current) return
      setProdutos([])
    } finally {
      if (seq === buscaProdutoSeq.current) setCarregandoBuscaProduto(false)
    }
  }

  useEffect(() => {
    if (!itemVinculando) return
    const timer = setTimeout(() => {
      void buscarProdutos(buscaProduto)
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce ao digitar
  }, [buscaProduto, itemVinculando])

  function abrirBuscaProduto(item: ItemNota) {
    if (item.produtoId) return
    const termo = termoBuscaProdutoItem(item)
    setItemVinculando(item.id)
    setBuscaProduto(termo)
    setProdutos([])
    setCarregandoBuscaProduto(termo.trim().length >= 2)
  }

  const finalizada =
    notaLiberadaOuConsolidada(nota?.statusEntrada ?? '') ||
    nota?.statusEntrada === 'cancelada' ||
    nota?.statusEntrada === 'problema_resolvido'

  const comProblema = nota?.statusEntrada === 'com_problema'
  const problemaResolvido = nota?.statusEntrada === 'problema_resolvido'
  const pipelineBloqueado = finalizada || comProblema
  const podeMarcarProblema =
    Boolean(nota) &&
    ![
      'entrada_contagem',
      'entrada_contagem_ok',
      'entrada_contagem_divergente',
      'entrada_consolidada',
      'cancelada',
      'com_problema',
      'problema_resolvido',
    ].includes(nota!.statusEntrada)

  const ehDocumentalTipo = ehDocumentalEntrada(nota?.tipoDocumento)
  const modoDocumentalNfe = nota?.finalidadeEntrada === 'uso_consumo'
  const ehSemContagemFisica = ehSemContagemFisicaEntrada(
    nota?.tipoDocumento,
    modoDocumentalNfe
  )
  const ehDocumental = ehDocumentalTipo || modoDocumentalNfe
  const ehNfse = nota?.tipoDocumento === 'nfse'
  const ehCte = nota?.tipoDocumento === 'cte'
  /** NFe 55 produto — inclusive uso/consumo (finalidade da nota); não confundir com dossiê NFS-e/CT-e. */
  const ehNfe55 = !ehNfse && !ehCte
  const emAnaliseFinalidade =
    nota?.statusEntrada === 'pendente' ||
    nota?.statusEntrada === 'em_analise' ||
    nota?.statusEntrada === 'stand_by'
  const podeEditarFinalidade =
    ehNfe55 &&
    emAnaliseFinalidade &&
    Boolean(nota?.fornecedor) &&
    !pipelineBloqueado
  const revendaHabilitada = Boolean(nota?.fornecedor?.tipoRevenda)
  const usoConsumoHabilitado =
    Boolean(nota?.fornecedor?.tipoConsumo) || Boolean(nota?.fornecedor?.tipoPrestadorServico)
  function escolherFinalidade(valor: 'revenda' | 'uso_consumo') {
    const habilitada = valor === 'revenda' ? revendaHabilitada : usoConsumoHabilitado
    if (!podeEditarFinalidade || !habilitada || acao) return
    if (nota?.finalidadeEntrada === valor) {
      void postAcao('/finalidade-entrada', { finalidade: null })
      return
    }
    void postAcao('/finalidade-entrada', { finalidade: valor })
  }
  const exigirVinculoDocumental =
    modoDocumentalNfe && Boolean(nota?.fornecedor?.exigirItensEntrada)
  const serieNumero = nota ? extrairSerieNumeroChave(nota.chaveNfe) : { serie: null, numero: null }
  /** Frete remetente: aba só leitura (sem exigir/preencher CT-e, CFOP, financeiro). */
  const freteConsultivo = ehNfe55 && Boolean(nota) && !nota!.exigeCte
  const freteEditavel = !finalizada && !pipelineBloqueado && !freteConsultivo
  const cfopFreteSomenteLeitura = finalizada || freteConsultivo
  const fiscalExigeManifesto =
    nota?.analise?.fiscal?.exigeManifesto === true ||
    (nota?.analise?.fiscal?.bloqueiosNaoLiberaveis?.length ?? 0) > 0 ||
    (nota?.analise?.fiscal?.bloqueios ?? []).some((m) =>
      /sem CFOP(?! de entrada)|sem CST|desconhecimento da opera/i.test(textoBloqueioEtapa(m))
    )
  const fiscalExigeCfopEntrada = (nota?.analise?.fiscal?.bloqueios ?? []).some((m) =>
    /CFOP de entrada/i.test(textoBloqueioEtapa(m))
  )
  const cadastroBloqueante = nota?.analise?.cadastro?.status === 'bloqueante'
  const fiscalBloqueante = nota?.analise?.fiscal?.status === 'bloqueante'
  const negociacaoBloqueante = nota?.analise?.negociacao?.status === 'bloqueante'
  const freteBloqueante = nota?.analise?.frete?.status === 'bloqueante'
  const podeLiberarCriticas =
    !cadastroBloqueante && !fiscalExigeManifesto && !fiscalExigeCfopEntrada
  const motivoBloqueioLiberacao = cadastroBloqueante
    ? nota?.fornecedor
      ? 'Cadastro bloqueante não libera por senha — concilie os produtos sem vínculo e reanalise.'
      : 'Cadastro bloqueante não libera por senha — cadastre o fornecedor e vincule produtos, depois reanalise.'
    : fiscalExigeManifesto
      ? 'CST/CFOP impeditivo não libera por senha — use desconhecimento da operação ou devolução.'
      : fiscalExigeCfopEntrada
        ? 'CFOP de entrada obrigatório — use Trocar em cada item sem sugestão; não libera por senha.'
        : null

  const fiscalTravaAvanco =
    fiscalExigeManifesto ||
    fiscalExigeCfopEntrada ||
    (fiscalBloqueante && !nota?.criticasLiberadas)
  const titulosGeradosNfse = (nota?.contasPagar?.length ?? 0) > 0
  const financeiroDocumentalOk = nota?.previaFinanceira?.completo === true
  const dossieSomenteLeitura = finalizada || comProblema || problemaResolvido
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
      { id: 'frete', rotulo: 'Frete / CT-e', status: statusAbaDeEtapa(nota.analise?.frete) },
      { id: 'cadastro', rotulo: 'Cadastro', status: statusAbaDeEtapa(nota.analise?.cadastro) },
      { id: 'fiscal', rotulo: 'Fiscal', status: statusAbaDeEtapa(nota.analise?.fiscal) },
      { id: 'negociacao', rotulo: 'Negociação', status: statusAbaDeEtapa(nota.analise?.negociacao) },
      { id: 'lancamento', rotulo: 'Lançamento', status: 'idle' as StatusDaAba },
    ]
  }, [nota, ehNfse, ehCte])

  const opcoesVoltarEtapa = useMemo(() => {
    if (!nota) return []
    return etapasVoltarDisponiveis(nota, ehDocumentalTipo)
  }, [nota, ehDocumentalTipo])

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
    // NFe 55: Frete primeiro quando destinatário; remetente não bloqueia.
    const freteTrava = freteBloqueante && Boolean(nota?.exigeCte)
    if (idAba === 'cadastro') return freteTrava
    if (idAba === 'fiscal') return freteTrava || cadastroBloqueante
    if (idAba === 'negociacao') {
      return freteTrava || cadastroBloqueante || fiscalTravaAvanco
    }
    if (idAba === 'frete') {
      return false
    }
    if (idAba === 'lancamento') {
      return (
        freteTrava ||
        cadastroBloqueante ||
        fiscalTravaAvanco ||
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
          <TituloPagina
            subtitulo={
              <div>
                {serieNumero.serie ? <p>Série {serieNumero.serie}</p> : null}
                <span className="font-mono text-xs">{nota.chaveNfe}</span>
              </div>
            }
          >
            {tituloAnaliseEntrada(nota.tipoDocumento, serieNumero.numero)}
          </TituloPagina>
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

      <ModalCiencia
        aberto={modalEstoqueBloqueado.aberto}
        titulo="Estoque bloqueado"
        mensagem={[
          'O estoque desta nota foi bloqueado por contagem divergente.',
          '',
          `Motivo do bloqueio: ${modalEstoqueBloqueado.motivo}`,
          '',
          'As peças desta NF não circulam no disponível até o desbloqueio. A nota está em Entradas consolidadas — o motivo permanece visível nesta tela e no extrato do Estoque (movimentos de bloqueio).',
        ].join('\n')}
        textoConfirmar="Entendi"
        aoConfirmar={() => setModalEstoqueBloqueado({ aberto: false, motivo: '' })}
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

      {ehNfse ? (
        <div className="space-y-4">
          <CardDadosNotaEntrada
            nota={nota}
            rotuloStatus={rotuloStatusEntrada(nota.statusEntrada)}
            cadastroBloqueante={cadastroBloqueante}
            cfopsEntrada={cfopsEntrada}
            cfopEditavel={!dossieSomenteLeitura && !pipelineBloqueado}
            acao={acao}
            onDefinirCfop={(cfopId) => void postAcao('/definir-cfop-entrada-nota', { cfopId })}
            acoesCadastro={
              cadastroBloqueante && !nota.fornecedor && nota.documentoEmitente ? (
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
              ) : undefined
            }
          />

          {nota.recorrenciaFinanceira && (
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
              Recorrência casada — valor {formatMoedaBr(nota.recorrenciaFinanceira.valor)} ·
              vencimento dia {nota.recorrenciaFinanceira.diaVencimento}
            </div>
          )}

          <TabelaPedidoDivergencias
            resumo={nota.resumoPedidoCompra}
            pedidosDisponiveis={pedidos}
            pedidoCompraId={nota.pedidoCompraId}
            desabilitado={dossieSomenteLeitura}
            acao={acao}
            onSelecionarPedido={(pedidoId) => void postAcao('/definir-pedido', { pedidoCompraId: pedidoId })}
          />

          <BlocoFinanceiroDocumental
            notaId={nota.id}
            previa={nota.previaFinanceira}
            planos={planosFinanceiros}
            planoId={planoDocumentalId}
            parcelas={finParcelas}
            titulosGerados={titulosGeradosNfse}
            somenteLeitura={dossieSomenteLeitura}
            acao={acao}
            onPlanoChange={setPlanoDocumentalId}
            onParcelaChange={(index, campo, valor) => {
              setFinParcelas((prev) =>
                prev.map((p, i) => (i === index ? { ...p, [campo]: valor } : p))
              )
            }}
            onSalvar={() =>
              void postAcao('/financeiro-documental', {
                planoFinanceiroId: planoDocumentalId,
                parcelas: finParcelas.map((p) => ({
                  numeroDocumento: p.numeroDocumento || null,
                  vencimento: p.vencimento,
                  valor: Number(p.valor),
                })),
              })
            }
          />

          <AcoesConsolidarDocumental
            senha={senha}
            onSenhaChange={setSenha}
            onConsolidar={() => void postAcao('/lancar', { modo: 'consolidar', senha })}
            desabilitado={dossieSomenteLeitura || pipelineBloqueado}
            acao={acao}
            financeiroCompleto={financeiroDocumentalOk}
            cadastroBloqueante={cadastroBloqueante}
            finalizada={finalizada}
          />
        </div>
      ) : (
        <>
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
          <p className="tabular-nums">
            <span className="text-muted-foreground">Nº:</span>{' '}
            {serieNumero.numero
              ? `${serieNumero.numero}${serieNumero.serie ? ` · Série ${serieNumero.serie}` : ''}`
              : '—'}
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
            {formatMoedaBr(nota.valorTotal)}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{' '}
            {ehCte && (nota.nfesVinculadas?.length ?? 0) > 0
              ? 'Vinculado (custo na NF)'
              : rotuloStatusEntrada(nota.statusEntrada)}
          </p>
          <p>
            <span className="text-muted-foreground">Etapa:</span>{' '}
            {ehCte && (nota.nfesVinculadas?.length ?? 0) > 0 ? 'Vinculado' : nota.etapaAtual}
          </p>
          {ehNfe55 && (
            <p>
              <span className="text-muted-foreground">Frete (modFrete):</span> {rotuloModFrete(nota.modFrete)}
            </p>
          )}
        </div>
        {ehNfe55 && (
          <div className="mt-3 space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Finalidade da entrada</p>
            <p className="text-xs text-muted-foreground">
              Vale para a nota inteira. O cadastro do fornecedor só habilita as opções — é preciso
              marcar aqui, mesmo se só uma estiver disponível. Clique de novo na opção marcada para
              desmarcar.
            </p>
            {!nota.fornecedor && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Vincule o fornecedor para escolher a finalidade.
              </p>
            )}
            <fieldset className="space-y-1" disabled={!podeEditarFinalidade || acao}>
              <legend className="sr-only">Finalidade da entrada</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label
                  className={`flex items-center gap-1.5 ${
                    !revendaHabilitada || !podeEditarFinalidade
                      ? 'text-muted-foreground'
                      : 'cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    name="finalidade-entrada"
                    value="revenda"
                    checked={nota.finalidadeEntrada === 'revenda'}
                    disabled={!podeEditarFinalidade || !revendaHabilitada || acao}
                    onClick={() => escolherFinalidade('revenda')}
                    onChange={() => undefined}
                  />
                  Revenda
                </label>
                <label
                  className={`flex items-center gap-1.5 ${
                    !usoConsumoHabilitado || !podeEditarFinalidade
                      ? 'text-muted-foreground'
                      : 'cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    name="finalidade-entrada"
                    value="uso_consumo"
                    checked={nota.finalidadeEntrada === 'uso_consumo'}
                    disabled={!podeEditarFinalidade || !usoConsumoHabilitado || acao}
                    onClick={() => escolherFinalidade('uso_consumo')}
                    onChange={() => undefined}
                  />
                  Uso e Consumo
                </label>
              </div>
            </fieldset>
            {nota.fornecedor && (!revendaHabilitada || !usoConsumoHabilitado) && (
              <p className="text-xs text-muted-foreground">
                {!revendaHabilitada && !usoConsumoHabilitado
                  ? 'Nenhuma finalidade habilitada neste fornecedor. Ajuste o tipo no cadastro (aba Outros).'
                  : !revendaHabilitada
                    ? 'Revenda desabilitada neste fornecedor. Para usar, marque o tipo Revenda no cadastro (aba Outros).'
                    : 'Uso e Consumo desabilitado neste fornecedor. Para usar, marque Consumo ou Prestador de serviço no cadastro (aba Outros).'}
              </p>
            )}
          </div>
        )}
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
            <CadastroResumo etapa={nota.analise?.cadastro} itens={nota.itens ?? []} />
            {cadastroBloqueante && !nota.fornecedor && nota.documentoEmitente ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {ehCte ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        router.push('/transportadoras')
                      }}
                    >
                      Abrir transportadoras
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        gravarDeepLinkFornecedor({
                          documento: nota.documentoEmitente!,
                          nome: nota.nomeEmitente ?? undefined,
                          retorno: `/entrada-notas/${nota.id}`,
                        })
                        router.push('/fornecedores')
                      }}
                    >
                      Cadastrar como fornecedor
                    </Button>
                  </>
                ) : (
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
                )}
              </div>
            ) : null}
            {ehNfe55 &&
              !finalizada &&
              !pipelineBloqueado &&
              nota.analise?.cadastro?.status === 'ok' && (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={acao || abaBloqueada('fiscal')}
                    onClick={() => postAcao('/analisar', { pararEm: 'fiscal' })}
                  >
                    Avançar para Fiscal
                  </Button>
                </div>
              )}
          </CardPadrao>

          <CardPadrao
            titulo={ehNfse ? 'Serviço (NFS-e)' : ehCte ? 'Transporte (CTe)' : 'Itens — vínculo de produtos'}
          >
            {ehDocumentalTipo ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {ehCte
                    ? 'CTe: o emitente pode ser Transportadora ou Fornecedor (mesmo CNPJ). O vínculo com a NF de mercadoria fica na aba Vínculo NF.'
                    : 'NFS-e: cadastre o prestador como fornecedor. Sem itens de produto.'}
                </p>
                {ehNfse && (
                  <div className="rounded-md border border-border/60 p-3">
                    <p className="mb-2 text-sm font-medium">CFOP de entrada</p>
                    <CfopEntradaFreteCampos
                      cfopXml={null}
                      cfopEntrada={nota.cfopEntrada}
                      cfopsEntrada={cfopsEntrada}
                      finalizada={pipelineBloqueado}
                      acao={acao}
                      onDefinirCfopEntrada={(cfopId) =>
                        void postAcao('/definir-cfop-entrada-nota', { cfopId })
                      }
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {modoDocumentalNfe ? (
                  <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Entrada documental (uso/consumo)
                    {exigirVinculoDocumental
                      ? ' — vínculo de produto exigido para conferência (sem estoque de revenda).'
                      : nota.fornecedor?.permitirVinculoManual
                        ? ' — vínculo de produto não exigido. Você pode conciliar manualmente se quiser.'
                        : ' — vínculo de produto não exigido.'}
                  </p>
                ) : null}
                {(nota.itens ?? []).map((item) => (
                  <ItemVinculoCadastroGrid
                    key={item.id}
                    item={item}
                    finalizada={pipelineBloqueado}
                    acao={acao}
                    buscando={itemVinculando === item.id}
                    carregandoBusca={itemVinculando === item.id && carregandoBuscaProduto}
                    buscaProduto={buscaProduto}
                    produtos={produtos}
                    permitirAcoesVinculo={
                      !modoDocumentalNfe ||
                      Boolean(nota.fornecedor?.permitirVinculoManual) ||
                      exigirVinculoDocumental
                    }
                    vinculoNaoExigido={modoDocumentalNfe && !exigirVinculoDocumental}
                    fornecedorVinculado={Boolean(nota.fornecedor)}
                    onAbrirBusca={() => abrirBuscaProduto(item)}
                    onFecharBusca={() => {
                      setItemVinculando(null)
                      setProdutos([])
                      setBuscaProduto('')
                      setCarregandoBuscaProduto(false)
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
                      setCarregandoBuscaProduto(false)
                    }}
                    codigoOriginalGravado={
                      Boolean(item.codigoOriginalGravado) ||
                      Boolean(codigosOriginaisGravados[item.id])
                    }
                    onGravarCodigoOriginal={
                      item.produtoId && item.codigoProduto
                        ? async () => {
                            if (!nota.fornecedor) {
                              setMensagem(null)
                              setErro(MSG_GRAVAR_CODIGO_ORIGINAL_SEM_FORNECEDOR)
                              return
                            }
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
                {(nota.itens ?? []).length === 0 && (
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
            <EtapaResumo
              etapa={nota.analise?.fiscal}
              dica="Resolva NCM/origem (importar ou liberar críticas) e preencha CFOP de entrada em cada item."
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Divergência de NCM/origem: importe da NF ou liberar críticas. CST/CFOP da NF: desconhecimento
              ou devolução. CFOP de entrada: obrigatório (sugestão ou Trocar) — não libera por senha.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastrou a sugestão de CFOP de entrada em Configurações → Fiscal → CFOP? Clique em{' '}
              <span className="font-medium text-foreground">Reanalisar</span> abaixo para puxar o vínculo
              automático (não sobrescreve CFOP já escolhido com Trocar).
            </p>
            {!finalizada && !pipelineBloqueado && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acao}
                  onClick={() => postAcao('/analisar', { pararEm: 'fiscal' })}
                >
                  Reanalisar
                </Button>
                {(nota.analise?.fiscal?.status === 'ok' ||
                  (nota.criticasLiberadas &&
                    !fiscalExigeManifesto &&
                    !fiscalExigeCfopEntrada &&
                    !fiscalBloqueante)) && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={acao || abaBloqueada('negociacao')}
                    onClick={() => postAcao('/analisar', { pararEm: 'negociacao' })}
                  >
                    Avançar para Negociação
                  </Button>
                )}
              </div>
            )}
          </CardPadrao>
          <CardPadrao titulo="Itens — NCM / origem / CST / CFOP de entrada">
            <div className="space-y-4">
              {(nota.itens ?? []).map((item) => (
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
              {(nota.itens ?? []).length === 0 && (
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
              onManifestar={(tipo) => void manifestar(tipo)}
            />
          )}
        </div>
      )}

      {abaAtiva === 'negociacao' && ehNfe55 && (
        <div className="space-y-4">
          <CardPadrao titulo="Análise de negociação">
            <NegociacaoResumo etapa={nota.analise?.negociacao} />
            {!finalizada &&
              !pipelineBloqueado &&
              (nota.analise?.negociacao?.status === 'ok' ||
                (nota.criticasLiberadas && !negociacaoBloqueante)) && (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={acao || abaBloqueada('lancamento')}
                    onClick={() => postAcao('/analisar')}
                  >
                    Avançar para Lançamento
                  </Button>
                </div>
              )}
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
                      {p.fornecedorNome ? ` — ${p.fornecedorNome}` : ''}
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
        </div>
      )}

      {abaAtiva === 'frete' && (
        <div className="space-y-4">
          {ehNfe55 && (
            <CardPadrao titulo="Frete da mercadoria">
              <EtapaResumo etapa={nota.analise?.frete} />
              {freteConsultivo && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Frete do remetente — etapa consultiva. Não é necessário vincular CT-e nem
                  preencher CFOP/financeiro; o fluxo segue para Cadastro automaticamente.
                </p>
              )}
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
              {bloqueioValorFreteAusente(nota.analise?.frete) && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  Valor do Frete ausente ou zerado. Vincule um CT-e com valor ou confira o frete
                  no XML e depois Reanalisar.
                </div>
              )}
              {bloqueioCfopEntradaFrete(nota.analise?.frete) && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  Escolha o CFOP de entrada do CT-e (Trocar na lista abaixo) e depois Reanalisar.
                </div>
              )}
              {!finalizada &&
                !pipelineBloqueado &&
                nota.analise?.frete?.status === 'ok' &&
                etapaEfetiva(nota) === 'frete' && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      disabled={acao}
                      onClick={() => postAcao('/analisar', { pararEm: 'cadastro' })}
                    >
                      Avançar para Cadastro
                    </Button>
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
                  cfopsEntrada={cfopsEntradaFrete}
                  finalizada={finalizada}
                  acao={acao}
                  onDefinirCfopEntrada={(cfopId) => void definirCfopEntradaCte(nota.id, cfopId)}
                />
              </dl>
            </CardPadrao>
          )}

          {ehCte && (
            <CardPadrao titulo="NF-e referenciada">
              <NegociacaoResumo etapa={nota.analise?.negociacao} />
              <p className="mt-2 text-sm break-all">
                Chave no XML: {nota.chaveNfeReferenciada ?? 'não encontrada'}
              </p>
              {(nota.nfesVinculadas ?? []).length > 0 ? (
                <div className="mt-3 space-y-3 rounded-md border border-emerald-300/60 bg-emerald-50/60 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/20">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                    Vinculado — custo e título a pagar saem na NF de mercadoria (não é preciso
                    lançar este CT-e à parte).
                  </p>
                  <ul className="space-y-2 text-sm">
                    {nota.nfesVinculadas!.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2">
                        <span>
                          NF …{v.nfe?.chaveNfe?.slice(-8)} — {v.nfe?.nomeEmitente}
                        </span>
                        {v.nfe?.id && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/entrada-notas/${v.nfe.id}?aba=frete`}>
                              Abrir NF (Frete/CT-e)
                            </Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
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
                <p className="text-sm text-muted-foreground">
                  {freteConsultivo
                    ? 'Nenhum CT-e vinculado (não exigido no frete do remetente).'
                    : 'Nenhum CT-e vinculado.'}
                </p>
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
                          {formatMoedaBr(v.valorFrete ?? v.cte?.valorTotal ?? null)}
                        </p>
                        {v.cte?.id && (
                          <CfopEntradaFreteCampos
                            compacto
                            cfopXml={v.cfop}
                            cfopEntrada={v.cfopEntrada}
                            cfopsEntrada={cfopsEntradaFrete}
                            finalizada={cfopFreteSomenteLeitura}
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
                        {freteEditavel && (
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
              {freteEditavel && (
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
                Com CT-e vinculado, número do documento e valor (Valor Frete / total do transporte)
                vêm preenchidos automaticamente. Informe só a data de vencimento de cada parcela e
                Salvar — a prévia não grava sem vencimento. Contas a pagar é gerado no lançamento. Ao
                adicionar parcela o valor é dividido por igual; a soma deve bater com o Valor Frete.
                {freteConsultivo
                  ? ' Frete do remetente: edição desabilitada (somente consulta).'
                  : ''}
              </p>
              {ehNfe55 && (nota.ctesVinculados ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {freteConsultivo
                    ? 'Sem CT-e — financeiro do frete não se aplica nesta etapa consultiva.'
                    : 'Vincule um CT-e para preencher o financeiro do frete.'}
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
                  const vencOk = finParcelas.every((p) => Boolean(p.vencimento?.trim()))
                  const podeSalvar =
                    freteEditavel && !acao && valoresOk && vencOk && somaBate
                  const camposDesabilitados = !freteEditavel
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
                      {valoresOk && somaBate && !vencOk && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Informe a data de vencimento de cada parcela antes de salvar a prévia.
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
                                disabled={camposDesabilitados}
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
                                disabled={camposDesabilitados}
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
                                disabled={camposDesabilitados}
                              />
                            </div>
                            {freteEditavel && finParcelas.length > 1 && (
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
                      {freteEditavel && (
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
          {ehCte && (nota.nfesVinculadas ?? []).length > 0 ? (
            <CardPadrao titulo="CT-e vinculado — sem lançamento à parte">
              <p className="mb-3 text-sm text-muted-foreground">
                Este CT-e já está ligado à NF de mercadoria. O frete (CFOP, prévia financeira e
                contas a pagar) é tratado na aba <strong>Frete / CT-e</strong> da NF. Não use
                Liberar para contagem neste documento.
              </p>
              <ul className="space-y-2 text-sm">
                {nota.nfesVinculadas!.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      NF …{v.nfe?.chaveNfe?.slice(-8)} — {v.nfe?.nomeEmitente ?? '—'}
                    </span>
                    {v.nfe?.id && (
                      <Button asChild size="sm">
                        <Link href={`/entrada-notas/${v.nfe.id}?aba=frete`}>
                          Ir para NF (Frete/CT-e)
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardPadrao>
          ) : !pipelineBloqueado ? (
            <CardPadrao titulo="Lançamento">
              <p className="mb-3 text-sm text-muted-foreground">
                {ehSemContagemFisica
                  ? 'Despesa/serviço — não movimenta estoque e não vai para contagem. Preencha o financeiro e consolide com senha de gerente.'
                  : 'Conferência final. Liberar para contagem não movimenta estoque. Consolidar estoque (senha gerente) grava físico e fiscal no estoque.'}
              </p>
              {nota.recorrenciaFinanceira && (
                <div className="mb-3 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                  Recorrência casada — valor{' '}
                  {formatMoedaBr(nota.recorrenciaFinanceira.valor)} · vencimento dia{' '}
                  {nota.recorrenciaFinanceira.diaVencimento}
                </div>
              )}
              {abaBloqueada('lancamento') && (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                  Resolva as etapas anteriores (cadastro → fiscal → negociação → frete) antes de lançar.
                </p>
              )}
              {ehSemContagemFisica ? (
                <div className="space-y-4">
                  <ComboboxPlanoFinanceiro
                    rotulo="Plano financeiro"
                    planos={planosFinanceiros}
                    valor={planoDocumentalId}
                    aoMudar={setPlanoDocumentalId}
                  />
                  <div className="space-y-2">
                    {finParcelas.map((parcela, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 p-2"
                      >
                        <div className="min-w-[140px]">
                          <Label htmlFor={`doc-venc-${index}`}>Data de vencimento</Label>
                          <input
                            id={`doc-venc-${index}`}
                            type="date"
                            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                            value={parcela.vencimento}
                            onChange={(e) => {
                              const v = e.target.value
                              setFinParcelas((prev) =>
                                prev.map((p, i) => (i === index ? { ...p, vencimento: v } : p))
                              )
                            }}
                          />
                        </div>
                        <div className="min-w-[120px]">
                          <Label htmlFor={`doc-valor-${index}`}>Valor</Label>
                          <input
                            id={`doc-valor-${index}`}
                            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                            value={parcela.valor}
                            onChange={(e) => {
                              const v = e.target.value
                              setFinParcelas((prev) =>
                                prev.map((p, i) => (i === index ? { ...p, valor: v } : p))
                              )
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={acao || abaBloqueada('lancamento') || !planoDocumentalId}
                      onClick={() =>
                        postAcao('/financeiro-documental', {
                          planoFinanceiroId: planoDocumentalId,
                          parcelas: finParcelas.map((p) => ({
                            numeroDocumento: p.numeroDocumento || null,
                            vencimento: p.vencimento,
                            valor: Number(p.valor),
                          })),
                        })
                      }
                    >
                      Salvar financeiro
                    </Button>
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
                    <BotaoPrimario
                      type="button"
                      disabled={acao || !senha || abaBloqueada('lancamento')}
                      onClick={() => postAcao('/lancar', { modo: 'consolidar', senha })}
                    >
                      Consolidar (documental)
                    </BotaoPrimario>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contas a pagar é gerado ao consolidar. Plano e vencimento são obrigatórios.
                  </p>
                </div>
              ) : (
                <>
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
                      Consolidar estoque
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Os títulos em Contas a Pagar (mercadoria e frete, quando houver) são gerados ao
                    consolidar — Baixar contagem OK, Consolidar ou Bloquear estoque.
                  </p>
                </>
              )}
            </CardPadrao>
          ) : (
            <CardPadrao
              titulo={
                comProblema || problemaResolvido
                  ? 'Fora do fluxo (com problema)'
                  : nota.statusEntrada === 'entrada_consolidada'
                    ? 'Entrada consolidada'
                    : nota.statusEntrada === 'pronta_para_consolidar'
                      ? 'Pronta para consolidar'
                      : nota.statusEntrada === 'entrada_contagem_ok'
                      ? nota.contagemBaixada
                        ? 'Contagem baixada — pronta para consolidar'
                        : 'Contagem OK — baixar para consolidar'
                      : nota.statusEntrada === 'entrada_contagem_divergente'
                        ? nota.contagemBaixada
                          ? 'Contagem baixada — bloquear estoque'
                          : 'Divergência na contagem — baixar antes de bloquear'
                        : nota.statusEntrada === 'entrada_contagem'
                          ? 'Liberada para contagem'
                          : nota.statusEntrada === 'aguardando_chegada'
                            ? 'Aguardando chegada'
                            : 'Finalizada'
              }
            >
              <p className="text-sm">
                Status <strong>{rotuloStatusEntrada(nota.statusEntrada)}</strong>
                {nota.origemLancamento
                  ? ` · origem ${rotuloOrigemLancamento(nota.origemLancamento)}`
                  : ''}
                .
                {comProblema
                  ? ' Use o card Nota com problema para tratativas e desfecho.'
                  : problemaResolvido
                    ? ' Problema resolvido — nota fora do fluxo de entrada.'
                    : nota.statusEntrada === 'aguardando_chegada'
                      ? ' Nota lançada — aguardando chegada física da mercadoria. Libere para a logística iniciar a contagem.'
                      : nota.statusEntrada === 'pronta_para_consolidar'
                        ? ' Despesa/serviço pronta — preencha o financeiro (plano e vencimento) e consolide com senha de gerente.'
                        : nota.statusEntrada === 'entrada_contagem' && !ehDocumental
                        ? ' Aguardando contagem cega da logística.'
                        : nota.statusEntrada === 'entrada_contagem' && ehDocumental
                          ? ' Documental — pode consolidar sem contagem física.'
                          : nota.statusEntrada === 'entrada_contagem_ok'
                            ? nota.contagemBaixada
                              ? ' Contagem baixada. Informe a senha e consolide o estoque.'
                              : ' Contagem conferida. Baixe a contagem (com senha) para gravar no estoque.'
                            : nota.statusEntrada === 'entrada_contagem_divergente'
                              ? nota.contagemBaixada
                                ? ' Contagem baixada. Bloqueie o estoque com explicação e foto da negociação, ou volte para a logística contar de novo.'
                                : ' Contagem gravada com divergência. Baixe a contagem para travar a logística; depois bloqueie o estoque.'
                              : nota.statusEntrada === 'entrada_consolidada' && !ehDocumental
                                ? nota.estoqueLancado || estoqueResumo?.movimentou
                                  ? ' Estoque lançado (físico e fiscal). Veja o resumo abaixo.'
                                  : ' Consolidada — sem movimentos de estoque (itens sem produto ou sem controle).'
                                : nota.statusEntrada === 'entrada_consolidada' && ehDocumental
                                  ? ' Documental — sem movimentação de estoque.'
                                  : ''}
              </p>
              {nota.statusEntrada === 'aguardando_chegada' && (
                <div className="mt-4 space-y-3 rounded-md border border-border/80 bg-muted/20 p-3">
                  {nota.auditoriaChegada && nota.auditoriaChegada.achados.length > 0 && (
                    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        Conferência de preço e nome
                      </p>
                      <ul className="list-disc space-y-1 pl-4 text-amber-800 dark:text-amber-300">
                        {nota.auditoriaChegada.achados.map((a) => (
                          <li key={`${a.tipo}-${a.itemId}`}>{a.mensagem}</li>
                        ))}
                      </ul>
                      {nota.auditoriaChegada.pendente ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={acao}
                          onClick={() => postAcao('/aceitar-auditoria-chegada', {})}
                        >
                          Confirmei as divergências
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">Divergências confirmadas.</p>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Assim que a mercadoria chegar, libere para a logística iniciar a conferência em{' '}
                    <Link href="/contagens" className="text-primary underline">
                      Contagens de entrada
                    </Link>
                    .
                  </p>
                  <BotaoPrimario
                    type="button"
                    disabled={acao || Boolean(nota.auditoriaChegada?.pendente)}
                    onClick={() => postAcao('/liberar-para-contagem', {})}
                  >
                    Liberar para contagem
                  </BotaoPrimario>
                </div>
              )}
              {(nota.contasPagar?.length ?? 0) > 0 && (
                <p className="mt-2 text-sm">
                  <strong>{nota.contasPagar!.length}</strong> título(s) em Contas a Pagar.{' '}
                  <Link
                    href={`/contas-a-pagar?nfeRecebidaId=${encodeURIComponent(nota.id)}`}
                    className="text-primary underline"
                  >
                    Ver títulos a pagar
                  </Link>
                </p>
              )}
              {nota.statusEntrada === 'entrada_contagem' && !ehDocumental && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {(nota.itens ?? []).some((i) => i.produtoId) ? (
                    <>
                      Abra{' '}
                      <Link href="/contagens" className="text-primary underline">
                        Contagens de entrada
                      </Link>{' '}
                      para a logística bipar os produtos. Só depois desta etapa o admin baixa a
                      contagem.
                    </>
                  ) : (
                    <>
                      Esta NFe <strong>não aparece</strong> em Contagens enquanto algum item
                      estiver <strong>Sem vínculo</strong> de produto. Vá na aba{' '}
                      <strong>Cadastro</strong>, use <strong>Conciliar produto</strong> em cada
                      item e depois volte a{' '}
                      <Link href="/contagens" className="text-primary underline">
                        Contagens de entrada
                      </Link>
                      .
                    </>
                  )}
                </p>
              )}
              {nota.statusEntrada === 'entrada_consolidada' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Consulta as abas anteriores (Frete, Cadastro, Fiscal, Negociação) para auditoria.
                  O extrato completo fica em{' '}
                  <Link href="/estoque" className="text-primary underline">
                    Estoque
                  </Link>
                  {' '}e o dossiê da NF em{' '}
                  <Link href={`/auditoria-entradas/${nota.id}`} className="text-primary underline">
                    Auditoria de entradas
                  </Link>
                  .
                </p>
              )}
              {nota.statusEntrada === 'entrada_consolidada' && nota.divergenciaDesfecho === 'bloqueio' && (
                <div className="mt-3 space-y-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {(nota.itensBloqueados
                    ? nota.itensBloqueados.totais.aindaBloqueados > 0
                    : !nota.divergenciaGestao?.desbloqueioEm) ? (
                    <p>
                      <strong>Estoque bloqueado</strong> — as peças desta NF não circulam no
                      disponível até o desbloqueio.
                      {nota.divergenciaResolvidaEm
                        ? ` Bloqueada em ${new Date(nota.divergenciaResolvidaEm).toLocaleString('pt-BR')}.`
                        : ''}
                      {nota.divergenciaGestao?.desbloqueioEm
                        ? ' Há quantidade ainda retida — complete o desbloqueio abaixo.'
                        : ''}
                    </p>
                  ) : (
                    <p>
                      <strong>Estoque foi bloqueado</strong> por contagem divergente
                      {nota.divergenciaResolvidaEm
                        ? ` em ${new Date(nota.divergenciaResolvidaEm).toLocaleString('pt-BR')}`
                        : ''}
                      . Já desbloqueado
                      {nota.divergenciaGestao?.desbloqueioEm
                        ? ` em ${new Date(nota.divergenciaGestao.desbloqueioEm).toLocaleString('pt-BR')}`
                        : ''}
                      .
                    </p>
                  )}
                  <div className="rounded-md border border-amber-300/80 bg-background/70 p-2.5 dark:border-amber-800/50">
                    <p className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                      Motivo do bloqueio
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {nota.divergenciaGestao?.bloqueioExplicacao?.trim() ||
                        'Contagem divergente — negociado com o fornecedor (sem texto adicional).'}
                    </p>
                  </div>
                  {nota.anexoDivergencia && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => void baixarAnexoDivergencia(nota.anexoDivergencia!.id, nota.anexoDivergencia!.nomeArquivo)}
                    >
                      <Download className="size-3.5" />
                      Baixar anexo da negociação
                    </Button>
                  )}
                  {(nota.itensBloqueados
                    ? nota.itensBloqueados.totais.aindaBloqueados > 0
                    : !nota.divergenciaGestao?.desbloqueioEm) ? (
                    <div className="space-y-2 border-t border-amber-200 pt-2 dark:border-amber-800/50">
                      <Label htmlFor="explicacao-desbloqueio">Explicação do desbloqueio</Label>
                      <textarea
                        id="explicacao-desbloqueio"
                        className="mt-1 block w-full max-w-md min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm"
                        value={explicacaoDesbloqueio}
                        onChange={(e) => setExplicacaoDesbloqueio(e.target.value)}
                      />
                      <Label htmlFor="anexo-desbloqueio">Foto ou PDF da negociação (máx. 2 MB)</Label>
                      <label
                        htmlFor="anexo-desbloqueio"
                        className="relative flex w-full max-w-md cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
                      >
                        <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">
                          {anexoDivergenciaArquivo?.nomeArquivo ?? 'Clique para escolher o arquivo…'}
                        </span>
                        <input
                          id="anexo-desbloqueio"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null
                            void aoEscolherArquivoDivergencia(file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <Label htmlFor="senha-desbloqueio">Senha gerente</Label>
                          <input
                            id="senha-desbloqueio"
                            type="password"
                            className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                            value={senhaDivergencia}
                            onChange={(e) => setSenhaDivergencia(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          disabled={
                            acao ||
                            !senhaDivergencia.trim() ||
                            !explicacaoDesbloqueio.trim() ||
                            !anexoDivergenciaArquivo
                          }
                          onClick={() =>
                            void postAcao('/desbloquear-estoque', {
                              senha: senhaDivergencia,
                              explicacao: explicacaoDesbloqueio,
                              anexo: anexoDivergenciaArquivo,
                            })
                          }
                        >
                          Desbloquear estoque
                        </Button>
                      </div>
                    </div>
                  ) : nota.divergenciaGestao?.desbloqueioEm ? (
                    <div className="rounded-md border border-border/60 bg-muted/30 p-2.5">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Motivo do desbloqueio
                      </p>
                      <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                        {nota.divergenciaGestao.desbloqueioExplicacao?.trim() || '—'}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
              {nota.statusEntrada === 'entrada_contagem_divergente' && (
                <div className="mt-4 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
                  {!nota.contagemBaixada ? (
                    <>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Contagem finalizada com divergência. Baixe para travar a logística e depois
                        bloquear o estoque, ou volte para a logística contar de novo.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={acao}
                          onClick={() => postAcao('/baixar-contagem', {})}
                        >
                          Baixar contagem
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={acao}
                          onClick={() => postAcao('/voltar-para-contagem', {})}
                        >
                          Voltar para contagem
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Contagem baixada. Bloqueie o estoque (explicação + foto da negociação + senha)
                        ou volte para a logística contar de novo. Não há emissão de nota de devolução
                        nesta etapa.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="explicacao-divergencia">Explicação da negociação</Label>
                        <textarea
                          id="explicacao-divergencia"
                          className="mt-1 block w-full max-w-md min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm"
                          value={explicacaoDivergencia}
                          onChange={(e) => setExplicacaoDivergencia(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="anexo-divergencia">Foto ou PDF da negociação (máx. 2 MB)</Label>
                        <label
                          htmlFor="anexo-divergencia"
                          className="relative flex w-full max-w-md cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm hover:border-muted-foreground/40"
                        >
                          <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">
                            {anexoDivergenciaArquivo?.nomeArquivo ?? 'Clique para escolher o arquivo…'}
                          </span>
                          <input
                            id="anexo-divergencia"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null
                              void aoEscolherArquivoDivergencia(file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        {infoAnexoDivergencia && (
                          <p className="text-xs text-muted-foreground">{infoAnexoDivergencia}</p>
                        )}
                        {erroAnexoDivergencia && (
                          <p className="text-xs text-destructive">{erroAnexoDivergencia}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <Label htmlFor="senha-divergencia">Senha gerente</Label>
                          <input
                            id="senha-divergencia"
                            type="password"
                            className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                            value={senhaDivergencia}
                            onChange={(e) => setSenhaDivergencia(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={
                            acao ||
                            !senhaDivergencia.trim() ||
                            !explicacaoDivergencia.trim() ||
                            !anexoDivergenciaArquivo
                          }
                          onClick={() =>
                            postAcao('/resolver-divergencia', {
                              senha: senhaDivergencia,
                              explicacao: explicacaoDivergencia,
                              anexo: anexoDivergenciaArquivo,
                            })
                          }
                        >
                          Bloquear estoque
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={acao}
                          onClick={() => postAcao('/voltar-para-contagem', {})}
                        >
                          Voltar para contagem
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {(nota.statusEntrada === 'entrada_contagem_ok' ||
                nota.statusEntrada === 'pronta_para_consolidar' ||
                (nota.statusEntrada === 'entrada_contagem' && ehDocumental)) && (
                <div className="mt-4 space-y-3 rounded-md border border-border/80 bg-muted/20 p-3">
                  {ehSemContagemFisica || nota.statusEntrada === 'pronta_para_consolidar' ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Consolidar (documental) encerra a entrada sem movimentar estoque. Contas a pagar
                        nascem ao consolidar.
                      </p>
                      {nota.recorrenciaFinanceira && (
                        <div className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                          Recorrência casada — valor{' '}
                          {formatMoedaBr(nota.recorrenciaFinanceira.valor)} · vencimento dia{' '}
                          {nota.recorrenciaFinanceira.diaVencimento}
                        </div>
                      )}
                      <ComboboxPlanoFinanceiro
                        rotulo="Plano financeiro"
                        planos={planosFinanceiros}
                        valor={planoDocumentalId}
                        aoMudar={setPlanoDocumentalId}
                      />
                      <div className="space-y-2">
                        {finParcelas.map((parcela, index) => (
                          <div
                            key={index}
                            className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 p-2"
                          >
                            <div className="min-w-[140px]">
                              <Label htmlFor={`doc-fin-venc-${index}`}>Data de vencimento</Label>
                              <input
                                id={`doc-fin-venc-${index}`}
                                type="date"
                                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                                value={parcela.vencimento}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFinParcelas((prev) =>
                                    prev.map((p, i) => (i === index ? { ...p, vencimento: v } : p))
                                  )
                                }}
                              />
                            </div>
                            <div className="min-w-[120px]">
                              <Label htmlFor={`doc-fin-valor-${index}`}>Valor</Label>
                              <input
                                id={`doc-fin-valor-${index}`}
                                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                                value={parcela.valor}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFinParcelas((prev) =>
                                    prev.map((p, i) => (i === index ? { ...p, valor: v } : p))
                                  )
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={acao || !planoDocumentalId}
                          onClick={() =>
                            postAcao('/financeiro-documental', {
                              planoFinanceiroId: planoDocumentalId,
                              parcelas: finParcelas.map((p) => ({
                                numeroDocumento: p.numeroDocumento || null,
                                vencimento: p.vencimento,
                                valor: Number(p.valor),
                              })),
                            })
                          }
                        >
                          Salvar financeiro
                        </Button>
                        <div>
                          <Label htmlFor="senha-consolidar-contagem">Senha gerente</Label>
                          <input
                            id="senha-consolidar-contagem"
                            type="password"
                            className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                          />
                        </div>
                        <BotaoPrimario
                          type="button"
                          disabled={acao || !senha.trim()}
                          onClick={() => postAcao('/lancar', { modo: 'consolidar', senha })}
                        >
                          Consolidar (documental)
                        </BotaoPrimario>
                      </div>
                    </>
                  ) : !nota.contagemBaixada ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Contagem finalizada (OK). Baixar trava a logística e, com a senha, consolida
                        físico e fiscal. Ou volte para a logística editar de novo.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <Label htmlFor="senha-baixar-ok">Senha gerente</Label>
                          <input
                            id="senha-baixar-ok"
                            type="password"
                            className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                          />
                        </div>
                        <BotaoPrimario
                          type="button"
                          disabled={acao || !senha.trim()}
                          onClick={() => postAcao('/baixar-contagem', { senha })}
                        >
                          Baixar contagem
                        </BotaoPrimario>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={acao}
                          onClick={() => postAcao('/voltar-para-contagem', {})}
                        >
                          Voltar para contagem
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Contagem já baixada. Se ainda não consolidou, use a senha para gravar no estoque
                        ou volte para a logística.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <Label htmlFor="senha-consolidar-contagem">Senha gerente</Label>
                          <input
                            id="senha-consolidar-contagem"
                            type="password"
                            className="mt-1 block w-full max-w-xs min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                          />
                        </div>
                        <BotaoPrimario
                          type="button"
                          disabled={acao || !senha.trim()}
                          onClick={() => postAcao('/lancar', { modo: 'consolidar', senha })}
                        >
                          Consolidar estoque
                        </BotaoPrimario>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={acao}
                          onClick={() => postAcao('/voltar-para-contagem', {})}
                        >
                          Voltar para contagem
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
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
                    {(nota.despesasFrete ?? []).map((d) => (
                      <li key={d.id}>
                        {formatMoedaBr(d.valor)} —{' '}
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

          {(estoqueResumo?.movimentou ||
            (nota.statusEntrada === 'entrada_consolidada' &&
              Boolean(nota.estoqueLancado || estoqueResumo?.movimentou) &&
              !ehDocumental)) && (
            <CardPadrao titulo="Estoque lançado">
              <p className="mb-3 text-sm text-muted-foreground">
                Movimentos de entrada por nota fiscal no físico e no fiscal. Abra o estoque do
                produto para conferir.
              </p>
              {estoqueResumo && estoqueResumo.produtos.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {estoqueResumo.produtos.map((p) => (
                    <li
                      key={p.produtoId}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-1.5 last:border-0"
                    >
                      <span>
                        {p.nomeVenda}{' '}
                        <span className="text-muted-foreground tabular-nums">
                          (+{formatarQtdEstoque(p.quantidade)})
                        </span>
                      </span>
                      <Link
                        href={`/estoque?produtoId=${encodeURIComponent(p.produtoId)}&tipoEstoque=fisico`}
                        className="text-primary text-xs underline"
                      >
                        Ver no estoque
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Estoque consolidado nesta nota.{' '}
                  <Link href="/estoque" className="text-primary underline">
                    Abrir estoque
                  </Link>
                </p>
              )}
            </CardPadrao>
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}

export default function PaginaDetalheEntradaNota() {
  return (
    <ProtegerRota chaveDaPagina="entrada-notas">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando nota…</p>}>
        <ConteudoDetalheEntrada />
      </Suspense>
    </ProtegerRota>
  )
}
