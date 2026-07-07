'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { clienteHttp } from '@/services/api'
import { resolverUrlUpload } from '@/lib/resolver-url-upload'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { RodapeModalVisualizacao } from '@/components/compartilhado/rodape-modal-visualizacao'
import { usePermissao } from '@/hooks/use-permissao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { useValidacaoDeAbas, type ConfigDeAba } from '@/hooks/use-validacao-de-abas'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Abas } from '@/components/ui/abas'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { TextareaPadrao } from '@/components/ui/textarea-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { CampoFotoProduto } from '@/components/produtos/campo-foto-produto'
import { ComboboxMarca } from '@/components/produtos/combobox-marca'
import {
  ListaEmbalagensMaster,
  type EmbalagemMasterForm,
} from '@/components/produtos/lista-embalagens-master'
import {
  ListaEnderecosEstoque,
  type EnderecoEstoqueForm,
} from '@/components/produtos/lista-enderecos-estoque'
import {
  SelecaoProdutosSimilares,
  type ProdutoSimilarItem,
} from '@/components/produtos/selecao-produtos-similares'
import {
  ListaFornecedoresProduto,
  type FornecedorProdutoForm,
} from '@/components/produtos/lista-fornecedores-produto'
import { SelecaoUnidadeMedida } from '@/components/produtos/selecao-unidade-medida'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  nomeVendaParaCopia,
  prepararFormularioDuplicacaoProduto,
} from '@/lib/preparar-formulario-duplicacao-produto'
import {
  codigoBarrasGtinValido,
  coletarCodigosBarrasProduto,
  filtrarEntradaCodigoBarras,
  MENSAGEM_CODIGO_BARRAS_DUPLICADO_NO_PRODUTO,
  MENSAGEM_CODIGO_BARRAS_INVALIDO,
  normalizarCodigoBarrasGtin,
  validarCodigosBarrasInternos,
} from '@/lib/validar-codigo-barras-gtin'
import type { ResultadoCompressaoProduto } from '@/lib/comprimir-imagem-produto'

type FornecedorOpcao = { id: string; nome: string }

const ORDEM_ABAS = ['principal', 'logistica', 'compras', 'fiscal'] as const

const ORIGENS_FISCAIS = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (Importação direta)' },
  { value: '2', label: '2 - Estrangeira (Adquirida no mercado interno)' },
  { value: '3', label: '3 - Nacional (Conteúdo de importação superior a 40%)' },
  { value: '4', label: '4 - Nacional (Processos produtivos básicos)' },
  { value: '5', label: '5 - Nacional (Conteúdo de importação inferior ou igual a 40%)' },
  { value: '6', label: '6 - Estrangeira (Importação direta, sem similar nacional)' },
  { value: '7', label: '7 - Estrangeira (Adquirida no mercado interno, sem similar nacional)' },
  { value: '8', label: '8 - Nacional (Conteúdo de importação superior a 70%)' },
] as const

const ROTULO_PROXIMA_ABA: Record<(typeof ORDEM_ABAS)[number], string | null> = {
  principal: 'Logística',
  logistica: 'Compras',
  compras: 'Fiscal',
  fiscal: null,
}

const MENSAGEM_NCM_INVALIDO = 'NCM deve ter 8 dígitos.'
const MENSAGEM_ERRO_ABA_LOGISTICA = 'Revise os códigos de barras na aba Logística.'

function mensagemErroDaAba(abaId: string): string {
  switch (abaId) {
    case 'principal':
      return 'Preencha nome de venda, marca e unidade na aba Principal.'
    case 'logistica':
      return MENSAGEM_ERRO_ABA_LOGISTICA
    case 'compras':
      return 'Selecione o fornecedor em todas as linhas da aba Compras.'
    case 'fiscal':
      return MENSAGEM_NCM_INVALIDO
    default:
      return 'Revise os campos desta aba.'
  }
}

type FormProduto = {
  sku: string
  ativo: boolean
  nomeVenda: string
  marca: string
  unidade: string
  caracteristicas: string
  tipoEntrega: '' | 'pronta_entrega' | 'sob_encomenda'
  diasParaEntrega: string
  dataValidadePreco: string
  entregaNoAto: boolean
  entregaARetirar: boolean
  entregar: boolean
  entregaPorEncomenda: boolean
  flagDevolucao: boolean
  controlaEstoque: boolean
  flagComissao: boolean
  permiteEstoqueNegativo: boolean
  bloqueadoCompra: boolean
  bloqueadoVenda: boolean
  desativarAoZerarEstoque: boolean
  codigoBarras: string
  pesoKg: string
  alturaCm: string
  larguraCm: string
  comprimentoCm: string
  capacidadeEmpilhamento: string
  normaPalete: string
  embalagensMaster: EmbalagemMasterForm[]
  enderecosEstoque: EnderecoEstoqueForm[]
  nomeCompra: string
  fornecedores: FornecedorProdutoForm[]
  similares: ProdutoSimilarItem[]
  agruparSimilaresRuptura: boolean
  ncm: string
  codigoOrigem: string
}

