'use client'

/**
 * Tela de transportadoras — CRUD completo PF/PJ com validação inline,
 * BrasilAPI, verificação de duplicidade e campos específicos (ANTT, tipo veículo).
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { LinhaTabelaClicavel } from '@/components/compartilhado/linha-tabela-clicavel'
import { RodapeModalVisualizacao } from '@/components/compartilhado/rodape-modal-visualizacao'
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
import { submeterFormularioPorId } from '@/lib/atalhos/submeter-formulario'
import { paraCaixaAlta } from '@/lib/texto'
import {
  mascaraPorTipo,
  mascaraTelefone,
  mascaraCep,
  mascaraCpf,
  mascaraCnpj,
  validarCpf,
  validarCnpj,
} from '@/lib/documentos'
import { useConsultaDocumento } from '@/hooks/use-consulta-documento'
import { ListaContatos, type ContatoForm } from '@/components/clientes/lista-contatos'
import { ListaEnderecos, type EnderecoForm } from '@/components/clientes/lista-enderecos'
import { ListaDadosBancarios, DADOS_BANCARIO_VAZIO, dadosBancarioApiParaForm, type DadosBancarioForm } from '@/components/clientes/lista-dados-bancarios'
import { CampoInscricaoEstadual } from '@/components/pessoas/campo-inscricao-estadual'
import { mesclarTexto, mesclarArray, mesclarBoolean } from '@/lib/mesclar-pre-preenchimento'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoTransportadora = 'PF' | 'PJ'

type Transportadora = {
  id: string
  papelId: string
  tipo: TipoTransportadora
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
  antt?: string | null
  aceitaNFe55?: boolean
  dadosBancarios?: DadosBancarioForm[]
}

type FormTransportadora = {
  tipo: TipoTransportadora
  documento: string
  nome: string
  rg: string
  dataNascimento: string
  nomeFantasia: string
  cnae: string
  dataFundacao: string
  ie: string
  ieIsento: boolean
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
  antt: string
  aceitaNFe55: boolean
  contatos: ContatoForm[]
  enderecos: EnderecoForm[]
  dadosBancarios: DadosBancarioForm[]
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

const FORM_VAZIO: FormTransportadora = {
  tipo: 'PJ',
  documento: '',
  nome: '',
  rg: '',
  dataNascimento: '',
  nomeFantasia: '',
  cnae: '',
  dataFundacao: '',
  ie: '',
  ieIsento: false,
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
  antt: '',
  aceitaNFe55: true,
  contatos: [],
  enderecos: [],
  dadosBancarios: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function documentoParaMascara(t: Transportadora): string {
  if (t.tipo === 'PF' && t.cpf) return mascaraCpf(t.cpf)
  if (t.tipo === 'PJ' && t.cnpj) return mascaraCnpj(t.cnpj)
  return ''
}

function transportadoraParaForm(t: Transportadora): FormTransportadora {
  return {
    tipo: t.tipo,
    documento: documentoParaMascara(t),
    nome: t.nome,
    rg: t.rg || '',
    dataNascimento: t.dataNascimento || '',
    nomeFantasia: t.nomeFantasia || '',
    cnae: t.cnae || '',
    dataFundacao: t.dataFundacao || '',
    ie: t.ie === 'ISENTO' ? '' : (t.ie || ''),
    ieIsento: t.ie === 'ISENTO',
    im: t.im || '',
    simplesNacional: t.simplesNacional ?? false,
    observacaoNF: t.observacaoNF || '',
    email: t.email || '',
    telefone: t.telefone ? mascaraTelefone(t.telefone) : '',
    celular: t.celular ? mascaraTelefone(t.celular) : '',
    celularWhatsapp: t.celularWhatsapp ?? false,
    cep: t.cep ? mascaraCep(t.cep) : '',
    logradouro: t.logradouro || '',
    numero: t.numero || '',
    complemento: t.complemento || '',
    bairro: t.bairro || '',
    cidade: t.cidade || '',
    estado: t.estado || '',
    codigoIbge: t.codigoIbge || '',
    indicadorIe: t.indicadorIe || '9',
    observacoes: t.observacoes || '',
    antt: t.antt || '',
    aceitaNFe55: t.aceitaNFe55 ?? true,
    contatos: Array.isArray((t as any).contatos)
      ? (t as any).contatos.map((ct: any) => ({
          tipo: ct.tipo, valor: ct.valor, descricao: ct.descricao || '',
          whatsapp: ct.whatsapp ?? false, principal: ct.principal ?? false,
        }))
      : [],
    enderecos: Array.isArray((t as any).enderecos)
      ? (t as any).enderecos.map((e: any) => ({
          tipo: e.tipo, apelido: e.apelido || '', cep: e.cep ? mascaraCep(e.cep) : '',
          logradouro: e.logradouro || '', numero: e.numero || '', complemento: e.complemento || '',
          bairro: e.bairro || '', cidade: e.cidade || '', estado: e.estado || '', codigoIbge: e.codigoIbge || '',
        }))
      : [],
    dadosBancarios: Array.isArray((t as any).dadosBancarios)
      ? (t as any).dadosBancarios.map((db: any) =>
          dadosBancarioApiParaForm(db, t.nome, documentoParaMascara(t))
        )
      : [],
  }
}

// ─── Validação ────────────────────────────────────────────────────────────────

type ErrosDoForm = Partial<Record<string, string>>

const PREFIXO_ERRO_POR_CAMPO: Record<string, string> = {
  nome: 'Identificação', documento: 'Identificação',
  email: 'Contato', telefone: 'Contato', contatos: 'Contato',
  cep: 'Endereço', logradouro: 'Endereço', numero: 'Endereço',
  bairro: 'Endereço', cidade: 'Endereço', estado: 'Endereço',
  codigoIbge: 'Endereço', enderecos: 'Endereço',
  dadosBancarios: 'Dados Bancários',
}

const ROTULO_POR_ABA: Record<string, string> = {
  identificacao: 'Identificação',
  contato: 'Contato',
  endereco: 'Endereço',
  'dados-bancarios': 'Dados Bancários',
}

const CAMPOS_POR_ABA: Record<string, string[]> = {
  identificacao: ['nome', 'documento'],
  contato: ['email', 'telefone', 'contatos'],
  endereco: ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'codigoIbge', 'enderecos'],
  'dados-bancarios': ['dadosBancarios'],
}

function gerarPendenciasDaAba(abaId: string, form: FormTransportadora): string[] {
  const rotulo = ROTULO_POR_ABA[abaId]
  return Object.entries(validarFormTransportadora(form))
    .filter(([campo]) => PREFIXO_ERRO_POR_CAMPO[campo] === rotulo)
    .map(([, mensagem]) => mensagem)
    .filter((m): m is string => !!m)
}

function erroDadosBancariosTransp(dados: DadosBancarioForm[]): string | undefined {
  for (const db of dados) {
    const temAlgum = [db.apelido, db.banco, db.agencia, db.conta, db.pix, db.favorecido, db.documentoFavorecido].some((v) => v.trim().length > 0)
    if (temAlgum && (!db.banco.trim() || !db.agencia.trim() || !db.conta.trim())) {
      return 'contas parcialmente preenchidas devem ter banco, agência e conta'
    }
  }
  return undefined
}

function validarFormTransportadora(form: FormTransportadora): ErrosDoForm {
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
    if (!temEmailArray && !temTelefoneArray) erros.contatos = 'informe ao menos um e-mail válido e um telefone ou celular'
    else if (!temEmailArray) erros.contatos = 'informe ao menos um e-mail válido'
    else if (!temTelefoneArray) erros.contatos = 'informe ao menos um telefone ou celular'
  } else {
    if (!temEmailSimples) erros.email = 'e-mail obrigatório e deve ser válido'
    if (!temTelefoneSimples) erros.telefone = 'informe telefone fixo ou celular'
  }

  const modoArrayEnd = form.enderecos.length > 0
  const principal = modoArrayEnd ? form.enderecos.find((e) => e.tipo === 'principal') : null
  const cep = modoArrayEnd ? (principal?.cep ?? '') : form.cep
  const logradouro = modoArrayEnd ? (principal?.logradouro ?? '') : form.logradouro
  const numero = modoArrayEnd ? (principal?.numero ?? '') : form.numero
  const bairro = modoArrayEnd ? (principal?.bairro ?? '') : form.bairro
  const cidade = modoArrayEnd ? (principal?.cidade ?? '') : form.cidade
  const estado = modoArrayEnd ? (principal?.estado ?? '') : form.estado

  if (modoArrayEnd) {
    if (cep.replace(/\D/g, '').length < 8 || !logradouro.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || !estado.trim())
      erros.enderecos = 'preencha o endereço principal completo (CEP, logradouro, número, bairro, cidade e UF)'
  } else {
    if (cep.replace(/\D/g, '').length < 8) erros.cep = 'CEP obrigatório (8 dígitos)'
    if (!logradouro.trim()) erros.logradouro = 'logradouro obrigatório'
    if (!numero.trim()) erros.numero = 'número obrigatório'
    if (!bairro.trim()) erros.bairro = 'bairro obrigatório'
    if (!cidade.trim()) erros.cidade = 'cidade obrigatória'
    if (!estado.trim()) erros.estado = 'estado (UF) obrigatório'
  }

  const erroDadosBancarios = erroDadosBancariosTransp(form.dadosBancarios)
  if (erroDadosBancarios) erros.dadosBancarios = erroDadosBancarios

  return erros
}

function calcularStatusCadastro(t: Transportadora): { completo: boolean; pendencias: string[] } {
  const erros: string[] = []
  if (!t.nome || t.nome.trim().length < 2) erros.push('Nome obrigatório')
  if (!t.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) erros.push('E-mail obrigatório')
  if (!t.telefone && !t.celular) erros.push('Telefone ou celular obrigatório')
  if (!t.cep || t.cep.replace(/\D/g, '').length < 8) erros.push('CEP obrigatório')
  if (!t.logradouro) erros.push('Logradouro obrigatório')
  if (!t.numero) erros.push('Número obrigatório')
  return { completo: erros.length === 0, pendencias: erros }
}

function extrairErro(erro: unknown, padrao: string): string {
  const e = erro as { response?: { data?: { mensagem?: string; message?: string } }; message?: string; code?: string }
  if (!e.response) { if (e.code === 'ERR_NETWORK') return 'Não foi possível conectar à API.'; return e.message || padrao }
  return e.response.data?.mensagem || e.response.data?.message || padrao
}

// ─── Campos reutilizáveis ─────────────────────────────────────────────────────

function CampoInput({ rotulo, valor, aoMudar, tipo = 'text', placeholder, maxLength, obrigatorio, ajuda, mensagemDeErro, onBlur, disabled }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; tipo?: string; placeholder?: string
  maxLength?: number; obrigatorio?: boolean; ajuda?: string; mensagemDeErro?: string; onBlur?: () => void; disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium leading-none">
        {rotulo}{obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <input
        className={cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', mensagemDeErro && 'border-destructive')}
        type={tipo} value={valor} onChange={(e) => aoMudar(e.target.value)} onBlur={onBlur}
        placeholder={placeholder} maxLength={maxLength} required={obrigatorio} disabled={disabled}
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
      <input type="checkbox" checked={valor} onChange={(e) => aoMudar(e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
      <span className="text-sm font-medium leading-none">{rotulo}</span>
      {ajuda && <span className="text-xs text-muted-foreground">— {ajuda}</span>}
    </label>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

function ConteudoDaPaginaDeTransportadoras() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('transportadoras:create')
  const podeEditar = usePermissao('transportadoras:edit')
  const podeDesativar = usePermissao('transportadoras:delete')

  const [listaTransportadoras, setListaTransportadoras] = useState<Transportadora[]>([])
  const [mensagemDeErro, setMensagemDeErro] = useState('')
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState('')
  const [busca, setBusca] = useState('')
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [modoVisualizacao, setModoVisualizacao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('identificacao')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState<FormTransportadora>(FORM_VAZIO)
  const [formInicial, setFormInicial] = useState<FormTransportadora>(() =>
    clonarFormulario(FORM_VAZIO)
  )
  const formRef = useRef(form)
  formRef.current = form
  const modoEdicaoRef = useRef(modoEdicao)
  modoEdicaoRef.current = modoEdicao
  const modoVisualizacaoRef = useRef(modoVisualizacao)
  modoVisualizacaoRef.current = modoVisualizacao

  const somenteLeitura = modoVisualizacao

  const [avisoDuplicidade, setAvisoDuplicidade] = useState<{
    tipo: 'transportadora_existente' | 'pessoa_sem_papel'; transportadoraId?: string; mensagem: string
  } | null>(null)
  const [camposTocados, setCamposTocados] = useState<Set<string>>(() => new Set())
  const [erroSalvar, setErroSalvar] = useState('')
  const [errosDaAbaAtual, setErrosDaAbaAtual] = useState<string[]>([])
  const [tooltipAberto, setTooltipAberto] = useState<string | null>(null)
  const refBusca = useRef<HTMLInputElement>(null)

  const idsAbas = ['identificacao', 'contato', 'endereco', 'dados-bancarios']
  const indiceAbaAtiva = idsAbas.indexOf(abaAtiva)
  const ehPrimeiraAba = indiceAbaAtiva === 0
  const ehUltimaAba = indiceAbaAtiva === idsAbas.length - 1

  const teclaNovo = useTeclaDaAcao('novo')
  const teclaSalvar = useTeclaDaAcao('salvar')
  const teclaCancelar = useTeclaDaAcao('cancelar')

  function validarDadosBancariosTransp(dados: DadosBancarioForm[]): boolean {
    return !erroDadosBancariosTransp(dados)
  }

  const configAbas: ConfigDeAba[] = useMemo(() => [
    {
      id: 'identificacao',
      validar: () => {
        const f = formRef.current
        if (!f.nome.trim() || f.nome.trim().length < 2) return false
        const nums = f.documento.replace(/\D/g, '')
        return f.tipo === 'PF' ? validarCpf(nums) : validarCnpj(nums)
      },
    },
    {
      id: 'contato',
      validar: () => {
        const f = formRef.current
        if (f.contatos.length > 0) {
          const temEmail = f.contatos.some((c) => c.tipo === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.valor.trim()))
          const temTel = f.contatos.some((c) => c.tipo === 'telefone' && c.valor.replace(/\D/g, '').length >= 10)
          return temEmail && temTel
        }
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())
        const telOk = f.telefone.replace(/\D/g, '').length >= 10 || f.celular.replace(/\D/g, '').length >= 10
        return emailOk && telOk
      },
    },
    {
      id: 'endereco',
      validar: () => {
        const f = formRef.current
        let cep = f.cep, logradouro = f.logradouro, numero = f.numero, bairro = f.bairro, cidade = f.cidade, estado = f.estado
        if (f.enderecos.length > 0) {
          const p = f.enderecos.find((e) => e.tipo === 'principal')
          cep = p?.cep ?? ''; logradouro = p?.logradouro ?? ''; numero = p?.numero ?? ''
          bairro = p?.bairro ?? ''; cidade = p?.cidade ?? ''; estado = p?.estado ?? ''
        }
        return cep.replace(/\D/g, '').length >= 8 && logradouro.trim().length > 0 && numero.trim().length > 0 && bairro.trim().length > 0 && cidade.trim().length > 0 && estado.trim().length > 0
      },
    },
    {
      id: 'dados-bancarios',
      validar: () => validarDadosBancariosTransp(formRef.current.dadosBancarios),
    },
  ], [])

  const { statusDasAbas, validarTodasAsAbas, irParaAbaComErro, resetarStatus, validarAba, abaLiberada } =
    useValidacaoDeAbas(configAbas)

  const abasComStatus = [
    { id: 'identificacao', rotulo: 'Identificação', status: statusDasAbas['identificacao'] },
    { id: 'contato', rotulo: 'Contato', status: statusDasAbas['contato'] },
    { id: 'endereco', rotulo: 'Endereço', status: statusDasAbas['endereco'] },
    { id: 'dados-bancarios', rotulo: 'Dados Bancários', status: statusDasAbas['dados-bancarios'] },
  ]

  const errosForm = useMemo(() => validarFormTransportadora(form), [form])
  const documentoDuplicado = avisoDuplicidade?.tipo === 'transportadora_existente'
  const formularioValido = Object.keys(errosForm).length === 0 && !documentoDuplicado

  const etapaAtualLiberada =
    abaLiberada(abaAtiva) && !(abaAtiva === 'identificacao' && documentoDuplicado)

  useEffect(() => { if (modalAberto) validarTodasAsAbas() }, [form, modalAberto, validarTodasAsAbas])

  const tocarCampo = useCallback((id: string) => {
    setCamposTocados((anterior) => {
      if (anterior.has(id)) return anterior
      const proximo = new Set(anterior); proximo.add(id); return proximo
    })
  }, [])

  const {
    aoSairDocumento,
    carregandoBrasilApi,
    verificandoDocumento,
    resetarConsulta,
  } = useConsultaDocumento({
    getForm: () => ({ documento: formRef.current.documento, tipo: formRef.current.tipo }),
    getModoEdicao: () => modoEdicaoRef.current,
    getSomenteLeitura: () => modoVisualizacaoRef.current,
    endpointPorDocumento: '/transportadoras/por-documento',
    tocarCampo,
    aoAplicarDadosCnpj: (dados) => {
      setForm((f) => ({
        ...f,
        nome: mesclarTexto(f.nome, dados.nome),
        nomeFantasia: mesclarTexto(f.nomeFantasia, dados.nomeFantasia),
        cnae: mesclarTexto(f.cnae, dados.cnae),
        dataFundacao: mesclarTexto(f.dataFundacao, dados.dataFundacao),
        email: mesclarTexto(f.email, dados.email),
        telefone: mesclarTexto(f.telefone, dados.telefone),
        celular: mesclarTexto(f.celular, dados.celular),
        simplesNacional: mesclarBoolean(f.simplesNacional, dados.simplesNacional),
        cep: mesclarTexto(f.cep, mascaraCep(dados.cep)),
        logradouro: mesclarTexto(f.logradouro, dados.logradouro),
        numero: mesclarTexto(f.numero, dados.numero),
        complemento: mesclarTexto(f.complemento, dados.complemento),
        bairro: mesclarTexto(f.bairro, dados.bairro),
        cidade: mesclarTexto(f.cidade, dados.cidade),
        estado: mesclarTexto(f.estado, dados.estado),
        codigoIbge: mesclarTexto(f.codigoIbge, dados.codigoIbge),
      }))
    },
    aoProcessarResposta: (data) => {
      if (!data.encontrado) return
      const tipo = formRef.current.tipo
      if (data.temPapelTransportadora) {
        setAvisoDuplicidade({ tipo: 'transportadora_existente', transportadoraId: data.pessoa?.id, mensagem: `Documento já cadastrado como transportadora: ${data.pessoa?.nome}` })
      } else {
        setAvisoDuplicidade({ tipo: 'pessoa_sem_papel', mensagem: `Pessoa encontrada no sistema (${(data.papeis as string[])?.join(', ')}): ${data.pessoa?.nome}. Dados pré-preenchidos.` })
        if (data.pessoa) {
          const importado = transportadoraParaForm({ ...(data.pessoa as Transportadora), tipo } as Transportadora)
          setForm((f) => ({
            ...f,
            nome: mesclarTexto(f.nome, importado.nome),
            nomeFantasia: mesclarTexto(f.nomeFantasia, importado.nomeFantasia),
            cnae: mesclarTexto(f.cnae, importado.cnae),
            dataFundacao: mesclarTexto(f.dataFundacao, importado.dataFundacao),
            ie: importado.ieIsento ? '' : mesclarTexto(f.ie, importado.ie),
            ieIsento: importado.ieIsento || f.ieIsento,
            im: mesclarTexto(f.im, importado.im),
            simplesNacional: mesclarBoolean(f.simplesNacional, importado.simplesNacional),
            email: mesclarTexto(f.email, importado.email),
            telefone: mesclarTexto(f.telefone, importado.telefone),
            celular: mesclarTexto(f.celular, importado.celular),
            celularWhatsapp: mesclarBoolean(f.celularWhatsapp, importado.celularWhatsapp),
            cep: mesclarTexto(f.cep, importado.cep),
            logradouro: mesclarTexto(f.logradouro, importado.logradouro),
            numero: mesclarTexto(f.numero, importado.numero),
            complemento: mesclarTexto(f.complemento, importado.complemento),
            bairro: mesclarTexto(f.bairro, importado.bairro),
            cidade: mesclarTexto(f.cidade, importado.cidade),
            estado: mesclarTexto(f.estado, importado.estado),
            codigoIbge: mesclarTexto(f.codigoIbge, importado.codigoIbge),
            contatos: mesclarArray(f.contatos, importado.contatos),
            enderecos: mesclarArray(f.enderecos, importado.enderecos),
            dadosBancarios: mesclarArray(f.dadosBancarios, importado.dadosBancarios),
          }))
        }
      }
    },
  })

  function erroVisivel(campo: string): string | undefined {
    if (!camposTocados.has(campo)) return undefined
    return errosForm[campo as keyof ErrosDoForm]
  }

  function erroDocumentoVisivel(): string | undefined {
    if (!camposTocados.has('documento')) return undefined
    if (documentoDuplicado) return avisoDuplicidade?.mensagem
    return errosForm.documento
  }

  const tocarCamposDaAba = useCallback((abaId: string) => {
    const campos = CAMPOS_POR_ABA[abaId] ?? []
    setCamposTocados((anterior) => {
      const proximo = new Set(anterior)
      for (const campo of campos) proximo.add(campo)
      return proximo
    })
  }, [])

  function aoAvancar() {
    if (modoVisualizacao) {
      setErrosDaAbaAtual([])
      setAbaAtiva((atual) => {
        const i = idsAbas.indexOf(atual)
        return i >= 0 && i < idsAbas.length - 1 ? idsAbas[i + 1] : atual
      })
      return
    }

    if (abaAtiva === 'identificacao' && documentoDuplicado) {
      tocarCamposDaAba('identificacao')
      setErrosDaAbaAtual([avisoDuplicidade?.mensagem ?? 'Documento já cadastrado'])
      return
    }

    const ok = validarAba(abaAtiva)
    if (!ok) {
      tocarCamposDaAba(abaAtiva)
      setErrosDaAbaAtual(gerarPendenciasDaAba(abaAtiva, form))
      return
    }

    setErrosDaAbaAtual([])
    setAbaAtiva((atual) => {
      const i = idsAbas.indexOf(atual)
      return i >= 0 && i < idsAbas.length - 1 ? idsAbas[i + 1] : atual
    })
  }

  function irParaAbaAnterior() {
    setErrosDaAbaAtual([])
    setAbaAtiva((atual) => {
      const i = idsAbas.indexOf(atual)
      return i > 0 ? idsAbas[i - 1] : atual
    })
  }

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarTransportadoras()
  }, [carregandoSessao, estaAutenticado])

  async function carregarTransportadoras() {
    setCarregandoLista(true)
    try {
      const { data } = await clienteHttp.get('/transportadoras')
      setListaTransportadoras(data.transportadoras)
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao carregar transportadoras'))
    } finally {
      setCarregandoLista(false)
    }
  }

  function set<K extends keyof FormTransportadora>(campo: K, valor: FormTransportadora[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function abrirModalNovo() {
    const vazio = clonarFormulario(FORM_VAZIO)
    setForm(vazio)
    setFormInicial(vazio)
    setModoEdicao(false)
    setModoVisualizacao(false)
    setIdEmEdicao('')
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setErroSalvar('')
    setErrosDaAbaAtual([])
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    resetarStatus()
    resetarConsulta()
    setModalAberto(true)
  }

  function abrirModalEdicao(t: Transportadora) {
    const formEdicao = transportadoraParaForm(t)
    setForm(formEdicao)
    setFormInicial(clonarFormulario(formEdicao))
    setModoEdicao(true)
    setModoVisualizacao(false)
    setIdEmEdicao(t.id)
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setErroSalvar('')
    setErrosDaAbaAtual([])
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    resetarStatus()
    resetarConsulta()
    setModalAberto(true)
  }

  function abrirModalVisualizacao(t: Transportadora) {
    const formView = transportadoraParaForm(t)
    setForm(formView)
    setFormInicial(clonarFormulario(formView))
    setModoEdicao(false)
    setModoVisualizacao(true)
    setIdEmEdicao(t.id)
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setErroSalvar('')
    setErrosDaAbaAtual([])
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    resetarStatus()
    resetarConsulta()
    setModalAberto(true)
  }

  function alternarParaEdicao() {
    if (!podeEditar) return
    setModoVisualizacao(false)
    setModoEdicao(true)
    setFormInicial(clonarFormulario(form))
    setErrosDaAbaAtual([])
    resetarConsulta()
  }

  const fecharModal = useCallback(() => {
    setModalAberto(false)
    setModoVisualizacao(false)
    setMensagemDeErro('')
    setErroSalvar('')
    setErrosDaAbaAtual([])
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    resetarStatus()
    resetarConsulta()
  }, [resetarStatus, resetarConsulta])

  const { solicitarFechar, dialogoConfirmacao } = useConfirmarSaida(
    form,
    formInicial,
    fecharModal
  )

  function camposAoTrocarTipo(novoTipo: 'PF' | 'PJ') {
    return {
      rg: '',
      dataNascimento: '',
      nomeFantasia: '',
      cnae: '',
      dataFundacao: '',
      ie: '',
      ieIsento: false,
      im: '',
      simplesNacional: false,
      observacaoNF: '',
      aceitaNFe55: novoTipo === 'PJ',
    }
  }

  function aoMudarTipo(novoTipo: 'PF' | 'PJ') {
    setForm((f) => {
      const nums = f.documento.replace(/\D/g, '')
      const documento = nums ? mascaraPorTipo(nums, novoTipo) : ''
      return {
        ...f,
        tipo: novoTipo,
        documento,
        ...(f.tipo !== novoTipo ? camposAoTrocarTipo(novoTipo) : {}),
      }
    })
    setAvisoDuplicidade(null)
  }

  function aoMudarDocumento(valor: string) {
    tocarCampo('documento')
    setForm((f) => ({
      ...f,
      documento: mascaraPorTipo(valor, f.tipo),
    }))
    setAvisoDuplicidade(null)
  }

  async function buscarCep(cep: string) {
    const nums = cep.replace(/\D/g, '')
    if (nums.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${nums}/json/`)
      const dados = await res.json()
      if (!dados.erro) setForm((f) => ({
        ...f,
        logradouro: dados.logradouro ? paraCaixaAlta(dados.logradouro) : f.logradouro,
        bairro: dados.bairro ? paraCaixaAlta(dados.bairro) : f.bairro,
        cidade: dados.localidade ? paraCaixaAlta(dados.localidade) : f.cidade,
        estado: dados.uf || f.estado,
        codigoIbge: dados.ibge || f.codigoIbge,
      }))
    } catch { /* ignora */ }
  }

  function montarCorpo() {
    const nums = form.documento.replace(/\D/g, '')
    const base = {
      tipo: form.tipo, nome: form.nome,
      email: form.email || undefined, telefone: form.telefone || undefined,
      celular: form.celular || undefined, celularWhatsapp: form.celularWhatsapp,
      cep: form.cep || undefined, logradouro: form.logradouro || undefined, numero: form.numero || undefined,
      complemento: form.complemento || undefined, bairro: form.bairro || undefined, cidade: form.cidade || undefined,
      estado: form.estado || undefined, codigoIbge: form.codigoIbge || undefined,
      indicadorIe: form.indicadorIe || '9', observacoes: form.observacoes || undefined,
      antt: form.antt || undefined,
    }
    const contatosPayload = form.contatos.length > 0
      ? { contatos: form.contatos.filter((c) => c.valor.trim()) }
      : { email: form.email || undefined, telefone: form.telefone || undefined, celular: form.celular || undefined, celularWhatsapp: form.celularWhatsapp }
    const enderecosPayload = form.enderecos.length > 0
      ? { enderecos: form.enderecos.map((e) => ({ ...e, cep: e.cep.replace(/\D/g, '') || undefined })) }
      : { cep: form.cep || undefined, logradouro: form.logradouro || undefined, numero: form.numero || undefined, complemento: form.complemento || undefined, bairro: form.bairro || undefined, cidade: form.cidade || undefined, estado: form.estado || undefined, codigoIbge: form.codigoIbge || undefined }
    const dadosBancariosPayload = form.dadosBancarios.filter((db) =>
      [db.apelido, db.banco, db.agencia, db.conta, db.pix, db.favorecido, db.documentoFavorecido].some((v) => v.trim())
    ).map((db) => ({
      apelido: db.apelido || undefined, banco: db.banco || undefined, agencia: db.agencia || undefined,
      conta: db.conta || undefined, tipoConta: db.tipoConta || undefined, pix: db.pix || undefined,
      favorecido: db.favorecido || undefined, documentoFavorecido: db.documentoFavorecido.replace(/\D/g, '') || undefined,
      principal: db.principal,
    }))

    if (form.tipo === 'PF') return { ...base, ...contatosPayload, ...enderecosPayload, cpf: nums, rg: form.rg || undefined, dataNascimento: form.dataNascimento || undefined, aceitaNFe55: form.aceitaNFe55, dadosBancarios: dadosBancariosPayload.length > 0 ? dadosBancariosPayload : undefined }
    return { ...base, ...contatosPayload, ...enderecosPayload, cnpj: nums, nomeFantasia: form.nomeFantasia || undefined, cnae: form.cnae || undefined, dataFundacao: form.dataFundacao || undefined, ie: form.ieIsento ? 'ISENTO' : (form.ie || undefined), im: form.im || undefined, simplesNacional: form.simplesNacional, observacaoNF: form.observacaoNF || undefined, aceitaNFe55: true, dadosBancarios: dadosBancariosPayload.length > 0 ? dadosBancariosPayload : undefined }
  }

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
        await clienteHttp.put(`/transportadoras/${idEmEdicao}`, corpo)
        setMensagemDeSucesso('Transportadora atualizada!')
      } else {
        await clienteHttp.post('/transportadoras', corpo)
        setMensagemDeSucesso('Transportadora cadastrada!')
      }
      fecharModal()
      await carregarTransportadoras()
    } catch (erro) {
      const msg = extrairErro(erro, 'Erro ao salvar transportadora')
      if (/documento|cpf|cnpj|duplicad/i.test(msg)) {
        tocarCampo('documento')
        setAvisoDuplicidade({ tipo: 'transportadora_existente', mensagem: msg })
      } else { setErroSalvar(msg) }
    } finally { setSalvando(false) }
  }

  async function alternarStatus(t: Transportadora, opcoes?: { fecharModalApos?: boolean }) {
    setMensagemDeErro(''); setMensagemDeSucesso(''); setAlterandoStatus(t.id)
    try {
      await clienteHttp.patch(`/transportadoras/${t.id}/ativo`, { ativo: !t.ativo })
      setMensagemDeSucesso(t.ativo ? 'Transportadora desativada.' : 'Transportadora reativada.')
      await carregarTransportadoras()
      if (opcoes?.fecharModalApos) fecharModal()
    } catch (erro) { setMensagemDeErro(extrairErro(erro, 'Erro ao alterar status')) }
    finally { setAlterandoStatus(null) }
  }

  const transportadoraEmVisualizacao = listaTransportadoras.find((item) => item.id === idEmEdicao)

  const qualquerOperacaoAtiva = salvando || verificandoDocumento || carregandoBrasilApi

  useRegistrarAtalhos(
    {
      buscar: () => refBusca.current?.focus(),
      novo: abrirModalNovo,
      atualizar: carregarTransportadoras,
      salvar: () => submeterFormularioPorId('form-transportadora'),
      cancelar: solicitarFechar,
    },
    {
      buscar: !modalAberto,
      novo: podeCriar && !modalAberto,
      atualizar: !modalAberto && !carregandoLista,
      salvar: modalAberto && formularioValido && !qualquerOperacaoAtiva && !modoVisualizacao,
      cancelar: modalAberto && !qualquerOperacaoAtiva,
    }
  )

  const transportadorasFiltradas = listaTransportadoras.filter((t) => {
    const termo = busca.toLowerCase()
    return t.nome.toLowerCase().includes(termo) ||
      (t.cpf && t.cpf.includes(busca.replace(/\D/g, ''))) ||
      (t.cnpj && t.cnpj.includes(busca.replace(/\D/g, ''))) ||
      (t.email && t.email.toLowerCase().includes(termo)) ||
      (t.cidade && t.cidade.toLowerCase().includes(termo))
  })

  return (
    <div className="space-y-6">
      {mensagemDeErro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{mensagemDeErro}</p>
      )}
      {mensagemDeSucesso && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{mensagemDeSucesso}</p>
      )}

      {dialogoConfirmacao}

      <Modal
        aberto={modalAberto}
        aoFechar={solicitarFechar}
        titulo={
          modoVisualizacao
            ? `Visualizar transportadora: ${form.nome}`
            : modoEdicao
              ? `Editar transportadora: ${form.nome}`
              : 'Nova transportadora'
        }
        descricao={modoVisualizacao ? 'Consulta dos dados cadastrados (somente leitura)' : undefined}
        largura="2xl"
        rodape={
          modoVisualizacao ? (
            <RodapeModalVisualizacao
              aoFechar={fecharModal}
              aoAnterior={irParaAbaAnterior}
              aoProximo={aoAvancar}
              mostrarAnterior={!ehPrimeiraAba}
              mostrarProximo={!ehUltimaAba}
              aoEditar={alternarParaEdicao}
              podeEditar={podeEditar}
              aoAlternarStatus={() => {
                if (transportadoraEmVisualizacao) {
                  void alternarStatus(transportadoraEmVisualizacao, { fecharModalApos: true })
                }
              }}
              podeDesativar={podeDesativar}
              registroAtivo={transportadoraEmVisualizacao?.ativo ?? true}
              carregandoStatus={
                !!transportadoraEmVisualizacao &&
                alterandoStatus === transportadoraEmVisualizacao.id
              }
            />
          ) : (
          <div className="flex w-full flex-col gap-2">
            {errosDaAbaAtual.length > 0 && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ul className="space-y-0.5">
                  {errosDaAbaAtual.map((erro, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{erro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!etapaAtualLiberada && !ehUltimaAba && errosDaAbaAtual.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Preencha os campos obrigatórios desta etapa para continuar
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              {erroSalvar ? (
                <p className="text-sm text-destructive">{erroSalvar}</p>
              ) : (
                <span />
              )}
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
                <div className="flex gap-2">
                  <BotaoPrimario
                    form="form-transportadora"
                    type="submit"
                    disabled={salvando || !formularioValido}
                    title={tituloComAtalho(modoEdicao ? 'Salvar' : 'Cadastrar transportadora', teclaSalvar)}
                  >
                    {salvando ? (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Salvando...
                      </span>
                    ) : modoEdicao ? 'Salvar' : 'Cadastrar transportadora'}
                  </BotaoPrimario>
                  {!ehPrimeiraAba && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={irParaAbaAnterior}
                      disabled={salvando}
                    >
                      ← Anterior
                    </Button>
                  )}
                </div>
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
                  {!ehUltimaAba && (
                    <BotaoPrimario
                      type="button"
                      onClick={aoAvancar}
                      disabled={salvando || !etapaAtualLiberada}
                    >
                      Próximo →
                    </BotaoPrimario>
                  )}
                </div>
              </div>
            </div>
          </div>
          )
        }
      >
        {!modoVisualizacao && avisoDuplicidade && (
          <div className={`mb-4 rounded-md px-3 py-2 text-sm ${avisoDuplicidade.tipo === 'transportadora_existente' ? 'bg-destructive/10 text-destructive' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'}`}>
            {avisoDuplicidade.mensagem}
          </div>
        )}

        <Abas abas={abasComStatus} abaAtiva={abaAtiva} aoMudar={setAbaAtiva} className="mb-5" />

        <div className="relative">
          {salvando && <div className="absolute inset-0 z-10 rounded-md bg-background/60 backdrop-blur-[1px]" />}
          <form id="form-transportadora" onSubmit={aoSalvar}>
            <fieldset disabled={somenteLeitura} className="m-0 min-w-0 border-0 p-0">

            {abaAtiva === 'identificacao' && (
              <div className="space-y-5">
                <div className="flex gap-2">
                  <button type="button" disabled={qualquerOperacaoAtiva}
                    onClick={() => aoMudarTipo('PF')}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${form.tipo === 'PF' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'}`}>
                    Pessoa Física (CPF)
                  </button>
                  <button type="button" disabled={qualquerOperacaoAtiva}
                    onClick={() => aoMudarTipo('PJ')}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${form.tipo === 'PJ' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'}`}>
                    Pessoa Jurídica (CNPJ)
                  </button>
                </div>

                <Separator />

                {form.tipo === 'PJ' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium leading-none">CNPJ<span className="ml-0.5 text-destructive">*</span></label>
                      <div className="relative">
                        <input
                          className={cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50', erroDocumentoVisivel() && 'border-destructive')}
                          type="text" value={form.documento} onChange={(e) => aoMudarDocumento(e.target.value)} onBlur={aoSairDocumento}
                          placeholder="00.000.000/0000-00" maxLength={18} disabled={modoEdicao || somenteLeitura}
                        />
                        {(verificandoDocumento || carregandoBrasilApi) && (
                          <span className="absolute right-2 top-2 text-xs text-muted-foreground">
                            {carregandoBrasilApi ? 'Buscando na Receita...' : 'Verificando...'}
                          </span>
                        )}
                      </div>
                      {erroDocumentoVisivel() && <p className="text-sm text-destructive">{erroDocumentoVisivel()}</p>}
                      {modoEdicao && !erroDocumentoVisivel() && <p className="text-xs text-muted-foreground">CNPJ não pode ser alterado após o cadastro.</p>}
                    </div>
                    <div className="flex items-end pb-1">
                      <CampoCheckbox rotulo="Simples Nacional" valor={form.simplesNacional} aoMudar={(v) => set('simplesNacional', v)} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-sm font-medium leading-none">CPF<span className="ml-0.5 text-destructive">*</span></label>
                    <div className="relative">
                      <input
                        className={cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50', erroDocumentoVisivel() && 'border-destructive')}
                        type="text" value={form.documento} onChange={(e) => aoMudarDocumento(e.target.value)} onBlur={aoSairDocumento}
                        placeholder="000.000.000-00" maxLength={14} disabled={modoEdicao || somenteLeitura}
                      />
                      {verificandoDocumento && (
                        <span className="absolute right-2 top-2 text-xs text-muted-foreground">Verificando...</span>
                      )}
                    </div>
                    {erroDocumentoVisivel() && <p className="text-sm text-destructive">{erroDocumentoVisivel()}</p>}
                    {modoEdicao && !erroDocumentoVisivel() && <p className="text-xs text-muted-foreground">CPF não pode ser alterado após o cadastro.</p>}
                  </div>
                )}

                {form.tipo === 'PF' && (
                  <div className="space-y-4">
                    <CampoInput rotulo="Nome completo" valor={form.nome} aoMudar={(v) => { tocarCampo('nome'); set('nome', v) }} placeholder="Nome como no documento" obrigatorio mensagemDeErro={erroVisivel('nome')} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="RG" valor={form.rg} aoMudar={(v) => set('rg', v)} placeholder="Número do RG" maxLength={20} />
                      <CampoInput rotulo="Data de nascimento" valor={form.dataNascimento} aoMudar={(v) => set('dataNascimento', v)} tipo="date" />
                    </div>
                    <CampoCheckbox rotulo="Exige NF-e modelo 55" valor={form.aceitaNFe55} aoMudar={(v) => set('aceitaNFe55', v)} />
                  </div>
                )}

                {form.tipo === 'PJ' && (
                  <div className="space-y-4">
                    <CampoInput rotulo="Razão social" valor={form.nome} aoMudar={(v) => { tocarCampo('nome'); set('nome', v) }} placeholder="Razão social completa" obrigatorio mensagemDeErro={erroVisivel('nome')} />
                    <CampoInput rotulo="Nome fantasia" valor={form.nomeFantasia} aoMudar={(v) => set('nomeFantasia', v)} placeholder="Nome comercial (opcional)" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInscricaoEstadual
                        ie={form.ie}
                        ieIsento={form.ieIsento}
                        aoMudarIe={(v) => set('ie', v)}
                        aoMudarIsento={(v) => {
                          setForm((f) => ({
                            ...f,
                            ieIsento: v,
                            ie: v ? '' : f.ie,
                            indicadorIe: v ? '2' : (f.indicadorIe === '2' ? '9' : f.indicadorIe),
                          }))
                        }}
                      />
                      <CampoInput rotulo="IM" valor={form.im} aoMudar={(v) => set('im', v)} placeholder="Inscrição Municipal" maxLength={30} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="CNAE" valor={form.cnae} aoMudar={(v) => set('cnae', v)} placeholder="Código CNAE" maxLength={10} />
                      <CampoInput rotulo="Data de fundação" valor={form.dataFundacao} aoMudar={(v) => set('dataFundacao', v)} tipo="date" />
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <CampoInput rotulo="ANTT (RNTRC)" valor={form.antt} aoMudar={(v) => set('antt', v)} placeholder="Registro ANTT" maxLength={20} ajuda="Registro Nacional de Transportadores" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Observações</label>
                  <textarea
                    className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)}
                    placeholder="Informações adicionais sobre a transportadora..." maxLength={500} rows={2}
                  />
                </div>
              </div>
            )}

            {abaAtiva === 'contato' && (
              <div className="space-y-4">
                {form.contatos.length > 0 ? (
                  <ListaContatos contatos={form.contatos} aoMudar={(v) => { tocarCampo('contatos'); set('contatos', v) }} mensagemDeErro={erroVisivel('contatos')} disabled={somenteLeitura} />
                ) : (
                  <>
                    <InputPadrao rotulo="Email" type="email" value={form.email} onChange={(e) => { tocarCampo('email'); set('email', e.target.value) }} onBlur={() => tocarCampo('email')} placeholder="transportadora@email.com.br" mensagemDeErro={erroVisivel('email')} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="Telefone" valor={form.telefone} aoMudar={(v) => { tocarCampo('telefone'); set('telefone', mascaraTelefone(v)) }} onBlur={() => tocarCampo('telefone')} placeholder="(00) 0000-0000" maxLength={14} mensagemDeErro={erroVisivel('telefone')} />
                      <CampoInput rotulo="Celular" valor={form.celular} aoMudar={(v) => { tocarCampo('telefone'); set('celular', mascaraTelefone(v)) }} onBlur={() => tocarCampo('telefone')} placeholder="(00) 00000-0000" maxLength={15} />
                    </div>
                    <CampoCheckbox rotulo="Celular com WhatsApp" valor={form.celularWhatsapp} aoMudar={(v) => set('celularWhatsapp', v)} />
                  </>
                )}
                {!somenteLeitura && (
                  <button type="button"
                    onClick={() => {
                      if (form.contatos.length > 0) { set('contatos', []) }
                      else {
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
                )}
              </div>
            )}

            {abaAtiva === 'dados-bancarios' && (
              <ListaDadosBancarios
                dadosBancarios={form.dadosBancarios}
                aoMudar={(v) => set('dadosBancarios', v)}
                nomeCadastro={form.nome}
                documentoCadastro={form.documento}
                disabled={somenteLeitura}
              />
            )}

            {abaAtiva === 'endereco' && (
              <div className="space-y-4">
                {form.enderecos.length > 0 ? (
                  <ListaEnderecos enderecos={form.enderecos} aoMudar={(v) => { tocarCampo('enderecos'); set('enderecos', v) }} mensagemDeErro={erroVisivel('enderecos')} disabled={somenteLeitura} />
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <CampoInput rotulo="CEP" valor={form.cep} aoMudar={(v) => { tocarCampo('cep'); set('cep', mascaraCep(v)) }} onBlur={() => { tocarCampo('cep'); buscarCep(form.cep) }} placeholder="00000-000" maxLength={9} mensagemDeErro={erroVisivel('cep')} />
                      <div className="sm:col-span-2">
                        <CampoInput rotulo="Logradouro" valor={form.logradouro} aoMudar={(v) => { tocarCampo('logradouro'); set('logradouro', v) }} onBlur={() => tocarCampo('logradouro')} placeholder="Rua, Avenida..." mensagemDeErro={erroVisivel('logradouro')} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <CampoInput rotulo="Número" valor={form.numero} aoMudar={(v) => { tocarCampo('numero'); set('numero', v) }} onBlur={() => tocarCampo('numero')} placeholder="123 ou S/N" maxLength={20} mensagemDeErro={erroVisivel('numero')} />
                      <div className="sm:col-span-2">
                        <CampoInput rotulo="Complemento" valor={form.complemento} aoMudar={(v) => set('complemento', v)} placeholder="Sala, Apto..." maxLength={100} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoInput rotulo="Bairro" valor={form.bairro} aoMudar={(v) => { tocarCampo('bairro'); set('bairro', v) }} onBlur={() => tocarCampo('bairro')} placeholder="Bairro" maxLength={100} mensagemDeErro={erroVisivel('bairro')} />
                      <CampoInput rotulo="Cidade" valor={form.cidade} aoMudar={(v) => { tocarCampo('cidade'); set('cidade', v) }} onBlur={() => tocarCampo('cidade')} placeholder="Cidade" maxLength={100} mensagemDeErro={erroVisivel('cidade')} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CampoSelect rotulo="Estado (UF)" valor={form.estado} aoMudar={(v) => { tocarCampo('estado'); set('estado', v) }} opcoes={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))} mensagemDeErro={erroVisivel('estado')} />
                      <CampoInput rotulo="Código IBGE" valor={form.codigoIbge} aoMudar={(v) => { tocarCampo('codigoIbge'); set('codigoIbge', v.replace(/\D/g, '').slice(0, 7)) }} onBlur={() => tocarCampo('codigoIbge')} placeholder="0000000 (7 dígitos)" maxLength={7}
                        ajuda={erroVisivel('codigoIbge') ? undefined : 'Preenchido automaticamente pelo CEP'} mensagemDeErro={erroVisivel('codigoIbge')} />
                    </div>
                  </>
                )}
                {!somenteLeitura && (
                  <button type="button"
                    onClick={() => {
                      if (form.enderecos.length > 0) { set('enderecos', []) }
                      else { set('enderecos', [{ tipo: 'principal', apelido: '', cep: form.cep, logradouro: form.logradouro, numero: form.numero, complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado, codigoIbge: form.codigoIbge }]) }
                    }}
                    className="text-xs text-primary underline">
                    {form.enderecos.length > 0 ? '← Modo simples' : '+ Múltiplos endereços'}
                  </button>
                )}
              </div>
            )}
            </fieldset>
          </form>
        </div>
      </Modal>

      <CardPadrao
        titulo="Transportadoras"
        descricao="Lista de todas as transportadoras cadastradas"
        acoes={
          <div className="flex gap-2">
            {podeCriar && (
              <BotaoPrimario
                type="button"
                onClick={abrirModalNovo}
                title={tituloComAtalho('Nova transportadora', teclaNovo)}
              >
                + Nova transportadora
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
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Documento</th>
                <th className="px-4 py-3 text-left font-medium">ANTT</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Cidade</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {carregandoLista && Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))}

              {!carregandoLista && transportadorasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {listaTransportadoras.length === 0 ? 'Nenhuma transportadora cadastrada.' : 'Nenhuma transportadora encontrada.'}
                  </td>
                </tr>
              )}

              {!carregandoLista && transportadorasFiltradas.map((t) => {
                const documento = t.tipo === 'PF' ? (t.cpf ? mascaraCpf(t.cpf) : '—') : (t.cnpj ? mascaraCnpj(t.cnpj) : '—')
                return (
                  <LinhaTabelaClicavel
                    key={t.id}
                    aoClicar={() => abrirModalVisualizacao(t)}
                    ariaLabel={`Visualizar transportadora ${t.nome}`}
                    desabilitada={alterandoStatus === t.id}
                  >
                    <td className="px-4 py-3 font-medium">{t.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{documento}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.antt || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.cidade || '—'}</td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante={t.ativo ? 'ativo' : 'inativo'}>{t.ativo ? 'Ativo' : 'Inativo'}</BadgeStatus>
                    </td>
                  </LinhaTabelaClicavel>
                )
              })}
            </tbody>
          </table>
        </div>

        {!carregandoLista && transportadorasFiltradas.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {transportadorasFiltradas.length} de {listaTransportadoras.length} transportadora{listaTransportadoras.length === 1 ? '' : 's'}
          </p>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaDeTransportadoras() {
  return (
    <ProtegerRota chaveDaPagina="transportadoras">
      <ConteudoDaPaginaDeTransportadoras />
    </ProtegerRota>
  )
}
