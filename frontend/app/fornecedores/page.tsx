'use client'

/**
 * Tela de fornecedores — CRUD completo PF/PJ com validação inline,
 * BrasilAPI, verificação de duplicidade e flags fiscais.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { CampoSelect } from '@/components/compartilhado/campo-select'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { usePermissao } from '@/hooks/use-permissao'
import { useRegistrarAtalhos } from '@/hooks/use-registrar-atalhos'
import {
  tituloComAtalho,
  useTeclaDaAcao,
} from '@/components/compartilhado/provedor-de-atalhos'
import { useValidacaoDeAbas, type ConfigDeAba } from '@/hooks/use-validacao-de-abas'
import { useConfirmarSaida } from '@/hooks/use-confirmar-saida'
import { clonarFormulario } from '@/lib/formulario-alterado'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Modal } from '@/components/ui/modal'
import { Abas } from '@/components/ui/abas'
import { Separator } from '@/components/ui/separator'
import { exportarCsv } from '@/lib/exportar-csv'
import { submeterFormularioPorId } from '@/lib/atalhos/submeter-formulario'
import {
  mascaraDocumento,
  mascaraTelefone,
  mascaraCep,
  mascaraCpf,
  mascaraCnpj,
  detectarTipoDocumento,
  validarCpf,
  validarCnpj,
} from '@/lib/documentos'
import { buscarDadosCnpj } from '@/lib/brasil-api'
import { ListaContatos, type ContatoForm } from '@/components/clientes/lista-contatos'
import { ListaEnderecos, ENDERECO_VAZIO, type EnderecoForm } from '@/components/clientes/lista-enderecos'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoFornecedor = 'PF' | 'PJ'

type Fornecedor = {
  id: string
  papelId: string
  tipo: TipoFornecedor
  ativo: boolean
  nome: string
  cpf?: string | null
  rg?: string | null
  dataNascimento?: string | null
  cnpj?: string | null
  nomeFantasia?: string | null
  cnae?: string | null
  dataFundacao?: string | null
  ie?: string | null
  im?: string | null
  simplesNacional?: boolean
  observacaoNF?: string | null
  email?: string | null
  telefone?: string | null
  celular?: string | null
  celularWhatsapp?: boolean
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  codigoIbge?: string | null
  indicadorIe: string
  observacoes?: string | null
  condicaoPagamento?: string | null
  prazoEntrega?: number | null
  aceitaNFe55?: boolean
}

type FormFornecedor = {
  tipo: TipoFornecedor
  documento: string
  nome: string
  rg: string
  dataNascimento: string
  nomeFantasia: string
  cnae: string
  dataFundacao: string
  ie: string
  im: string
  simplesNacional: boolean
  observacaoNF: string
  email: string
  telefone: string
  celular: string
  celularWhatsapp: boolean
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  codigoIbge: string
  indicadorIe: string
  observacoes: string
  condicaoPagamento: string
  prazoEntrega: string
  aceitaNFe55: boolean
  contatos: ContatoForm[]
  enderecos: EnderecoForm[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

const INDICADORES_IE = [
  { value: '1', label: '1 — Contribuinte ICMS' },
  { value: '2', label: '2 — Contribuinte isento de IE' },
  { value: '9', label: '9 — Não contribuinte' },
]

const FORM_VAZIO: FormFornecedor = {
  tipo: 'PJ',
  documento: '',
  nome: '',
  rg: '',
  dataNascimento: '',
  nomeFantasia: '',
  cnae: '',
  dataFundacao: '',
  ie: '',
  im: '',
  simplesNacional: false,
  observacaoNF: '',
  email: '',
  telefone: '',
  celular: '',
  celularWhatsapp: false,
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  codigoIbge: '',
  indicadorIe: '9',
  observacoes: '',
  condicaoPagamento: '',
  prazoEntrega: '',
  aceitaNFe55: true,
  contatos: [],
  enderecos: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function documentoParaMascara(f: Fornecedor): string {
  if (f.tipo === 'PF' && f.cpf) return mascaraCpf(f.cpf)
  if (f.tipo === 'PJ' && f.cnpj) return mascaraCnpj(f.cnpj)
  return ''
}

function fornecedorParaForm(f: Fornecedor): FormFornecedor {
  return {
    tipo: f.tipo,
    documento: documentoParaMascara(f),
    nome: f.nome,
    rg: f.rg || '',
    dataNascimento: f.dataNascimento || '',
    nomeFantasia: f.nomeFantasia || '',
    cnae: f.cnae || '',
    dataFundacao: f.dataFundacao || '',
    ie: f.ie || '',
    im: f.im || '',
    simplesNacional: f.simplesNacional ?? false,
    observacaoNF: f.observacaoNF || '',
    email: f.email || '',
    telefone: f.telefone ? mascaraTelefone(f.telefone) : '',
    celular: f.celular ? mascaraTelefone(f.celular) : '',
    celularWhatsapp: f.celularWhatsapp ?? false,
    cep: f.cep ? mascaraCep(f.cep) : '',
    logradouro: f.logradouro || '',
    numero: f.numero || '',
    complemento: f.complemento || '',
    bairro: f.bairro || '',
    cidade: f.cidade || '',
    estado: f.estado || '',
    codigoIbge: f.codigoIbge || '',
    indicadorIe: f.indicadorIe || '9',
    observacoes: f.observacoes || '',
    condicaoPagamento: f.condicaoPagamento || '',
    prazoEntrega: f.prazoEntrega != null ? String(f.prazoEntrega) : '',
    aceitaNFe55: f.aceitaNFe55 ?? true,
    contatos: Array.isArray((f as any).contatos)
      ? (f as any).contatos.map((ct: any) => ({
          tipo: ct.tipo,
          valor: ct.valor,
          descricao: ct.descricao || '',
          whatsapp: ct.whatsapp ?? false,
          principal: ct.principal ?? false,
        }))
      : [],
    enderecos: Array.isArray((f as any).enderecos)
      ? (f as any).enderecos.map((e: any) => ({
          tipo: e.tipo,
          apelido: e.apelido || '',
          cep: e.cep ? mascaraCep(e.cep) : '',
          logradouro: e.logradouro || '',
          numero: e.numero || '',
          complemento: e.complemento || '',
          bairro: e.bairro || '',
          cidade: e.cidade || '',
          estado: e.estado || '',
          codigoIbge: e.codigoIbge || '',
        }))
      : [],
  }
}

// ─── Validação ────────────────────────────────────────────────────────────────

type ErrosDoForm = Partial<Record<string, string>>

const PREFIXO_ERRO_POR_CAMPO: Record<string, string> = {
  nome: 'Identificação',
  documento: 'Identificação',
  email: 'Contato',
  telefone: 'Contato',
  contatos: 'Contato',
  cep: 'Endereço',
  logradouro: 'Endereço',
  numero: 'Endereço',
  bairro: 'Endereço',
  cidade: 'Endereço',
  estado: 'Endereço',
  codigoIbge: 'Endereço',
  enderecos: 'Endereço',
}

function validarFormFornecedor(form: FormFornecedor): ErrosDoForm {
  const erros: ErrosDoForm = {}

  if (!form.nome.trim() || form.nome.trim().length < 2)
    erros.nome = 'nome obrigatório (mínimo 2 caracteres)'

  const nums = form.documento.replace(/\D/g, '')
  if (form.tipo === 'PF') {
    if (!validarCpf(nums)) erros.documento = 'CPF inválido — verifique os dígitos'
  } else if (!validarCnpj(nums)) {
    erros.documento = 'CNPJ inválido — verifique os dígitos'
  }

  if (form.codigoIbge && !/^\d{7}$/.test(form.codigoIbge.replace(/\D/g, '')))
    erros.codigoIbge = 'Código IBGE deve ter 7 dígitos'

  const temEmailSimples = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const temTelefoneSimples =
    form.telefone.replace(/\D/g, '').length >= 10 ||
    form.celular.replace(/\D/g, '').length >= 10

  const temEmailArray = form.contatos.some(
    (c) => c.tipo === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.valor.trim())
  )
  const temTelefoneArray = form.contatos.some(
    (c) => c.tipo === 'telefone' && c.valor.replace(/\D/g, '').length >= 10
  )

  const modoArray = form.contatos.length > 0

  if (modoArray) {
    if (!temEmailArray && !temTelefoneArray) {
      erros.contatos = 'informe ao menos um e-mail válido e um telefone ou celular'
    } else if (!temEmailArray) {
      erros.contatos = 'informe ao menos um e-mail válido'
    } else if (!temTelefoneArray) {
      erros.contatos = 'informe ao menos um telefone ou celular'
    }
  } else {
    if (!temEmailSimples) erros.email = 'e-mail obrigatório e deve ser válido'
    if (!temTelefoneSimples) erros.telefone = 'informe telefone fixo ou celular'
  }

  const modoArrayEnd = form.enderecos.length > 0
  const principal = modoArrayEnd
    ? form.enderecos.find((e) => e.tipo === 'principal')
    : null

  const cep = modoArrayEnd ? (principal?.cep ?? '') : form.cep
  const logradouro = modoArrayEnd ? (principal?.logradouro ?? '') : form.logradouro
  const numero = modoArrayEnd ? (principal?.numero ?? '') : form.numero
  const bairro = modoArrayEnd ? (principal?.bairro ?? '') : form.bairro
  const cidade = modoArrayEnd ? (principal?.cidade ?? '') : form.cidade
  const estado = modoArrayEnd ? (principal?.estado ?? '') : form.estado

  if (modoArrayEnd) {
    if (
      cep.replace(/\D/g, '').length < 8 ||
      !logradouro.trim() ||
      !numero.trim() ||
      !bairro.trim() ||
      !cidade.trim() ||
      !estado.trim()
    ) {
      erros.enderecos = 'preencha o endereço principal completo (CEP, logradouro, número, bairro, cidade e UF)'
    }
  } else {
    if (cep.replace(/\D/g, '').length < 8) erros.cep = 'CEP obrigatório (8 dígitos)'
    if (!logradouro.trim()) erros.logradouro = 'logradouro obrigatório'
    if (!numero.trim()) erros.numero = 'número obrigatório'
    if (!bairro.trim()) erros.bairro = 'bairro obrigatório'
    if (!cidade.trim()) erros.cidade = 'cidade obrigatória'
    if (!estado.trim()) erros.estado = 'estado (UF) obrigatório'
  }

  return erros
}

function gerarPendenciasDoForm(form: FormFornecedor): string[] {
  return Object.entries(validarFormFornecedor(form)).map(
    ([campo, mensagem]) => `${PREFIXO_ERRO_POR_CAMPO[campo] ?? 'Formulário'}: ${mensagem}`
  )
}

function calcularStatusCadastro(f: Fornecedor): { completo: boolean; pendencias: string[] } {
  const erros: string[] = []
  if (!f.nome || f.nome.trim().length < 2) erros.push('Nome obrigatório')
  if (!f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) erros.push('E-mail obrigatório')
  if (!f.telefone && !f.celular) erros.push('Telefone ou celular obrigatório')
  if (!f.cep || f.cep.replace(/\D/g, '').length < 8) erros.push('CEP obrigatório')
  if (!f.logradouro) erros.push('Logradouro obrigatório')
  if (!f.numero) erros.push('Número obrigatório')
  return { completo: erros.length === 0, pendencias: erros }
}

function extrairErro(erro: unknown, padrao: string): string {
  const e = erro as {
    response?: { data?: { mensagem?: string; message?: string } }
    message?: string
    code?: string
  }
  if (!e.response) {
    if (e.code === 'ERR_NETWORK') return 'Não foi possível conectar à API.'
    return e.message || padrao
  }
  return e.response.data?.mensagem || e.response.data?.message || padrao
}

// ─── Campos reutilizáveis ─────────────────────────────────────────────────────

function CampoInput({
  rotulo, valor, aoMudar, tipo = 'text', placeholder, maxLength,
  obrigatorio, ajuda, mensagemDeErro, onBlur, disabled,
}: {
  rotulo: string; valor: string; aoMudar: (v: string) => void
  tipo?: string; placeholder?: string; maxLength?: number
  obrigatorio?: boolean; ajuda?: string; mensagemDeErro?: string
  onBlur?: () => void; disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium leading-none">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <input
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          mensagemDeErro && 'border-destructive'
        )}
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        required={obrigatorio}
        disabled={disabled}
        aria-invalid={!!mensagemDeErro}
      />
      {mensagemDeErro && <p className="text-sm text-destructive">{mensagemDeErro}</p>}
      {ajuda && !mensagemDeErro && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  )
}

function CampoCheckbox({ rotulo, valor, aoMudar, ajuda }: {
  rotulo: string; valor: boolean; aoMudar: (v: boolean) => void; ajuda?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => aoMudar(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary"
      />
      <span className="text-sm font-medium leading-none">{rotulo}</span>
      {ajuda && <span className="text-xs text-muted-foreground">— {ajuda}</span>}
    </label>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

function ConteudoDaPaginaDeFornecedores() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('fornecedores:create')
  const podeEditar = usePermissao('fornecedores:edit')
  const podeDesativar = usePermissao('fornecedores:delete')

  const [listaFornecedores, setListaFornecedores] = useState<Fornecedor[]>([])
  const [mensagemDeErro, setMensagemDeErro] = useState('')
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState('')
  const [busca, setBusca] = useState('')
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('identificacao')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState<FormFornecedor>(FORM_VAZIO)
  const [formInicial, setFormInicial] = useState<FormFornecedor>(() => clonarFormulario(FORM_VAZIO))
  const formRef = useRef(form)
  formRef.current = form

  const [verificandoDocumento, setVerificandoDocumento] = useState(false)
  const [avisoDuplicidade, setAvisoDuplicidade] = useState<{
    tipo: 'fornecedor_existente' | 'pessoa_sem_papel'
    fornecedorId?: string
    mensagem: string
  } | null>(null)
  const [carregandoBrasilApi, setCarregandoBrasilApi] = useState(false)
  const [camposTocados, setCamposTocados] = useState<Set<string>>(() => new Set())
  const [erroSalvar, setErroSalvar] = useState('')
  const [tooltipAberto, setTooltipAberto] = useState<string | null>(null)
  const refBusca = useRef<HTMLInputElement>(null)

  const teclaNovo = useTeclaDaAcao('novo')
  const teclaExportar = useTeclaDaAcao('exportar')
  const teclaSalvar = useTeclaDaAcao('salvar')
  const teclaCancelar = useTeclaDaAcao('cancelar')

  // ─── Validação de abas ───────────────────────────────────────────────────

  const configAbas: ConfigDeAba[] = useMemo(
    () => [
      {
        id: 'identificacao',
        validar: () => {
          const f = formRef.current
          if (!f.nome.trim() || f.nome.trim().length < 2) return false
          const nums = f.documento.replace(/\D/g, '')
          if (f.tipo === 'PF') return validarCpf(nums)
          return validarCnpj(nums)
        },
      },
      {
        id: 'contato',
        validar: () => {
          const f = formRef.current
          if (f.contatos.length > 0) {
            const temEmail = f.contatos.some(
              (c) => c.tipo === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.valor.trim())
            )
            const temTel = f.contatos.some(
              (c) => c.tipo === 'telefone' && c.valor.replace(/\D/g, '').length >= 10
            )
            return temEmail && temTel
          }
          const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())
          const telOk =
            f.telefone.replace(/\D/g, '').length >= 10 ||
            f.celular.replace(/\D/g, '').length >= 10
          return emailOk && telOk
        },
      },
      {
        id: 'endereco',
        validar: () => {
          const f = formRef.current
          let cep = f.cep; let logradouro = f.logradouro; let numero = f.numero
          let bairro = f.bairro; let cidade = f.cidade; let estado = f.estado
          if (f.enderecos.length > 0) {
            const p = f.enderecos.find((e) => e.tipo === 'principal')
            cep = p?.cep ?? ''; logradouro = p?.logradouro ?? ''; numero = p?.numero ?? ''
            bairro = p?.bairro ?? ''; cidade = p?.cidade ?? ''; estado = p?.estado ?? ''
          }
          return (
            cep.replace(/\D/g, '').length >= 8 &&
            logradouro.trim().length > 0 &&
            numero.trim().length > 0 &&
            bairro.trim().length > 0 &&
            cidade.trim().length > 0 &&
            estado.trim().length > 0
          )
        },
      },
    ],
    []
  )

  const { statusDasAbas, validarTodasAsAbas, irParaAbaComErro, resetarStatus } =
    useValidacaoDeAbas(configAbas)

  const abasComStatus = [
    { id: 'identificacao', rotulo: 'Identificação', status: statusDasAbas['identificacao'] },
    { id: 'contato', rotulo: 'Contato', status: statusDasAbas['contato'] },
    { id: 'endereco', rotulo: 'Endereço', status: statusDasAbas['endereco'] },
  ]

  const errosForm = useMemo(() => validarFormFornecedor(form), [form])
  const documentoDuplicado = avisoDuplicidade?.tipo === 'fornecedor_existente'
  const formularioValido = Object.keys(errosForm).length === 0 && !documentoDuplicado

  useEffect(() => {
    if (modalAberto) validarTodasAsAbas()
  }, [form, modalAberto, validarTodasAsAbas])

  const tocarCampo = useCallback((id: string) => {
    setCamposTocados((anterior) => {
      if (anterior.has(id)) return anterior
      const proximo = new Set(anterior)
      proximo.add(id)
      return proximo
    })
  }, [])

  function erroVisivel(campo: string): string | undefined {
    if (!camposTocados.has(campo)) return undefined
    return errosForm[campo as keyof ErrosDoForm]
  }

  function erroDocumentoVisivel(): string | undefined {
    if (!camposTocados.has('documento')) return undefined
    if (documentoDuplicado) return avisoDuplicidade?.mensagem
    return errosForm.documento
  }

  // ─── Dados ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarFornecedores()
  }, [carregandoSessao, estaAutenticado])

  async function carregarFornecedores() {
    setCarregandoLista(true)
    try {
      const { data } = await clienteHttp.get('/fornecedores')
      setListaFornecedores(data.fornecedores)
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao carregar fornecedores'))
    } finally {
      setCarregandoLista(false)
    }
  }

  function set<K extends keyof FormFornecedor>(campo: K, valor: FormFornecedor[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  // ─── Modal ──────────────────────────────────────────────────────────────

  function abrirModalNovo() {
    const vazio = clonarFormulario(FORM_VAZIO)
    setForm(vazio)
    setFormInicial(vazio)
    setModoEdicao(false)
    setIdEmEdicao('')
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setErroSalvar('')
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    resetarStatus()
    setModalAberto(true)
  }

  function abrirModalEdicao(f: Fornecedor) {
    const formEdicao = fornecedorParaForm(f)
    setForm(formEdicao)
    setFormInicial(clonarFormulario(formEdicao))
    setModoEdicao(true)
    setIdEmEdicao(f.id)
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setErroSalvar('')
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    resetarStatus()
    setModalAberto(true)
  }

  const fecharModal = useCallback(() => {
    setModalAberto(false)
    setMensagemDeErro('')
    setErroSalvar('')
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    resetarStatus()
  }, [resetarStatus])

  const { solicitarFechar, dialogoConfirmacao } = useConfirmarSaida(
    form,
    formInicial,
    fecharModal
  )

  // ─── Campo documento unificado ───────────────────────────────────────────

  function aoMudarDocumento(valor: string) {
    tocarCampo('documento')
    const comMascara = mascaraDocumento(valor)
    const nums = comMascara.replace(/\D/g, '')
    const tipo = nums.length > 11 ? 'PJ' : 'PF'
    setForm((f) => ({
      ...f,
      documento: comMascara,
      tipo,
      ...(tipo !== f.tipo
        ? { rg: '', dataNascimento: '', nomeFantasia: '', cnae: '', dataFundacao: '', ie: '', im: '', simplesNacional: false, observacaoNF: '' }
        : {}),
    }))
    setAvisoDuplicidade(null)
  }

  async function aoSairDocumento() {
    tocarCampo('documento')
    if (modoEdicao) return
    const nums = form.documento.replace(/\D/g, '')
    const tipoDetectado = detectarTipoDocumento(form.documento)
    if (!tipoDetectado) return
    const valido = tipoDetectado === 'CPF' ? validarCpf(nums) : validarCnpj(nums)
    if (!valido) return

    if (tipoDetectado === 'CNPJ') {
      setCarregandoBrasilApi(true)
      const dados = await buscarDadosCnpj(nums)
      setCarregandoBrasilApi(false)
      if (dados) {
        setForm((f) => ({
          ...f,
          nome: f.nome || dados.nome,
          nomeFantasia: f.nomeFantasia || dados.nomeFantasia,
          cnae: f.cnae || dados.cnae,
          dataFundacao: f.dataFundacao || dados.dataFundacao,
          cep: f.cep || mascaraCep(dados.cep),
          logradouro: f.logradouro || dados.logradouro,
          numero: f.numero || dados.numero,
          bairro: f.bairro || dados.bairro,
          cidade: f.cidade || dados.cidade,
          estado: f.estado || dados.estado,
          codigoIbge: f.codigoIbge || dados.codigoIbge,
        }))
      }
    }

    setVerificandoDocumento(true)
    try {
      const { data } = await clienteHttp.get(`/fornecedores/por-documento/${nums}`)
      if (data.encontrado) {
        if (data.temPapelFornecedor) {
          setAvisoDuplicidade({
            tipo: 'fornecedor_existente',
            fornecedorId: data.pessoa?.id,
            mensagem: `Documento já cadastrado como fornecedor: ${data.pessoa?.nome}`,
          })
        } else {
          setAvisoDuplicidade({
            tipo: 'pessoa_sem_papel',
            mensagem: `Pessoa encontrada no sistema (${data.papeis.join(', ')}): ${data.pessoa?.nome}. Os dados foram pré-preenchidos.`,
          })
          if (data.pessoa) {
            const importado = fornecedorParaForm({ ...data.pessoa, tipo: form.tipo } as Fornecedor)
            setForm((f) => ({
              ...f,
              nome: importado.nome || f.nome,
              nomeFantasia: importado.nomeFantasia || f.nomeFantasia,
              ie: importado.ie || f.ie,
              email: importado.email || f.email,
              telefone: importado.telefone || f.telefone,
              celular: importado.celular || f.celular,
              cep: importado.cep || f.cep,
              logradouro: importado.logradouro || f.logradouro,
              numero: importado.numero || f.numero,
              complemento: importado.complemento || f.complemento,
              bairro: importado.bairro || f.bairro,
              cidade: importado.cidade || f.cidade,
              estado: importado.estado || f.estado,
              codigoIbge: importado.codigoIbge || f.codigoIbge,
            }))
          }
        }
      }
    } catch {
      // ignora erros de duplicidade
    } finally {
      setVerificandoDocumento(false)
    }
  }

  // ─── CEP ────────────────────────────────────────────────────────────────

  async function buscarCep(cep: string) {
    const nums = cep.replace(/\D/g, '')
    if (nums.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`)
      const dados = await res.json()
      if (!dados.erro) {
        setForm((f) => ({
          ...f,
          logradouro: dados.logradouro || f.logradouro,
          bairro: dados.bairro || f.bairro,
          cidade: dados.localidade || f.cidade,
          estado: dados.uf || f.estado,
          codigoIbge: dados.ibge || f.codigoIbge,
        }))
      }
    } catch {
      // ignora
    }
  }

  // ─── Montar corpo ────────────────────────────────────────────────────────

  function montarCorpo() {
    const nums = form.documento.replace(/\D/g, '')
    const base = {
      tipo: form.tipo,
      nome: form.nome,
      email: form.email || undefined,
      telefone: form.telefone || undefined,
      celular: form.celular || undefined,
      celularWhatsapp: form.celularWhatsapp,
      cep: form.cep || undefined,
      logradouro: form.logradouro || undefined,
      numero: form.numero || undefined,
      complemento: form.complemento || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      estado: form.estado || undefined,
      codigoIbge: form.codigoIbge || undefined,
      indicadorIe: form.indicadorIe || '9',
      observacoes: form.observacoes || undefined,
      condicaoPagamento: form.condicaoPagamento || undefined,
      prazoEntrega: form.prazoEntrega ? parseInt(form.prazoEntrega, 10) : undefined,
      aceitaNFe55: form.aceitaNFe55,
    }

    const contatosPayload =
      form.contatos.length > 0
        ? { contatos: form.contatos.filter((c) => c.valor.trim()) }
        : { email: form.email || undefined, telefone: form.telefone || undefined, celular: form.celular || undefined, celularWhatsapp: form.celularWhatsapp }

    const enderecosPayload =
      form.enderecos.length > 0
        ? { enderecos: form.enderecos.map((e) => ({ ...e, cep: e.cep.replace(/\D/g, '') || undefined })) }
        : { cep: form.cep || undefined, logradouro: form.logradouro || undefined, numero: form.numero || undefined, complemento: form.complemento || undefined, bairro: form.bairro || undefined, cidade: form.cidade || undefined, estado: form.estado || undefined, codigoIbge: form.codigoIbge || undefined }

    if (form.tipo === 'PF') {
      return { ...base, ...contatosPayload, ...enderecosPayload, cpf: nums, rg: form.rg || undefined, dataNascimento: form.dataNascimento || undefined }
    }

    return {
      ...base, ...contatosPayload, ...enderecosPayload,
      cnpj: nums,
      nomeFantasia: form.nomeFantasia || undefined,
      cnae: form.cnae || undefined,
      dataFundacao: form.dataFundacao || undefined,
      ie: form.ie || undefined,
      im: form.im || undefined,
      simplesNacional: form.simplesNacional,
      observacaoNF: form.observacaoNF || undefined,
    }
  }

  // ─── Salvar ──────────────────────────────────────────────────────────────

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    setErroSalvar('')

    if (!formularioValido) {
      validarTodasAsAbas()
      const abaComErro = irParaAbaComErro()
      if (abaComErro) setAbaAtiva(abaComErro)
      return
    }

    setSalvando(true)
    try {
      const corpo = montarCorpo()
      if (modoEdicao) {
        await clienteHttp.put(`/fornecedores/${idEmEdicao}`, corpo)
        setMensagemDeSucesso('Fornecedor atualizado!')
      } else {
        await clienteHttp.post('/fornecedores', corpo)
        setMensagemDeSucesso('Fornecedor cadastrado!')
      }
      fecharModal()
      await carregarFornecedores()
    } catch (erro) {
      const msg = extrairErro(erro, 'Erro ao salvar fornecedor')
      if (/documento|cpf|cnpj|duplicad/i.test(msg)) {
        tocarCampo('documento')
        setAvisoDuplicidade({ tipo: 'fornecedor_existente', mensagem: msg })
      } else {
        setErroSalvar(msg)
      }
    } finally {
      setSalvando(false)
    }
  }

  async function alternarStatus(f: Fornecedor) {
    setMensagemDeErro('')
    setMensagemDeSucesso('')
    setAlterandoStatus(f.id)
    try {
      await clienteHttp.patch(`/fornecedores/${f.id}/ativo`, { ativo: !f.ativo })
      setMensagemDeSucesso(f.ativo ? 'Fornecedor desativado.' : 'Fornecedor reativado.')
      await carregarFornecedores()
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao alterar status'))
    } finally {
      setAlterandoStatus(null)
    }
  }

  const qualquerOperacaoAtiva = salvando || verificandoDocumento || carregandoBrasilApi

  const exportarListaFornecedores = useCallback(() => {
    exportarCsv(
      listaFornecedores.map((f) => ({
        Nome: f.nome,
        Tipo: f.tipo,
        Documento: f.tipo === 'PF' ? (f.cpf || '') : (f.cnpj || ''),
        Email: f.email ?? '',
        Telefone: f.telefone ?? '',
        Cidade: f.cidade ?? '',
        UF: f.estado ?? '',
        Status: f.ativo ? 'Ativo' : 'Inativo',
      })),
      'fornecedores'
    )
  }, [listaFornecedores])

  useRegistrarAtalhos(
    {
      buscar: () => refBusca.current?.focus(),
      novo: abrirModalNovo,
      atualizar: carregarFornecedores,
      salvar: () => submeterFormularioPorId('form-fornecedor'),
      cancelar: solicitarFechar,
      exportar: exportarListaFornecedores,
    },
    {
      buscar: !modalAberto,
      novo: podeCriar && !modalAberto,
      atualizar: !modalAberto && !carregandoLista,
      salvar: modalAberto && formularioValido && !qualquerOperacaoAtiva,
      cancelar: modalAberto && !qualquerOperacaoAtiva,
      exportar: !modalAberto,
    }
  )

  const fornecedoresFiltrados = listaFornecedores.filter((f) => {
    const termo = busca.toLowerCase()
    return (
      f.nome.toLowerCase().includes(termo) ||
      (f.cpf && f.cpf.includes(busca.replace(/\D/g, ''))) ||
      (f.cnpj && f.cnpj.includes(busca.replace(/\D/g, ''))) ||
      (f.email && f.email.toLowerCase().includes(termo)) ||
      (f.cidade && f.cidade.toLowerCase().includes(termo))
    )
  })

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {mensagemDeErro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{mensagemDeErro}</p>
      )}
      {mensagemDeSucesso && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagemDeSucesso}</p>
      )}

      {dialogoConfirmacao}

      {/* Modal de criar/editar */}
      <Modal
        aberto={modalAberto}
        aoFechar={solicitarFechar}
        titulo={modoEdicao ? `Editar fornecedor: ${form.nome}` : 'Novo fornecedor'}
        largura="2xl"
        rodape={
          <div className="flex w-full items-center justify-between gap-2">
            {erroSalvar ? (
              <p className="text-sm text-destructive">{erroSalvar}</p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={solicitarFechar}
                disabled={salvando}
                title={tituloComAtalho('Cancelar', teclaCancelar)}
              >
                Cancelar
              </Button>
              <BotaoPrimario
                form="form-fornecedor"
                type="submit"
                disabled={salvando || !formularioValido}
                title={tituloComAtalho(
                  modoEdicao ? 'Salvar' : 'Cadastrar fornecedor',
                  teclaSalvar
                )}
              >
                {salvando ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Salvando...
                  </span>
                ) : modoEdicao ? 'Salvar' : 'Cadastrar fornecedor'}
              </BotaoPrimario>
            </div>
          </div>
        }
      >
        {/* Aviso de duplicidade */}
        {avisoDuplicidade && (
          <div className={`mb-4 rounded-md px-3 py-2 text-sm ${
            avisoDuplicidade.tipo === 'fornecedor_existente'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
          }`}>
            {avisoDuplicidade.mensagem}
          </div>
        )}

        <Abas abas={abasComStatus} abaAtiva={abaAtiva} aoMudar={setAbaAtiva} className="mb-5" />

        <div className="relative">
          {salvando && (
            <div className="absolute inset-0 z-10 rounded-md bg-background/60 backdrop-blur-[1px]" />
          )}
          <form id="form-fornecedor" onSubmit={aoSalvar}>

            {/* ── Aba 1: Identificação ─────────────────────────────────── */}
            {abaAtiva === 'identificacao' && (
              <div className="space-y-5">
                <div className="flex gap-2">
                  <button type="button" disabled={qualquerOperacaoAtiva}
                    onClick={() => { setForm((f) => ({ ...f, tipo: 'PF', documento: '' })); setAvisoDuplicidade(null) }}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${form.tipo === 'PF' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'}`}>
                    Pessoa Física (CPF)
                  </button>
                  <button type="button" disabled={qualquerOperacaoAtiva}
                    onClick={() => { setForm((f) => ({ ...f, tipo: 'PJ', documento: '' })); setAvisoDuplicidade(null) }}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${form.tipo === 'PJ' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'}`}>
                    Pessoa Jurídica (CNPJ)
                  </button>
                </div>

                <Separator />

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">
                    {form.tipo === 'PF' ? 'CPF' : 'CNPJ'}
                    <span className="ml-0.5 text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className={cn(
                        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50',
                        erroDocumentoVisivel() && 'border-destructive'
                      )}
                      type="text"
                      value={form.documento}
                      onChange={(e) => aoMudarDocumento(e.target.value)}
                      onBlur={aoSairDocumento}
                      placeholder={form.tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                      maxLength={form.tipo === 'PF' ? 14 : 18}
                      disabled={modoEdicao}
                      aria-invalid={!!erroDocumentoVisivel()}
                    />
                    {(verificandoDocumento || carregandoBrasilApi) && (
                      <span className="absolute right-2 top-2 text-xs text-muted-foreground">
                        {carregandoBrasilApi ? 'Buscando na Receita...' : 'Verificando...'}
                      </span>
                    )}
                  </div>
                  {erroDocumentoVisivel() && (
                    <p className="text-sm text-destructive">{erroDocumentoVisivel()}</p>
                  )}
                  {modoEdicao && !erroDocumentoVisivel() && (
                    <p className="text-xs text-muted-foreground">CPF/CNPJ não pode ser alterado após o cadastro.</p>
                  )}
                </div>

                {form.tipo === 'PF' && (
                  <div className="space-y-4">
                    <CampoInput rotulo="Nome completo" valor={form.nome}
                      aoMudar={(v) => { tocarCampo('nome'); set('nome', v) }}
                      placeholder="Nome como no documento" obrigatorio
                      mensagemDeErro={erroVisivel('nome')} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="RG" valor={form.rg} aoMudar={(v) => set('rg', v)} placeholder="Número do RG" maxLength={20} />
                      <CampoInput rotulo="Data de nascimento" valor={form.dataNascimento} aoMudar={(v) => set('dataNascimento', v)} tipo="date" />
                    </div>
                    <CampoSelect rotulo="Indicador IE (NF-e)" valor={form.indicadorIe} aoMudar={(v) => set('indicadorIe', v)} opcoes={INDICADORES_IE} obrigatorio />
                    <CampoCheckbox rotulo="Aceita NF-e modelo 55" valor={form.aceitaNFe55} aoMudar={(v) => set('aceitaNFe55', v)} />
                  </div>
                )}

                {form.tipo === 'PJ' && (
                  <div className="space-y-4">
                    <CampoInput rotulo="Razão social" valor={form.nome}
                      aoMudar={(v) => { tocarCampo('nome'); set('nome', v) }}
                      placeholder="Razão social completa" obrigatorio
                      mensagemDeErro={erroVisivel('nome')} />
                    <CampoInput rotulo="Nome fantasia" valor={form.nomeFantasia} aoMudar={(v) => set('nomeFantasia', v)} placeholder="Nome comercial (opcional)" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="IE" valor={form.ie} aoMudar={(v) => set('ie', v)} placeholder="Inscrição Estadual" maxLength={30} />
                      <CampoInput rotulo="IM" valor={form.im} aoMudar={(v) => set('im', v)} placeholder="Inscrição Municipal" maxLength={30} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="CNAE" valor={form.cnae} aoMudar={(v) => set('cnae', v)} placeholder="Código CNAE" maxLength={10} />
                      <CampoInput rotulo="Data de fundação" valor={form.dataFundacao} aoMudar={(v) => set('dataFundacao', v)} tipo="date" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoSelect rotulo="Indicador IE (NF-e)" valor={form.indicadorIe} aoMudar={(v) => set('indicadorIe', v)} opcoes={INDICADORES_IE} obrigatorio />
                      <CampoCheckbox rotulo="Simples Nacional" valor={form.simplesNacional} aoMudar={(v) => set('simplesNacional', v)} />
                      <CampoCheckbox rotulo="Aceita NF-e modelo 55" valor={form.aceitaNFe55} aoMudar={(v) => set('aceitaNFe55', v)} />
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoInput rotulo="Condição de pagamento" valor={form.condicaoPagamento}
                    aoMudar={(v) => set('condicaoPagamento', v)} placeholder="Ex: 30/60/90 dias" maxLength={100} />
                  <CampoInput rotulo="Prazo de entrega (dias)" valor={form.prazoEntrega}
                    aoMudar={(v) => set('prazoEntrega', v.replace(/\D/g, ''))} placeholder="Ex: 7" maxLength={4}
                    ajuda="Prazo médio em dias úteis" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Observações</label>
                  <textarea
                    className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.observacoes}
                    onChange={(e) => set('observacoes', e.target.value)}
                    placeholder="Informações adicionais sobre o fornecedor..."
                    maxLength={500}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* ── Aba 2: Contato ─────────────────────────────────────── */}
            {abaAtiva === 'contato' && (
              <div className="space-y-4">
                {form.contatos.length > 0 ? (
                  <ListaContatos
                    contatos={form.contatos}
                    aoMudar={(v) => { tocarCampo('contatos'); set('contatos', v) }}
                    mensagemDeErro={erroVisivel('contatos')}
                  />
                ) : (
                  <>
                    <InputPadrao
                      rotulo="Email"
                      type="email"
                      value={form.email}
                      onChange={(e) => { tocarCampo('email'); set('email', e.target.value) }}
                      onBlur={() => tocarCampo('email')}
                      placeholder="fornecedor@email.com.br"
                      mensagemDeErro={erroVisivel('email')}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="Telefone" valor={form.telefone}
                        aoMudar={(v) => { tocarCampo('telefone'); set('telefone', mascaraTelefone(v)) }}
                        onBlur={() => tocarCampo('telefone')}
                        placeholder="(00) 0000-0000" maxLength={14}
                        mensagemDeErro={erroVisivel('telefone')} />
                      <CampoInput rotulo="Celular" valor={form.celular}
                        aoMudar={(v) => { tocarCampo('telefone'); set('celular', mascaraTelefone(v)) }}
                        onBlur={() => tocarCampo('telefone')}
                        placeholder="(00) 00000-0000" maxLength={15} />
                    </div>
                    <CampoCheckbox rotulo="Celular com WhatsApp" valor={form.celularWhatsapp} aoMudar={(v) => set('celularWhatsapp', v)} />
                  </>
                )}
                <button type="button"
                  onClick={() => {
                    if (form.contatos.length > 0) {
                      set('contatos', [])
                    } else {
                      const inicial: ContatoForm[] = []
                      if (form.email) inicial.push({ tipo: 'email', valor: form.email, descricao: '', whatsapp: false, principal: true })
                      if (form.telefone) inicial.push({ tipo: 'telefone', valor: form.telefone, descricao: '', whatsapp: false, principal: true })
                      if (form.celular) inicial.push({ tipo: 'telefone', valor: form.celular, descricao: '', whatsapp: form.celularWhatsapp, principal: false })
                      set('contatos', inicial.length > 0 ? inicial : [{ tipo: 'email', valor: '', descricao: '', whatsapp: false, principal: true }])
                    }
                  }}
                  className="text-xs text-primary underline">
                  {form.contatos.length > 0 ? '← Modo simples' : '+ Múltiplos contatos'}
                </button>
              </div>
            )}

            {/* ── Aba 3: Endereço ────────────────────────────────────── */}
            {abaAtiva === 'endereco' && (
              <div className="space-y-4">
                {form.enderecos.length > 0 ? (
                  <ListaEnderecos
                    enderecos={form.enderecos}
                    aoMudar={(v) => { tocarCampo('enderecos'); set('enderecos', v) }}
                    mensagemDeErro={erroVisivel('enderecos')}
                  />
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <CampoInput rotulo="CEP" valor={form.cep}
                        aoMudar={(v) => { tocarCampo('cep'); set('cep', mascaraCep(v)) }}
                        onBlur={() => { tocarCampo('cep'); buscarCep(form.cep) }}
                        placeholder="00000-000" maxLength={9} mensagemDeErro={erroVisivel('cep')} />
                      <div className="sm:col-span-2">
                        <CampoInput rotulo="Logradouro" valor={form.logradouro}
                          aoMudar={(v) => { tocarCampo('logradouro'); set('logradouro', v) }}
                          onBlur={() => tocarCampo('logradouro')}
                          placeholder="Rua, Avenida..." mensagemDeErro={erroVisivel('logradouro')} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <CampoInput rotulo="Número" valor={form.numero}
                        aoMudar={(v) => { tocarCampo('numero'); set('numero', v) }}
                        onBlur={() => tocarCampo('numero')}
                        placeholder="123 ou S/N" maxLength={20} mensagemDeErro={erroVisivel('numero')} />
                      <div className="sm:col-span-2">
                        <CampoInput rotulo="Complemento" valor={form.complemento} aoMudar={(v) => set('complemento', v)} placeholder="Sala, Apto..." maxLength={100} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="Bairro" valor={form.bairro}
                        aoMudar={(v) => { tocarCampo('bairro'); set('bairro', v) }}
                        onBlur={() => tocarCampo('bairro')}
                        placeholder="Bairro" maxLength={100} mensagemDeErro={erroVisivel('bairro')} />
                      <CampoInput rotulo="Cidade" valor={form.cidade}
                        aoMudar={(v) => { tocarCampo('cidade'); set('cidade', v) }}
                        onBlur={() => tocarCampo('cidade')}
                        placeholder="Cidade" maxLength={100} mensagemDeErro={erroVisivel('cidade')} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoSelect rotulo="Estado (UF)" valor={form.estado}
                        aoMudar={(v) => { tocarCampo('estado'); set('estado', v) }}
                        opcoes={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
                        mensagemDeErro={erroVisivel('estado')} />
                      <CampoInput rotulo="Código IBGE" valor={form.codigoIbge}
                        aoMudar={(v) => { tocarCampo('codigoIbge'); set('codigoIbge', v.replace(/\D/g, '').slice(0, 7)) }}
                        onBlur={() => tocarCampo('codigoIbge')}
                        placeholder="0000000 (7 dígitos)" maxLength={7}
                        ajuda={erroVisivel('codigoIbge') ? undefined : 'Preenchido automaticamente pelo CEP'}
                        mensagemDeErro={erroVisivel('codigoIbge')} />
                    </div>
                  </>
                )}
                <button type="button"
                  onClick={() => {
                    if (form.enderecos.length > 0) {
                      set('enderecos', [])
                    } else {
                      set('enderecos', [{
                        tipo: 'principal', apelido: '', cep: form.cep, logradouro: form.logradouro,
                        numero: form.numero, complemento: form.complemento, bairro: form.bairro,
                        cidade: form.cidade, estado: form.estado, codigoIbge: form.codigoIbge,
                      }])
                    }
                  }}
                  className="text-xs text-primary underline">
                  {form.enderecos.length > 0 ? '← Modo simples' : '+ Múltiplos endereços'}
                </button>
              </div>
            )}
          </form>
        </div>
      </Modal>

      {/* Tabela */}
      <CardPadrao
        titulo="Fornecedores"
        descricao="Lista de todos os fornecedores cadastrados"
        acoes={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportarListaFornecedores}
              title={tituloComAtalho('Exportar CSV', teclaExportar)}
            >
              Exportar CSV
            </Button>
            {podeCriar && (
              <BotaoPrimario
                type="button"
                onClick={abrirModalNovo}
                title={tituloComAtalho('Novo fornecedor', teclaNovo)}
              >
                + Novo fornecedor
              </BotaoPrimario>
            )}
          </div>
        }
      >
        <div className="mb-4">
          <input
            ref={refBusca}
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, documento ou cidade..."
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Documento</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Cidade</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Cadastro</th>
                <th className="px-4 py-3 text-left font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregandoLista &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!carregandoLista && fornecedoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {listaFornecedores.length === 0 ? 'Nenhum fornecedor cadastrado.' : 'Nenhum fornecedor encontrado.'}
                  </td>
                </tr>
              )}

              {!carregandoLista && fornecedoresFiltrados.map((f) => {
                const { completo, pendencias } = calcularStatusCadastro(f)
                const documento = f.tipo === 'PF'
                  ? (f.cpf ? mascaraCpf(f.cpf) : '—')
                  : (f.cnpj ? mascaraCnpj(f.cnpj) : '—')

                return (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{f.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{documento}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.cidade || '—'}</td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante={f.ativo ? 'ativo' : 'inativo'}>
                        {f.ativo ? 'Ativo' : 'Inativo'}
                      </BadgeStatus>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block">
                        <span
                          className={`inline-flex cursor-default items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            completo
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}
                          onMouseEnter={() => !completo && setTooltipAberto(f.id)}
                          onMouseLeave={() => setTooltipAberto(null)}
                        >
                          {completo ? '✓ Completo' : '⚠ Incompleto'}
                        </span>
                        {tooltipAberto === f.id && pendencias.length > 0 && (
                          <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-md border border-border bg-popover p-2 shadow-md">
                            <p className="mb-1 text-xs font-medium">Pendências:</p>
                            <ul className="space-y-0.5">
                              {pendencias.map((p, idx) => (
                                <li key={idx} className="text-xs text-muted-foreground">• {p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {podeEditar && (
                          <Button type="button" variant="outline" size="sm" onClick={() => abrirModalEdicao(f)}>
                            Editar
                          </Button>
                        )}
                        {podeDesativar && (
                          <Button
                            type="button"
                            variant={f.ativo ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => alternarStatus(f)}
                            disabled={alterandoStatus === f.id}
                          >
                            {alterandoStatus === f.id ? 'Aguarde...' : f.ativo ? 'Desativar' : 'Reativar'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!carregandoLista && fornecedoresFiltrados.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {fornecedoresFiltrados.length} de {listaFornecedores.length} fornecedor{listaFornecedores.length === 1 ? '' : 'es'}
          </p>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaDeFornecedores() {
  return (
    <ProtegerRota chaveDaPagina="fornecedores">
      <ConteudoDaPaginaDeFornecedores />
    </ProtegerRota>
  )
}