const formVazio: FormProduto = {
  sku: '',
  ativo: true,
  nomeVenda: '',
  marca: '',
  unidade: 'UN',
  caracteristicas: '',
  tipoEntrega: 'pronta_entrega',
  diasParaEntrega: '',
  dataValidadePreco: '',
  entregaNoAto: true,
  entregaARetirar: true,
  entregar: true,
  entregaPorEncomenda: false,
  flagDevolucao: true,
  controlaEstoque: true,
  flagComissao: true,
  permiteEstoqueNegativo: false,
  bloqueadoCompra: false,
  bloqueadoVenda: false,
  desativarAoZerarEstoque: false,
  codigoBarras: '',
  pesoKg: '',
  alturaCm: '',
  larguraCm: '',
  comprimentoCm: '',
  capacidadeEmpilhamento: '',
  normaPalete: '',
  embalagensMaster: [],
  enderecosEstoque: [],
  nomeCompra: '',
  fornecedores: [],
  similares: [],
  agruparSimilaresRuptura: false,
  ncm: '',
  codigoOrigem: '',
}

function formatarDataIso(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function urlFoto(caminho?: string | null) {
  return resolverUrlUpload(caminho)
}

function num(v: string): number | undefined {
  if (!v.trim()) return undefined
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function int(v: string): number | undefined {
  if (!v.trim()) return undefined
  const n = Number(v.replace(/\D/g, ''))
  return Number.isFinite(n) ? Math.round(n) : undefined
}

function calcularErrosEmbalagensMaster(
  codigoUnidade: string,
  embalagens: EmbalagemMasterForm[]
): Record<number, { codigoBarras?: string }> {
  const erros: Record<number, { codigoBarras?: string }> = {}
  const vistos = new Set<string>()

  const codigoUnidadeNormalizado = codigoUnidade.trim()
    ? normalizarCodigoBarrasGtin(codigoUnidade)
    : ''
  if (codigoUnidadeNormalizado) vistos.add(codigoUnidadeNormalizado)

  embalagens.forEach((item, index) => {
    const valor = item.codigoBarras.trim()
    if (!valor) return

    if (!codigoBarrasGtinValido(valor)) {
      erros[index] = { codigoBarras: MENSAGEM_CODIGO_BARRAS_INVALIDO }
      return
    }

    const normalizado = normalizarCodigoBarrasGtin(valor)
    if (vistos.has(normalizado)) {
      erros[index] = { codigoBarras: MENSAGEM_CODIGO_BARRAS_DUPLICADO_NO_PRODUTO }
      return
    }

    vistos.add(normalizado)
  })

  return erros
}

/** Remove null/NaN do payload antes do POST para evitar "Invalid input" no Zod. */
function sanitizarPayload<T>(valor: T): T {
  if (valor === null || valor === undefined) return undefined as T
  if (typeof valor === 'number') {
    return (Number.isFinite(valor) ? valor : undefined) as T
  }
  if (Array.isArray(valor)) {
    return valor.map(sanitizarPayload).filter((item) => item !== undefined) as T
  }
  if (typeof valor === 'object') {
    const resultado: Record<string, unknown> = {}
    for (const [chave, item] of Object.entries(valor)) {
      const limpo = sanitizarPayload(item)
      if (limpo !== undefined) resultado[chave] = limpo
    }
    return resultado as T
  }
  return valor
}

function ConteudoDaPagina() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('produtos:create')
  const podeEditar = usePermissao('produtos:edit')
  const podeDesativar = usePermissao('produtos:delete')

  const [lista, setLista] = useState<
    (FormProduto & { id: string; urlFotoMiniatura?: string | null })[]
  >([])
  const [fornecedores, setFornecedores] = useState<FornecedorOpcao[]>([])
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [modoVisualizacao, setModoVisualizacao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [form, setForm] = useState<FormProduto>(formVazio)
  const [abaAtiva, setAbaAtiva] = useState('principal')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [fotoComprimida, setFotoComprimida] = useState<ResultadoCompressaoProduto | null>(null)
  const [removerFoto, setRemoverFoto] = useState(false)
  const [urlFotoAtual, setUrlFotoAtual] = useState<string | null>(null)
  const [veioDeDuplicacao, setVeioDeDuplicacao] = useState(false)
  const [modalDuplicarAberto, setModalDuplicarAberto] = useState(false)
  const [produtoIdParaDuplicar, setProdutoIdParaDuplicar] = useState('')
  const [nomeDuplicacao, setNomeDuplicacao] = useState('')
  const [duplicando, setDuplicando] = useState(false)

  const configAbas: ConfigDeAba[] = useMemo(
    () => [
      {
        id: 'principal',
        validar: () =>
          form.nomeVenda.trim().length >= 2 &&
          form.marca.trim().length >= 1 &&
          form.unidade.trim().length >= 1,
      },
      {
        id: 'logistica',
        validar: () => {
          const codigoUnidadeOk =
            !form.codigoBarras.trim() || codigoBarrasGtinValido(form.codigoBarras)
          const mastersOk = form.embalagensMaster.every(
            (e) => !e.codigoBarras.trim() || codigoBarrasGtinValido(e.codigoBarras)
          )
          const codigosInternosOk = validarCodigosBarrasInternos(
            coletarCodigosBarrasProduto(form.codigoBarras, form.embalagensMaster)
          )
          return (
            codigoUnidadeOk &&
            mastersOk &&
            codigosInternosOk &&
            form.embalagensMaster.every((e) => {
              if (!e.quantidade.trim()) return true
              const qtd = num(e.quantidade)
              return qtd !== undefined && qtd > 0
            }) &&
            form.enderecosEstoque.every((e) => !e.endereco.trim() || e.endereco.trim().length >= 1)
          )
        },
      },
      { id: 'compras', validar: () => form.fornecedores.every((f) => f.fornecedorPessoaId.trim().length > 0) },
      { id: 'fiscal', validar: () => !form.ncm || /^\d{8}$/.test(form.ncm.replace(/\D/g, '')) },
    ],
    [form]
  )

  const {
    statusDasAbas,
    validarTodasAsAbas,
    validarAba,
    marcarAbaVisitada,
    resetarStatus,
  } = useValidacaoDeAbas(configAbas)

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams({ incluirInativos: 'true' })
      if (busca.trim()) params.set('q', busca.trim())
      const { data } = await clienteHttp.get(`/produtos?${params}`)
      setLista(data.produtos ?? [])
    } catch {
      setErro('Erro ao carregar produtos.')
    }
  }, [busca])

  const carregarFornecedores = useCallback(async () => {
    try {
      const { data } = await clienteHttp.get('/fornecedores')
      setFornecedores(
        (data.fornecedores ?? [])
          .filter((f: { ativo: boolean }) => f.ativo)
          .map((f: { id: string; nome: string }) => ({ id: f.id, nome: f.nome }))
      )
    } catch {
      setFornecedores([])
    }
  }, [])

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregar()
    carregarFornecedores()
  }, [carregandoSessao, estaAutenticado, carregar, carregarFornecedores])

  function abrirNovo() {
    setForm(formVazio)
    setModoEdicao(false)
    setModoVisualizacao(false)
    setVeioDeDuplicacao(false)
    setIdEmEdicao('')
    setAbaAtiva('principal')
    setFotoComprimida(null)
    setRemoverFoto(false)
    setUrlFotoAtual(null)
    setErro('')
    resetarStatus()
    setModalAberto(true)
    void clienteHttp
      .get('/produtos/proximo-sku')
      .then(({ data }) => {
        setForm((f) => ({ ...f, sku: data.sku as string }))
      })
      .catch(() => {
        setForm((f) => ({ ...f, sku: '1' }))
      })
  }

  function fecharModal() {
    setModalAberto(false)
    setModoVisualizacao(false)
    setVeioDeDuplicacao(false)
    setErro('')
  }

  function abrirModalDuplicar(produto: { id: string; nomeVenda: string }) {
    if (!podeCriar) return
    setProdutoIdParaDuplicar(produto.id)
    setNomeDuplicacao(nomeVendaParaCopia(produto.nomeVenda))
    setModalDuplicarAberto(true)
    setErro('')
  }

  function fecharModalDuplicar() {
    setModalDuplicarAberto(false)
    setProdutoIdParaDuplicar('')
    setNomeDuplicacao('')
  }

  async function confirmarDuplicacao(e?: FormEvent) {
    e?.preventDefault()
    if (!produtoIdParaDuplicar || !nomeDuplicacao.trim()) return

    setDuplicando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.get(`/produtos/${produtoIdParaDuplicar}`)
      const formOrigem = produtoApiParaForm(data.produto)
      const formDuplicado = prepararFormularioDuplicacaoProduto(
        formOrigem,
        produtoIdParaDuplicar,
        nomeDuplicacao
      )

      fecharModalDuplicar()

      setForm(formDuplicado)
      setModoEdicao(false)
      setModoVisualizacao(false)
      setVeioDeDuplicacao(true)
      setIdEmEdicao('')
      setAbaAtiva('principal')
      setFotoComprimida(null)
      setRemoverFoto(false)
      setUrlFotoAtual(null)
      resetarStatus()
      setModalAberto(true)

      const { data: skuData } = await clienteHttp.get('/produtos/proximo-sku')
      setForm((f) => ({ ...f, sku: skuData.sku as string }))

      setMensagem(
        'Produto duplicado como rascunho. Informe códigos de barras se necessário.'
      )
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao duplicar produto'))
    } finally {
      setDuplicando(false)
    }
  }

  function produtoApiParaForm(p: Record<string, unknown>): FormProduto {
    return {
      sku: (p.sku as string | null) ?? '',
      ativo: p.ativo as boolean,
      nomeVenda: ((p.nomeVenda as string) ?? '').toUpperCase(),
      marca: ((p.marca as string | null) ?? '').toUpperCase(),
      unidade: p.unidade as string,
      caracteristicas: (p.caracteristicas as string | null) ?? '',
      tipoEntrega: (p.tipoEntrega as FormProduto['tipoEntrega']) ?? 'pronta_entrega',
      diasParaEntrega: p.diasParaEntrega != null ? String(p.diasParaEntrega) : '',
      dataValidadePreco: formatarDataIso(p.dataValidadePreco as string | null),
      entregaNoAto: (p.entregaNoAto as boolean) ?? false,
      entregaARetirar: (p.entregaARetirar as boolean) ?? false,
      entregar: (p.entregar as boolean) ?? false,
      entregaPorEncomenda: (p.entregaPorEncomenda as boolean) ?? false,
      flagDevolucao: p.flagDevolucao as boolean,
      controlaEstoque: p.controlaEstoque as boolean,
      flagComissao: p.flagComissao as boolean,
      permiteEstoqueNegativo: p.permiteEstoqueNegativo as boolean,
      bloqueadoCompra: (p.bloqueadoCompra as boolean) ?? false,
      bloqueadoVenda: (p.bloqueadoVenda as boolean) ?? false,
      desativarAoZerarEstoque: (p.desativarAoZerarEstoque as boolean) ?? false,
      codigoBarras: (p.codigoBarras as string | null) ?? '',
      pesoKg: p.pesoKg != null ? String(p.pesoKg) : '',
      alturaCm: p.alturaCm != null ? String(p.alturaCm) : '',
      larguraCm: p.larguraCm != null ? String(p.larguraCm) : '',
      comprimentoCm: p.comprimentoCm != null ? String(p.comprimentoCm) : '',
      capacidadeEmpilhamento:
        p.capacidadeEmpilhamento != null ? String(p.capacidadeEmpilhamento) : '',
      normaPalete: (p.normaPalete as string | null) ?? '',
      embalagensMaster: ((p.embalagensMaster as Array<{
        quantidade: number
        codigoBarras: string | null
        alturaCm: number | null
        larguraCm: number | null
        comprimentoCm: number | null
      }>) ?? []).map((e) => ({
        quantidade: String(e.quantidade),
        codigoBarras: e.codigoBarras ?? '',
        alturaCm: e.alturaCm != null ? String(e.alturaCm) : '',
        larguraCm: e.larguraCm != null ? String(e.larguraCm) : '',
        comprimentoCm: e.comprimentoCm != null ? String(e.comprimentoCm) : '',
      })),
      enderecosEstoque: ((p.enderecosEstoque as Array<{
        endereco: string
      }>) ?? []).map((e) => ({
        endereco: e.endereco,
      })),
      nomeCompra: (p.nomeCompra as string | null) ?? '',
      fornecedores: ((p.fornecedores as Array<{
        fornecedorPessoaId: string
        codigoFornecedor: string | null
        multiploEntrada: number | null
        multiplicadorEntrada: number | null
        unidadeEntrada: string | null
      }>) ?? []).map((f) => ({
        fornecedorPessoaId: f.fornecedorPessoaId,
        codigoFornecedor: f.codigoFornecedor ?? '',
        multiploEntrada: f.multiploEntrada != null ? String(f.multiploEntrada) : '',
        multiplicadorEntrada:
          f.multiplicadorEntrada != null ? String(f.multiplicadorEntrada) : '',
        unidadeEntrada: f.unidadeEntrada ?? '',
      })),
      similares: (p.similares as ProdutoSimilarItem[]) ?? [],
      agruparSimilaresRuptura: (p.agruparSimilaresRuptura as boolean) ?? false,
      ncm: (p.ncm as string | null) ?? '',
      codigoOrigem: (p.codigoOrigem as string | null) ?? '',
    }
  }

  async function carregarProdutoNoForm(produtoId: string) {
    const { data } = await clienteHttp.get(`/produtos/${produtoId}`)
    const p = data.produto
    setForm(produtoApiParaForm(p))
    setIdEmEdicao(p.id)
    setAbaAtiva('principal')
    setFotoComprimida(null)
    setRemoverFoto(false)
    setUrlFotoAtual(p.urlFotoPrincipal ?? null)
    setErro('')
    resetarStatus()
    return p
  }

  async function abrirVisualizacao(produto: { id: string }) {
    try {
      await carregarProdutoNoForm(produto.id)
      setModoEdicao(false)
      setModoVisualizacao(true)
      setModalAberto(true)
    } catch {
      setErro('Erro ao carregar produto.')
    }
  }

  function alternarParaEdicao() {
    if (!podeEditar) return
    setModoVisualizacao(false)
    setModoEdicao(true)
    setErro('')
  }

  function montarPayload() {
    const sobEncomenda = form.tipoEntrega === 'sob_encomenda'
    return {
      ...(modoEdicao ? { sku: form.sku.trim() || undefined } : {}),
      ativo: form.ativo,
      nomeVenda: form.nomeVenda.trim(),
      marca: form.marca.trim(),
      unidade: form.unidade.trim(),
      caracteristicas: form.caracteristicas.trim() || undefined,
      tipoEntrega: form.tipoEntrega || undefined,
      ...(sobEncomenda
        ? {
            diasParaEntrega: int(form.diasParaEntrega),
            dataValidadePreco: form.dataValidadePreco || undefined,
          }
        : {}),
      entregaNoAto: form.entregaNoAto,
      entregaARetirar: form.entregaARetirar,
      entregar: form.entregar,
      entregaPorEncomenda: form.entregaPorEncomenda,
      flagDevolucao: form.flagDevolucao,
      controlaEstoque: true,
      flagComissao: form.flagComissao,
      permiteEstoqueNegativo: form.permiteEstoqueNegativo,
      bloqueadoCompra: form.bloqueadoCompra,
      bloqueadoVenda: form.bloqueadoVenda,
      desativarAoZerarEstoque: form.desativarAoZerarEstoque,
      codigoBarras: form.codigoBarras.trim() || undefined,
      pesoKg: num(form.pesoKg),
      alturaCm: num(form.alturaCm),
      larguraCm: num(form.larguraCm),
      comprimentoCm: num(form.comprimentoCm),
      capacidadeEmpilhamento: int(form.capacidadeEmpilhamento),
      normaPalete: form.normaPalete.trim() || undefined,
      embalagensMaster: form.embalagensMaster
        .map((e, ordem) => {
          const quantidade = num(e.quantidade)
          if (quantidade === undefined || quantidade <= 0) return null
          return {
            quantidade,
            codigoBarras: e.codigoBarras.trim() || undefined,
            alturaCm: num(e.alturaCm),
            larguraCm: num(e.larguraCm),
            comprimentoCm: num(e.comprimentoCm),
            ordem,
          }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
      enderecosEstoque: form.enderecosEstoque
        .filter((e) => e.endereco.trim())
        .map((e, ordem) => ({
          endereco: e.endereco.trim(),
          ordem,
        })),
      nomeCompra: form.nomeCompra.trim() || undefined,
      fornecedores: form.fornecedores
        .filter((f) => f.fornecedorPessoaId.trim())
        .map((f, ordem) => ({
          fornecedorPessoaId: f.fornecedorPessoaId,
          codigoFornecedor: f.codigoFornecedor.trim() || undefined,
          multiploEntrada: num(f.multiploEntrada),
          multiplicadorEntrada: num(f.multiplicadorEntrada),
          unidadeEntrada: f.unidadeEntrada.trim() || undefined,
          ordem,
        })),
      similaresIds: form.similares.map((s) => s.id),
      agruparSimilaresRuptura: form.agruparSimilaresRuptura,
      ncm: form.ncm.replace(/\D/g, '') || undefined,
      codigoOrigem: form.codigoOrigem || undefined,
    }
  }

  async function enviarFoto(produtoId: string) {
    if (removerFoto) {
      await clienteHttp.delete(`/produtos/${produtoId}/foto`)
      return
    }
    if (!fotoComprimida) return
    await clienteHttp.post(`/produtos/${produtoId}/foto`, {
      principal: fotoComprimida.principal.dataUrl,
      miniatura: fotoComprimida.miniatura.dataUrl,
      larguraPrincipal: fotoComprimida.principal.largura,
      alturaPrincipal: fotoComprimida.principal.altura,
      larguraMiniatura: fotoComprimida.miniatura.largura,
      alturaMiniatura: fotoComprimida.miniatura.altura,
    })
  }

  async function aoSalvar(e?: FormEvent) {
    e?.preventDefault()
    if (modoVisualizacao) return
    marcarAbaVisitada(abaAtiva)

    if (!validarAba(abaAtiva)) {
      setErro(mensagemErroDaAba(abaAtiva))
      return
    }

    const indiceAtual = ORDEM_ABAS.indexOf(abaAtiva as (typeof ORDEM_ABAS)[number])
    const proximaAba = ORDEM_ABAS[indiceAtual + 1]

    if (proximaAba) {
      setErro('')
      setAbaAtiva(proximaAba)
      return
    }

    const { todasValidas, primeiraAbaComErro } = validarTodasAsAbas()
    if (!todasValidas) {
      if (primeiraAbaComErro) {
        setAbaAtiva(primeiraAbaComErro)
        setErro(mensagemErroDaAba(primeiraAbaComErro))
      }
      return
    }

    setSalvando(true)
    setErro('')
    try {
      const payload = sanitizarPayload(montarPayload())
      let produtoId = idEmEdicao

      if (modoEdicao) {
        await clienteHttp.put(`/produtos/${idEmEdicao}`, payload)
        setMensagem('Produto atualizado.')
      } else {
        const { data } = await clienteHttp.post('/produtos', payload)
        produtoId = data.produto.id
        setMensagem('Produto criado.')
      }

      if (fotoComprimida || removerFoto) {
        await enviarFoto(produtoId)
      }

      setModalAberto(false)
      setModoVisualizacao(false)
      setVeioDeDuplicacao(false)
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao salvar produto'))
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(produto: { id: string; ativo: boolean }) {
    try {
      await clienteHttp.patch(`/produtos/${produto.id}/ativo`, { ativo: !produto.ativo })
      if (modalAberto && idEmEdicao === produto.id) {
        setForm((f) => ({ ...f, ativo: !produto.ativo }))
      }
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao alterar status'))
    }
  }

  async function alternarAtivoVisualizacao() {
    if (!idEmEdicao) return
    try {
      const novoAtivo = !form.ativo
      await clienteHttp.patch(`/produtos/${idEmEdicao}/ativo`, { ativo: novoAtivo })
      setForm((f) => ({ ...f, ativo: novoAtivo }))
      setMensagem(novoAtivo ? 'Produto reativado.' : 'Produto desativado.')
      await carregar()
    } catch (err: unknown) {
      setErro(extrairMensagemApi(err, 'Erro ao alterar status'))
    }
  }

  const somenteLeitura = modoVisualizacao
  const podeSalvar = !somenteLeitura && (modoEdicao ? podeEditar : podeCriar)
  const camposDesabilitados = somenteLeitura || !podeSalvar

  const indiceAba = ORDEM_ABAS.indexOf(abaAtiva as (typeof ORDEM_ABAS)[number])
  const ehPrimeiraAba = indiceAba <= 0
  const ehUltimaAba = indiceAba >= ORDEM_ABAS.length - 1

  function irParaAbaAnterior() {
    if (!ehPrimeiraAba) {
      setErro('')
      setAbaAtiva(ORDEM_ABAS[indiceAba - 1])
    }
  }

  function irParaProximaAba() {
    if (!ehUltimaAba) {
      setErro('')
      setAbaAtiva(ORDEM_ABAS[indiceAba + 1])
    }
  }

  const tituloModal = modoVisualizacao
    ? `Visualizar produto: ${form.nomeVenda || '—'}`
    : modoEdicao
      ? `Editar produto: ${form.nomeVenda || '—'}`
      : veioDeDuplicacao
        ? 'Duplicar produto'
        : 'Novo produto'
  const proximaAbaLabel = ROTULO_PROXIMA_ABA[abaAtiva as (typeof ORDEM_ABAS)[number]]
  const rotuloBotaoSalvar = salvando
    ? 'Salvando...'
    : proximaAbaLabel
      ? `Salvar e próximo → ${proximaAbaLabel}`
      : 'Salvar'

  const abas = [
    { id: 'principal', rotulo: 'Principal', status: statusDasAbas.principal },
    { id: 'logistica', rotulo: 'Logística', status: statusDasAbas.logistica },
    { id: 'compras', rotulo: 'Compras', status: statusDasAbas.compras },
    { id: 'fiscal', rotulo: 'Fiscal', status: statusDasAbas.fiscal },
  ]

  const flagsEntregaPermitida: { campo: keyof FormProduto; rotulo: string }[] = [
    { campo: 'entregaNoAto', rotulo: 'No ato' },
    { campo: 'entregaARetirar', rotulo: 'A retirar' },
    { campo: 'entregar', rotulo: 'Entregar' },
    { campo: 'entregaPorEncomenda', rotulo: 'Por encomenda' },
  ]

  const flagsBooleanos: { campo: keyof FormProduto; rotulo: string }[] = [
    { campo: 'flagDevolucao', rotulo: 'Aceita devolução' },
    { campo: 'flagComissao', rotulo: 'Sujeito à comissão' },
    { campo: 'permiteEstoqueNegativo', rotulo: 'Permite estoque negativo' },
    { campo: 'bloqueadoCompra', rotulo: 'Bloqueado para compra' },
    { campo: 'desativarAoZerarEstoque', rotulo: 'Desativar ao zerar o estoque' },
    { campo: 'bloqueadoVenda', rotulo: 'Bloqueado para venda' },
  ]

  const skuSomenteLeitura = !modoEdicao || camposDesabilitados
  const erroCodigoBarras =
    form.codigoBarras.trim() && !codigoBarrasGtinValido(form.codigoBarras)
      ? MENSAGEM_CODIGO_BARRAS_INVALIDO
      : form.codigoBarras.trim() &&
          !validarCodigosBarrasInternos(
            coletarCodigosBarrasProduto(form.codigoBarras, form.embalagensMaster)
          )
        ? MENSAGEM_CODIGO_BARRAS_DUPLICADO_NO_PRODUTO
        : undefined
  const errosEmbalagensMaster = calcularErrosEmbalagensMaster(
    form.codigoBarras,
    form.embalagensMaster
  )
  const erroNcm =
    form.ncm.trim() && !/^\d{8}$/.test(form.ncm.replace(/\D/g, ''))
      ? MENSAGEM_NCM_INVALIDO
      : undefined

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Cadastros &gt; Produtos</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Cadastro de Produtos</h1>
      </div>

      {mensagem && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagem}</p>
      )}
      {erro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      <CardPadrao
        titulo="Produtos"
        acoes={
          podeCriar && (
            <BotaoPrimario type="button" onClick={abrirNovo}>
              <Plus className="mr-1 size-4 inline" />
              Novo produto
            </BotaoPrimario>
          )
        }
      >
        <div className="mb-4 max-w-sm">
          <InputPadrao
            rotulo="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, SKU, marca ou código de barras..."
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium w-16">Foto</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Marca</th>
                <th className="px-4 py-3 font-medium">Unidade</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
              {lista.map((p: {
                id: string
                sku: string | null
                nomeVenda: string
                marca: string | null
                unidade: string
                ativo: boolean
                urlFotoMiniatura?: string | null
              }) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-border hover:bg-muted/30"
                  onClick={() => abrirVisualizacao(p)}
                >
                  <td className="px-4 py-2">
                    {urlFoto(p.urlFotoMiniatura) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={urlFoto(p.urlFotoMiniatura)!}
                        alt=""
                        className="size-10 rounded object-cover"
                      />
                    ) : (
                      <div className="size-10 rounded bg-muted" />
                    )}
                  </td>
                  <td className="px-4 py-2">{p.sku ?? '—'}</td>
                  <td className="px-4 py-2 font-medium">{p.nomeVenda}</td>
                  <td className="px-4 py-2">{p.marca ?? '—'}</td>
                  <td className="px-4 py-2">{p.unidade}</td>
                  <td className="px-4 py-2">
                    <BadgeStatus variante={p.ativo ? 'ativo' : 'inativo'}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </BadgeStatus>
                  </td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap justify-end gap-1">
                      {podeCriar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirModalDuplicar(p)}
                        >
                          Duplicar
                        </Button>
                      )}
                      {podeDesativar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => alternarAtivo(p)}
                        >
                          {p.ativo ? 'Desativar' : 'Reativar'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardPadrao>

      <Modal
        aberto={modalDuplicarAberto}
        aoFechar={fecharModalDuplicar}
        titulo="Duplicar produto"
        descricao="Informe o nome do novo produto. SKU e códigos de barras serão gerados ou preenchidos depois."
        largura="md"
        rodape={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={fecharModalDuplicar}>
              Cancelar
            </Button>
            <BotaoPrimario
              type="submit"
              form="form-duplicar-produto"
              disabled={duplicando || !nomeDuplicacao.trim()}
            >
              {duplicando ? 'Carregando...' : 'Continuar'}
            </BotaoPrimario>
          </div>
        }
      >
        <form id="form-duplicar-produto" onSubmit={confirmarDuplicacao}>
          <InputPadrao
            rotulo="Nome de venda *"
            value={nomeDuplicacao}
            maxLength={60}
            onChange={(e) =>
              setNomeDuplicacao(e.target.value.toUpperCase())
            }
            placeholder="Nome do novo produto"
          />
        </form>
      </Modal>

      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo={tituloModal}
        descricao={
          modoVisualizacao ? 'Consulta dos dados cadastrados (somente leitura)' : undefined
        }
        largura="4xl"
        manterPosicao={!modoVisualizacao}
        rodape={
          modoVisualizacao ? (
            <RodapeModalVisualizacao
              aoFechar={fecharModal}
              aoAnterior={irParaAbaAnterior}
              aoProximo={irParaProximaAba}
              mostrarAnterior={!ehPrimeiraAba}
              mostrarProximo={!ehUltimaAba}
              rotuloProximo="Próximo →"
              aoEditar={alternarParaEdicao}
              podeEditar={podeEditar}
              aoAlternarStatus={alternarAtivoVisualizacao}
              podeDesativar={podeDesativar}
              registroAtivo={form.ativo}
            />
          ) : (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              {podeSalvar && (
                <BotaoPrimario form="form-produto" type="submit" disabled={salvando}>
                  {rotuloBotaoSalvar}
                </BotaoPrimario>
              )}
            </div>
          )
        }
      >
        <form id="form-produto" onSubmit={aoSalvar} className="space-y-4">
          <Abas
            abas={abas}
            abaAtiva={abaAtiva}
            aoMudar={(id) => {
              if (!modoVisualizacao) marcarAbaVisitada(abaAtiva)
              setErro('')
              setAbaAtiva(id)
            }}
          />

          <fieldset disabled={somenteLeitura} className="m-0 min-w-0 space-y-4 border-0 p-0">
          {abaAtiva === 'principal' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoFotoProduto
                urlAtual={removerFoto ? null : urlFotoAtual}
                disabled={camposDesabilitados}
                aoComprimir={(r) => {
                  setFotoComprimida(r)
                  setRemoverFoto(false)
                }}
                aoRemover={() => {
                  setFotoComprimida(null)
                  setRemoverFoto(true)
                  setUrlFotoAtual(null)
                }}
              />
              <div className="flex flex-wrap items-end gap-4">
                <InputPadrao
                  rotulo="SKU"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  disabled={skuSomenteLeitura}
                  className="min-w-[8rem] flex-1"
                />
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id="produto-ativo"
                    checked={form.ativo}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v === true }))}
                    disabled={camposDesabilitados}
                  />
                  <Label htmlFor="produto-ativo" className="cursor-pointer text-sm font-normal">
                    Ativo
                  </Label>
                </div>
              </div>
              <InputPadrao
                rotulo="Nome de venda *"
                value={form.nomeVenda}
                maxLength={60}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nomeVenda: e.target.value.toUpperCase() }))
                }
                disabled={camposDesabilitados}
                className="sm:col-span-2"
              />
              <div className="sm:col-span-2">
                <ComboboxMarca
                  valor={form.marca}
                  aoMudar={(marca) => setForm((f) => ({ ...f, marca: marca.toUpperCase() }))}
                  disabled={camposDesabilitados}
                />
              </div>
              <div className="sm:col-span-2">
                <SelecaoUnidadeMedida
                  valor={form.unidade}
                  aoMudar={(sigla) => setForm((f) => ({ ...f, unidade: sigla }))}
                  disabled={camposDesabilitados}
                />
              </div>
              <TextareaPadrao
                rotulo="Características"
                value={form.caracteristicas}
                maxLength={2000}
                onChange={(e) => setForm((f) => ({ ...f, caracteristicas: e.target.value }))}
                disabled={camposDesabilitados}
                rows={6}
                className="sm:col-span-2"
              />
              <div className="sm:col-span-2 space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Tipo de entrega</p>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="tipoEntrega"
                      checked={form.tipoEntrega === 'pronta_entrega'}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          tipoEntrega: 'pronta_entrega',
                          diasParaEntrega: '',
                          dataValidadePreco: '',
                        }))
                      }
                      disabled={camposDesabilitados}
                      className="size-4"
                    />
                    Pronta entrega
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="tipoEntrega"
                      checked={form.tipoEntrega === 'sob_encomenda'}
                      onChange={() => setForm((f) => ({ ...f, tipoEntrega: 'sob_encomenda' }))}
                      disabled={camposDesabilitados}
                      className="size-4"
                    />
                    Sob encomenda
                  </label>
                </div>
                {form.tipoEntrega === 'sob_encomenda' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputPadrao
                      rotulo="Dias p/ entrega"
                      value={form.diasParaEntrega}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, diasParaEntrega: e.target.value.replace(/\D/g, '') }))
                      }
                      disabled={camposDesabilitados}
                      placeholder="Ex.: 7"
                    />
                    <InputPadrao
                      rotulo="Dt. validade do preço"
                      type="date"
                      value={form.dataValidadePreco}
                      onChange={(e) => setForm((f) => ({ ...f, dataValidadePreco: e.target.value }))}
                      disabled={camposDesabilitados}
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 space-y-2">
                <p className="text-sm font-medium">
                  Tipo de entrega permitido
                  <span className="ml-1 font-normal text-muted-foreground">
                    (no ato; a retirar; entregar; por encomenda)
                  </span>
                </p>
                <div className="flex flex-wrap gap-4">
                  {flagsEntregaPermitida.map(({ campo, rotulo }) => (
                    <label key={campo} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form[campo] as boolean}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, [campo]: v === true }))}
                        disabled={camposDesabilitados}
                      />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-3">
                <p className="text-sm font-medium">Outros parâmetros</p>

                <div className="flex flex-wrap gap-4">
                  {flagsBooleanos.map(({ campo, rotulo }) => (
                    <label key={campo} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form[campo] as boolean}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, [campo]: v === true }))}
                        disabled={camposDesabilitados}
                      />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'logistica' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InputPadrao
                  rotulo="Código de barras unidade"
                  value={form.codigoBarras}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      codigoBarras: filtrarEntradaCodigoBarras(e.target.value),
                    }))
                  }
                  disabled={camposDesabilitados}
                  mensagemDeErro={erroCodigoBarras}
                  placeholder="EAN-13 ou DUN-14"
                />
                <InputPadrao
                  rotulo="Peso unitário"
                  value={form.pesoKg}
                  onChange={(e) => setForm((f) => ({ ...f, pesoKg: e.target.value }))}
                  disabled={camposDesabilitados}
                  placeholder="Peso unitário com embalagem"
                />
                <InputPadrao
                  rotulo="Altura unitária (cm)"
                  value={form.alturaCm}
                  onChange={(e) => setForm((f) => ({ ...f, alturaCm: e.target.value }))}
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Largura unitária (cm)"
                  value={form.larguraCm}
                  onChange={(e) => setForm((f) => ({ ...f, larguraCm: e.target.value }))}
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Comprimento unitário (cm)"
                  value={form.comprimentoCm}
                  onChange={(e) => setForm((f) => ({ ...f, comprimentoCm: e.target.value }))}
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Capacidade de empilhamento em pallet"
                  value={form.capacidadeEmpilhamento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, capacidadeEmpilhamento: e.target.value }))
                  }
                  disabled={camposDesabilitados}
                />
                <InputPadrao
                  rotulo="Norma de palete"
                  value={form.normaPalete}
                  onChange={(e) => setForm((f) => ({ ...f, normaPalete: e.target.value }))}
                  disabled={camposDesabilitados}
                  className="sm:col-span-2"
                />
              </div>
              <ListaEmbalagensMaster
                itens={form.embalagensMaster}
                aoMudar={(itens) => setForm((f) => ({ ...f, embalagensMaster: itens }))}
                disabled={camposDesabilitados}
                errosPorIndice={errosEmbalagensMaster}
              />
              <ListaEnderecosEstoque
                itens={form.enderecosEstoque}
                aoMudar={(itens) => setForm((f) => ({ ...f, enderecosEstoque: itens }))}
                disabled={camposDesabilitados}
              />
            </div>
          )}

          {abaAtiva === 'compras' && (
            <div className="space-y-4 pb-2">
              <InputPadrao
                rotulo="Nome de compra"
                value={form.nomeCompra}
                onChange={(e) => setForm((f) => ({ ...f, nomeCompra: e.target.value }))}
                disabled={camposDesabilitados}
                placeholder="Opcional. Em branco, utiliza o nome de venda"
              />
              <ListaFornecedoresProduto
                itens={form.fornecedores}
                opcoesFornecedores={fornecedores}
                aoMudar={(fornecedoresItens) =>
                  setForm((f) => ({ ...f, fornecedores: fornecedoresItens }))
                }
                disabled={camposDesabilitados}
              />
              <SelecaoProdutosSimilares
                selecionados={form.similares}
                aoMudar={(similares) => setForm((f) => ({ ...f, similares }))}
                excluirId={idEmEdicao || undefined}
                disabled={camposDesabilitados}
              />
              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Análise de rupturas</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.agruparSimilaresRuptura}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, agruparSimilaresRuptura: v === true }))
                    }
                    disabled={camposDesabilitados}
                  />
                  Permitir agrupar similares nas verificações de ruptura de estoque
                </label>
              </div>
            </div>
          )}

          {abaAtiva === 'fiscal' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <InputPadrao
                rotulo="NCM"
                value={form.ncm}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) }))
                }
                disabled={camposDesabilitados}
                mensagemDeErro={erroNcm}
                placeholder="8 dígitos"
              />
              <SelectPadrao
                rotulo="Código de origem"
                valor={form.codigoOrigem}
                aoMudar={(v) => setForm((f) => ({ ...f, codigoOrigem: v }))}
                opcoes={[
                  { value: '', label: 'Selecione' },
                  ...ORIGENS_FISCAIS.map((o) => ({ value: o.value, label: o.label })),
                ]}
                disabled={camposDesabilitados}
              />
            </div>
          )}
          </fieldset>

          {!modoVisualizacao && erro && modalAberto && (
            <p className="text-sm text-destructive">{erro}</p>
          )}
        </form>
      </Modal>
    </div>
  )
}

export default function PaginaProdutos() {
  return (
    <ProtegerRota chaveDaPagina="produtos">
      <ConteudoDaPagina />
    </ProtegerRota>
  )
}
