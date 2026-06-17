'use client'

/**
 * Tela de clientes — CRUD completo PF/PJ com campo unificado CPF/CNPJ,
 * BrasilAPI, verificação de duplicidade, flags fiscais e validação de abas.
 */
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { usePermissao } from '@/hooks/use-permissao'
import { useValidacaoDeAbas, type ConfigDeAba } from '@/hooks/use-validacao-de-abas'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Modal } from '@/components/ui/modal'
import { Abas } from '@/components/ui/abas'
import { Separator } from '@/components/ui/separator'
import { exportarCsv } from '@/lib/exportar-csv'
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

type TipoCliente = 'PF' | 'PJ'

type Cliente = {
  id: string
  papelId: string
  tipo: TipoCliente
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
  suframa?: string | null
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
  aceitaNFe55?: boolean
  statusAprovacao?: string
}

type FormCliente = {
  tipo: TipoCliente
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
  suframa: string
  simplesNacional: boolean
  observacaoNF: string
  aceitaNFe55: boolean
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
  // Arrays dinâmicos (2B)
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

const FORM_VAZIO: FormCliente = {
  tipo: 'PF',
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
  suframa: '',
  simplesNacional: false,
  observacaoNF: '',
  aceitaNFe55: true,
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
  contatos: [],
  enderecos: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function documentoParaMascara(cliente: Cliente): string {
  if (cliente.tipo === 'PF' && cliente.cpf) return mascaraCpf(cliente.cpf)
  if (cliente.tipo === 'PJ' && cliente.cnpj) return mascaraCnpj(cliente.cnpj)
  return ''
}

function formatarDocumentoTabela(cliente: Cliente) {
  return documentoParaMascara(cliente) || '—'
}

function clienteParaForm(c: Cliente): FormCliente {
  return {
    tipo: c.tipo,
    documento: documentoParaMascara(c),
    nome: c.nome,
    rg: c.rg || '',
    dataNascimento: c.dataNascimento || '',
    nomeFantasia: c.nomeFantasia || '',
    cnae: c.cnae || '',
    dataFundacao: c.dataFundacao || '',
    ie: c.ie === 'ISENTO' ? '' : (c.ie || ''),
    ieIsento: c.ie === 'ISENTO',
    im: c.im || '',
    suframa: c.suframa || '',
    simplesNacional: c.simplesNacional ?? false,
    observacaoNF: c.observacaoNF || '',
    aceitaNFe55: c.aceitaNFe55 ?? true,
    email: c.email || '',
    telefone: c.telefone ? mascaraTelefone(c.telefone) : '',
    celular: c.celular ? mascaraTelefone(c.celular) : '',
    celularWhatsapp: c.celularWhatsapp ?? false,
    cep: c.cep ? mascaraCep(c.cep) : '',
    logradouro: c.logradouro || '',
    numero: c.numero || '',
    complemento: c.complemento || '',
    bairro: c.bairro || '',
    cidade: c.cidade || '',
    estado: c.estado || '',
    codigoIbge: c.codigoIbge || '',
    indicadorIe: c.indicadorIe || '9',
    observacoes: c.observacoes || '',
    // Arrays dinâmicos — montados a partir dos dados da API quando disponíveis
    contatos: Array.isArray((c as any).contatos)
      ? (c as any).contatos.map((ct: any) => ({
          tipo: ct.tipo,
          valor: ct.valor,
          descricao: ct.descricao || '',
          whatsapp: ct.whatsapp ?? false,
          principal: ct.principal ?? false,
        }))
      : [],
    enderecos: Array.isArray((c as any).enderecos)
      ? (c as any).enderecos.map((e: any) => ({
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

// ─── Validação e pendências ───────────────────────────────────────────────────

function gerarPendenciasDoForm(form: FormCliente): string[] {
  const erros: string[] = []

  // Identificação
  if (!form.nome.trim() || form.nome.trim().length < 2)
    erros.push('Identificação: nome obrigatório (mínimo 2 caracteres)')

  if (form.tipo === 'PF') {
    const nums = form.documento.replace(/\D/g, '')
    if (!validarCpf(nums)) erros.push('Identificação: CPF inválido — verifique os dígitos')
  } else {
    const nums = form.documento.replace(/\D/g, '')
    if (!validarCnpj(nums)) erros.push('Identificação: CNPJ inválido — verifique os dígitos')
  }

  // Contato — considera modo simples e modo array
  const temEmailSimples = form.email.trim().length > 0 && form.email.includes('@')
  const temTelefoneSimples =
    form.telefone.replace(/\D/g, '').length >= 10 ||
    form.celular.replace(/\D/g, '').length >= 10

  const temEmailArray = form.contatos.some(
    (c) => c.tipo === 'email' && c.valor.trim().length > 0 && c.valor.includes('@')
  )
  const temTelefoneArray = form.contatos.some(
    (c) => c.tipo === 'telefone' && c.valor.replace(/\D/g, '').length >= 10
  )

  const modoArray = form.contatos.length > 0

  if (modoArray) {
    if (!temEmailArray) erros.push('Contato: informe ao menos um e-mail válido')
    if (!temTelefoneArray) erros.push('Contato: informe ao menos um telefone ou celular')
  } else {
    if (!temEmailSimples) erros.push('Contato: e-mail obrigatório e deve ser válido')
    if (!temTelefoneSimples) erros.push('Contato: informe telefone fixo ou celular')
  }

  // Endereço — considera modo simples e modo array
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

  if (cep.replace(/\D/g, '').length < 8) erros.push('Endereço: CEP obrigatório (8 dígitos)')
  if (!logradouro.trim()) erros.push('Endereço: logradouro obrigatório')
  if (!numero.trim()) erros.push('Endereço: número obrigatório')
  if (!bairro.trim()) erros.push('Endereço: bairro obrigatório')
  if (!cidade.trim()) erros.push('Endereço: cidade obrigatória')
  if (!estado.trim()) erros.push('Endereço: estado (UF) obrigatório')

  return erros
}

function calcularStatusCadastro(cliente: Cliente): { completo: boolean; pendencias: string[] } {
  const erros: string[] = []

  if (!cliente.nome || cliente.nome.trim().length < 2)
    erros.push('Nome obrigatório')

  if (!cliente.email || !cliente.email.includes('@'))
    erros.push('E-mail obrigatório')

  if (!cliente.telefone && !cliente.celular)
    erros.push('Telefone ou celular obrigatório')

  if (!cliente.cep || cliente.cep.replace(/\D/g, '').length < 8)
    erros.push('CEP obrigatório')
  if (!cliente.logradouro) erros.push('Logradouro obrigatório')
  if (!cliente.numero) erros.push('Número obrigatório')
  if (!cliente.bairro) erros.push('Bairro obrigatório')
  if (!cliente.cidade) erros.push('Cidade obrigatória')
  if (!cliente.estado) erros.push('Estado obrigatório')

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
  rotulo,
  valor,
  aoMudar,
  tipo = 'text',
  placeholder,
  maxLength,
  obrigatorio,
  ajuda,
  onBlur,
  disabled,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  tipo?: string
  placeholder?: string
  maxLength?: number
  obrigatorio?: boolean
  ajuda?: string
  onBlur?: () => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium leading-none">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <input
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        required={obrigatorio}
        disabled={disabled}
      />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  )
}

function CampoSelect({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  obrigatorio,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  opcoes: { value: string; label: string }[]
  obrigatorio?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium leading-none">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        required={obrigatorio}
      >
        <option value="">Selecione</option>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function CampoCheckbox({
  rotulo,
  valor,
  aoMudar,
  ajuda,
}: {
  rotulo: string
  valor: boolean
  aoMudar: (v: boolean) => void
  ajuda?: string
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

function ConteudoDaPaginaDeClientes() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('clientes:create')
  const podeEditar = usePermissao('clientes:edit')
  const podeDesativar = usePermissao('clientes:delete')

  const [listaDeClientes, setListaDeClientes] = useState<Cliente[]>([])
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

  const [form, setForm] = useState<FormCliente>(FORM_VAZIO)
  const formRef = useRef(form)
  formRef.current = form

  // Estado da busca por documento
  const [verificandoDocumento, setVerificandoDocumento] = useState(false)
  const [avisoDuplicidade, setAvisoDuplicidade] = useState<{
    tipo: 'cliente_existente' | 'pessoa_sem_papel'
    clienteId?: string
    mensagem: string
  } | null>(null)
  const [carregandoBrasilApi, setCarregandoBrasilApi] = useState(false)

  // ─── Validação de abas ────────────────────────────────────────────────────

  const configAbas: ConfigDeAba[] = [
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
            (c) => c.tipo === 'email' && c.valor.trim().length > 0 && c.valor.includes('@')
          )
          const temTel = f.contatos.some(
            (c) => c.tipo === 'telefone' && c.valor.replace(/\D/g, '').length >= 10
          )
          return temEmail && temTel
        }
        const emailOk = f.email.trim().length > 0 && f.email.includes('@')
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
        let cep = f.cep
        let logradouro = f.logradouro
        let numero = f.numero
        let bairro = f.bairro
        let cidade = f.cidade
        let estado = f.estado
        if (f.enderecos.length > 0) {
          const p = f.enderecos.find((e) => e.tipo === 'principal')
          cep = p?.cep ?? ''
          logradouro = p?.logradouro ?? ''
          numero = p?.numero ?? ''
          bairro = p?.bairro ?? ''
          cidade = p?.cidade ?? ''
          estado = p?.estado ?? ''
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
  ]

  const {
    statusDasAbas,
    validarTodasAsAbas,
    irParaAbaComErro,
    resetarStatus,
  } = useValidacaoDeAbas(configAbas)

  const abasComStatus = [
    { id: 'identificacao', rotulo: 'Identificação', status: statusDasAbas['identificacao'] },
    { id: 'contato', rotulo: 'Contato', status: statusDasAbas['contato'] },
    { id: 'endereco', rotulo: 'Endereço', status: statusDasAbas['endereco'] },
  ]

  // ─── Dados ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarClientes()
  }, [carregandoSessao, estaAutenticado])

  async function carregarClientes() {
    setCarregandoLista(true)
    try {
      const { data } = await clienteHttp.get('/clientes')
      setListaDeClientes(data.clientes)
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao carregar clientes'))
    } finally {
      setCarregandoLista(false)
    }
  }

  function set<K extends keyof FormCliente>(campo: K, valor: FormCliente[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  function abrirModalNovo() {
    setForm({ ...FORM_VAZIO })
    setModoEdicao(false)
    setIdEmEdicao('')
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setAvisoDuplicidade(null)
    resetarStatus()
    setModalAberto(true)
  }

  function abrirModalEdicao(cliente: Cliente) {
    setForm(clienteParaForm(cliente))
    setModoEdicao(true)
    setIdEmEdicao(cliente.id)
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setAvisoDuplicidade(null)
    resetarStatus()
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setMensagemDeErro('')
    setAvisoDuplicidade(null)
    resetarStatus()
  }

  // ─── Campo documento unificado ────────────────────────────────────────────

  function aoMudarDocumento(valor: string) {
    const comMascara = mascaraDocumento(valor)
    const nums = comMascara.replace(/\D/g, '')
    const tipo = nums.length > 11 ? 'PJ' : 'PF'
    setForm((f) => ({
      ...f,
      documento: comMascara,
      tipo,
      // Ao trocar tipo, limpar campos do tipo anterior
      ...(tipo !== f.tipo
        ? {
            rg: '',
            dataNascimento: '',
            nomeFantasia: '',
            cnae: '',
            dataFundacao: '',
            ie: '',
            im: '',
            suframa: '',
            simplesNacional: false,
            observacaoNF: '',
          }
        : {}),
    }))
    setAvisoDuplicidade(null)
  }

  async function aoSairDocumento() {
    if (modoEdicao) return
    const nums = form.documento.replace(/\D/g, '')
    const tipoDetectado = detectarTipoDocumento(form.documento)
    if (!tipoDetectado) return
    const valido = tipoDetectado === 'CPF' ? validarCpf(nums) : validarCnpj(nums)
    if (!valido) return

    // Se PJ, buscar na BrasilAPI
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

    // Verificar duplicidade
    setVerificandoDocumento(true)
    try {
      const { data } = await clienteHttp.get(`/clientes/por-documento/${nums}`)
      if (data.encontrado) {
        if (data.temPapelCliente) {
          setAvisoDuplicidade({
            tipo: 'cliente_existente',
            clienteId: data.pessoa?.id,
            mensagem: `Documento já cadastrado como cliente: ${data.pessoa?.nome}`,
          })
        } else {
          // Pessoa existe mas sem papel cliente — importar dados
          setAvisoDuplicidade({
            tipo: 'pessoa_sem_papel',
            mensagem: `Pessoa encontrada no sistema (${data.papeis.join(', ')}): ${data.pessoa?.nome}. Os dados foram pré-preenchidos.`,
          })
          if (data.pessoa) {
            const importado = clienteParaForm({ ...data.pessoa, tipo: form.tipo } as Cliente)
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
      // Ignora erros de duplicidade — não bloquear o usuário
    } finally {
      setVerificandoDocumento(false)
    }
  }

  // ─── CEP ──────────────────────────────────────────────────────────────────

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
      // ignora erro de CEP
    }
  }

  // ─── Montar corpo da requisição ───────────────────────────────────────────

  function montarCorpo() {
    const nums = form.documento.replace(/\D/g, '')
    const base = {
      tipo: form.tipo,
      nome: form.nome,
      aceitaNFe55: form.aceitaNFe55,
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
    }

    // Se há contatos/endereços dinâmicos, enviá-los; senão, campos achatados como fallback
    const contatosPayload =
      form.contatos.length > 0
        ? { contatos: form.contatos.filter((c) => c.valor.trim()) }
        : {
            email: form.email || undefined,
            telefone: form.telefone || undefined,
            celular: form.celular || undefined,
            celularWhatsapp: form.celularWhatsapp,
          }

    const enderecosPayload =
      form.enderecos.length > 0
        ? {
            enderecos: form.enderecos.map((e) => ({
              ...e,
              cep: e.cep.replace(/\D/g, '') || undefined,
            })),
          }
        : {
            cep: form.cep || undefined,
            logradouro: form.logradouro || undefined,
            numero: form.numero || undefined,
            complemento: form.complemento || undefined,
            bairro: form.bairro || undefined,
            cidade: form.cidade || undefined,
            estado: form.estado || undefined,
            codigoIbge: form.codigoIbge || undefined,
          }

    if (form.tipo === 'PF') {
      return {
        ...base,
        ...contatosPayload,
        ...enderecosPayload,
        cpf: nums,
        rg: form.rg || undefined,
        dataNascimento: form.dataNascimento || undefined,
      }
    }

    return {
      ...base,
      ...contatosPayload,
      ...enderecosPayload,
      cnpj: nums,
      nomeFantasia: form.nomeFantasia || undefined,
      cnae: form.cnae || undefined,
      dataFundacao: form.dataFundacao || undefined,
      ie: form.ieIsento ? 'ISENTO' : (form.ie || undefined),
      im: form.im || undefined,
      suframa: form.suframa || undefined,
      simplesNacional: form.simplesNacional,
      observacaoNF: form.observacaoNF || undefined,
    }
  }

  // ─── Salvar ───────────────────────────────────────────────────────────────

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')

    const pendencias = gerarPendenciasDoForm(form)
    const todasValidas = validarTodasAsAbas()
    if (!todasValidas || pendencias.length > 0) {
      const abaComErro = irParaAbaComErro()
      if (abaComErro) setAbaAtiva(abaComErro)
      setMensagemDeErro(
        'Corrija os campos obrigatórios:\n• ' + pendencias.join('\n• ')
      )
      return
    }

    setSalvando(true)
    try {
      const corpo = montarCorpo()
      if (modoEdicao) {
        await clienteHttp.put(`/clientes/${idEmEdicao}`, corpo)
        setMensagemDeSucesso('Cliente atualizado!')
      } else {
        await clienteHttp.post('/clientes', corpo)
        setMensagemDeSucesso('Cliente cadastrado!')
      }
      fecharModal()
      await carregarClientes()
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao salvar cliente'))
    } finally {
      setSalvando(false)
    }
  }

  async function alternarStatus(cliente: Cliente) {
    setMensagemDeErro('')
    setMensagemDeSucesso('')
    setAlterandoStatus(cliente.id)
    try {
      await clienteHttp.patch(`/clientes/${cliente.id}/ativo`, {
        ativo: !cliente.ativo,
      })
      setMensagemDeSucesso(cliente.ativo ? 'Cliente desativado.' : 'Cliente reativado.')
      await carregarClientes()
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao alterar status'))
    } finally {
      setAlterandoStatus(null)
    }
  }

  // Banner de pendências no modal — recalculado a cada mudança no form
  const pendenciasDoForm = useMemo(
    () => (modalAberto ? gerarPendenciasDoForm(form) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, modalAberto]
  )

  // Bloqueia qualquer interação durante operações assíncronas
  const qualquerOperacaoAtiva = salvando || verificandoDocumento || carregandoBrasilApi

  const clientesFiltrados = listaDeClientes.filter((c) => {
    const termo = busca.toLowerCase()
    return (
      c.nome.toLowerCase().includes(termo) ||
      (c.cpf && c.cpf.includes(busca.replace(/\D/g, ''))) ||
      (c.cnpj && c.cnpj.includes(busca.replace(/\D/g, ''))) ||
      (c.email && c.email.toLowerCase().includes(termo)) ||
      (c.cidade && c.cidade.toLowerCase().includes(termo))
    )
  })

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {mensagemDeErro && !modalAberto && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensagemDeErro}
        </p>
      )}
      {mensagemDeSucesso && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {mensagemDeSucesso}
        </p>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo={modoEdicao ? `Editar: ${form.nome || 'cliente'}` : 'Novo cliente'}
        descricao={
          modoEdicao
            ? 'Edite os dados e clique em Salvar'
            : 'Preencha os dados para cadastrar um cliente'
        }
        largura="2xl"
        rodape={
          <div className="flex items-center justify-between">
            <div className="hidden gap-1 sm:flex">
              {abasComStatus.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAbaAtiva(a.id)}
                  disabled={qualquerOperacaoAtiva}
                  className={`rounded px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                    abaAtiva === a.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {i + 1}. {a.rotulo}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={fecharModal}
                disabled={qualquerOperacaoAtiva}
              >
                Cancelar
              </Button>
              <BotaoPrimario
                form="form-cliente"
                type="submit"
                disabled={qualquerOperacaoAtiva}
              >
                {salvando ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                    </svg>
                    Salvando...
                  </span>
                ) : (
                  modoEdicao ? 'Salvar' : 'Cadastrar cliente'
                )}
              </BotaoPrimario>
            </div>
          </div>
        }
      >
        {mensagemDeErro && modalAberto && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mensagemDeErro.includes('\n') ? (
              <ul className="list-none space-y-0.5">
                {mensagemDeErro.split('\n').map((linha, i) => (
                  <li key={i}>{linha}</li>
                ))}
              </ul>
            ) : (
              <p>{mensagemDeErro}</p>
            )}
          </div>
        )}

        {/* Banner de pendências — só no modo edição, desaparece ao preencher */}
        {modoEdicao && pendenciasDoForm.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            <p className="mb-1.5 font-medium">
              ⚠ Cadastro incompleto — este cliente não pode ser usado em vendas ou NF-e:
            </p>
            <ul className="space-y-0.5 text-xs">
              {pendenciasDoForm.map((p, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {avisoDuplicidade && (
          <div
            className={`mb-4 flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm ${
              avisoDuplicidade.tipo === 'cliente_existente'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}
          >
            <span>{avisoDuplicidade.mensagem}</span>
            {avisoDuplicidade.tipo === 'cliente_existente' && avisoDuplicidade.clienteId && (
              <button
                type="button"
                className="shrink-0 text-xs underline"
                onClick={() => {
                  const c = listaDeClientes.find((x) => x.id === avisoDuplicidade.clienteId)
                  if (c) {
                    fecharModal()
                    setTimeout(() => abrirModalEdicao(c), 50)
                  }
                }}
              >
                Editar cliente
              </button>
            )}
          </div>
        )}

        <Abas abas={abasComStatus} abaAtiva={abaAtiva} aoMudar={setAbaAtiva} className="mb-5" />

        <form id="form-cliente" onSubmit={aoSalvar}>
          {/* ── Aba 1: Identificação ──────────────────────────────────────── */}
          {abaAtiva === 'identificacao' && (
            <div className="space-y-5">
              {/* Toggle PF/PJ (manual override) */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={qualquerOperacaoAtiva}
                  onClick={() => {
                    setForm((f) => ({ ...f, tipo: 'PF', documento: '' }))
                    setAvisoDuplicidade(null)
                  }}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    form.tipo === 'PF'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Pessoa Física (CPF)
                </button>
                <button
                  type="button"
                  disabled={qualquerOperacaoAtiva}
                  onClick={() => {
                    setForm((f) => ({ ...f, tipo: 'PJ', documento: '' }))
                    setAvisoDuplicidade(null)
                  }}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    form.tipo === 'PJ'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Pessoa Jurídica (CNPJ)
                </button>
              </div>

              <Separator />

              {/* Campo documento unificado */}
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">
                  {form.tipo === 'PF' ? 'CPF' : 'CNPJ'}
                  <span className="ml-0.5 text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                    type="text"
                    value={form.documento}
                    onChange={(e) => aoMudarDocumento(e.target.value)}
                    onBlur={aoSairDocumento}
                    placeholder={form.tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                    maxLength={form.tipo === 'PF' ? 14 : 18}
                    disabled={modoEdicao}
                  />
                  {(verificandoDocumento || carregandoBrasilApi) && (
                    <span className="absolute right-2 top-2 text-xs text-muted-foreground">
                      {carregandoBrasilApi ? 'Buscando na Receita...' : 'Verificando...'}
                    </span>
                  )}
                </div>
                {modoEdicao && (
                  <p className="text-xs text-muted-foreground">
                    CPF/CNPJ não pode ser alterado após o cadastro.
                  </p>
                )}
              </div>

              {/* Pessoa Física */}
              {form.tipo === 'PF' && (
                <div className="space-y-4">
                  <CampoInput
                    rotulo="Nome completo"
                    valor={form.nome}
                    aoMudar={(v) => set('nome', v)}
                    placeholder="Nome como no documento"
                    obrigatorio
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="RG"
                      valor={form.rg}
                      aoMudar={(v) => set('rg', v)}
                      placeholder="Número do RG"
                      maxLength={20}
                    />
                    <CampoInput
                      rotulo="Data de nascimento"
                      valor={form.dataNascimento}
                      aoMudar={(v) => set('dataNascimento', v)}
                      tipo="date"
                    />
                  </div>
                  <CampoSelect
                    rotulo="Indicador IE (NF-e)"
                    valor={form.indicadorIe}
                    aoMudar={(v) => set('indicadorIe', v)}
                    opcoes={INDICADORES_IE}
                    obrigatorio
                  />
                  <CampoCheckbox
                    rotulo="Aceita NF-e modelo 55"
                    valor={form.aceitaNFe55}
                    aoMudar={(v) => set('aceitaNFe55', v)}
                    ajuda="Emissão de nota fiscal eletrônica para este cliente"
                  />
                </div>
              )}

              {/* Pessoa Jurídica */}
              {form.tipo === 'PJ' && (
                <div className="space-y-4">
                  <CampoInput
                    rotulo="Razão social"
                    valor={form.nome}
                    aoMudar={(v) => set('nome', v)}
                    placeholder="Razão social completa"
                    obrigatorio
                  />
                  <CampoInput
                    rotulo="Nome fantasia"
                    valor={form.nomeFantasia}
                    aoMudar={(v) => set('nomeFantasia', v)}
                    placeholder="Nome comercial (opcional)"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <CampoInput
                        rotulo="Inscrição Estadual (IE)"
                        valor={form.ieIsento ? 'ISENTO' : form.ie}
                        aoMudar={(v) => set('ie', v)}
                        placeholder="Número da IE"
                        maxLength={30}
                        disabled={form.ieIsento}
                      />
                      <CampoCheckbox
                        rotulo="Isento (não contribuinte ICMS)"
                        valor={form.ieIsento}
                        aoMudar={(v) => {
                          setForm((f) => ({
                            ...f,
                            ieIsento: v,
                            ie: v ? 'ISENTO' : '',
                          }))
                        }}
                      />
                    </div>
                    <CampoInput
                      rotulo="Inscrição Municipal (IM)"
                      valor={form.im}
                      aoMudar={(v) => set('im', v)}
                      placeholder="Para prestadores de serviço"
                      maxLength={30}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="SUFRAMA"
                      valor={form.suframa}
                      aoMudar={(v) => set('suframa', v)}
                      placeholder="Zona Franca de Manaus"
                      maxLength={9}
                      ajuda="Apenas para clientes na Zona Franca"
                    />
                    <CampoSelect
                      rotulo="Indicador IE (NF-e)"
                      valor={form.indicadorIe}
                      aoMudar={(v) => set('indicadorIe', v)}
                      opcoes={INDICADORES_IE}
                      obrigatorio
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="CNAE"
                      valor={form.cnae}
                      aoMudar={(v) => set('cnae', v)}
                      placeholder="Código CNAE (ex: 4711301)"
                      maxLength={10}
                      ajuda="Atividade econômica principal"
                    />
                    <CampoInput
                      rotulo="Data de fundação"
                      valor={form.dataFundacao}
                      aoMudar={(v) => set('dataFundacao', v)}
                      tipo="date"
                    />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <CampoCheckbox
                      rotulo="Simples Nacional"
                      valor={form.simplesNacional}
                      aoMudar={(v) => set('simplesNacional', v)}
                    />
                    <CampoCheckbox
                      rotulo="Aceita NF-e modelo 55"
                      valor={form.aceitaNFe55}
                      aoMudar={(v) => set('aceitaNFe55', v)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium leading-none">
                      Observação na NF
                    </label>
                    <textarea
                      className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={form.observacaoNF}
                      onChange={(e) => set('observacaoNF', e.target.value)}
                      placeholder="Texto que aparece na nota fiscal deste cliente..."
                      maxLength={500}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Aba 2: Contato ────────────────────────────────────────────── */}
          {abaAtiva === 'contato' && (
            <div className="space-y-4">
              {form.contatos.length > 0 ? (
                <ListaContatos
                  contatos={form.contatos}
                  aoMudar={(v) => set('contatos', v)}
                />
              ) : (
                <>
                  <InputPadrao
                    rotulo="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="cliente@email.com.br"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="Telefone fixo"
                      valor={form.telefone}
                      aoMudar={(v) => set('telefone', mascaraTelefone(v))}
                      placeholder="(00) 0000-0000"
                      maxLength={14}
                    />
                    <div className="space-y-2">
                      <CampoInput
                        rotulo="Celular"
                        valor={form.celular}
                        aoMudar={(v) => set('celular', mascaraTelefone(v))}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                      <CampoCheckbox
                        rotulo="Este celular é WhatsApp"
                        valor={form.celularWhatsapp}
                        aoMudar={(v) => set('celularWhatsapp', v)}
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  if (form.contatos.length > 0) {
                    set('contatos', [])
                  } else {
                    // Migrar campos simples para array
                    const inicial: ContatoForm[] = []
                    if (form.email) inicial.push({ tipo: 'email', valor: form.email, descricao: '', whatsapp: false, principal: true })
                    if (form.telefone) inicial.push({ tipo: 'telefone', valor: form.telefone, descricao: '', whatsapp: false, principal: true })
                    if (form.celular) inicial.push({ tipo: 'telefone', valor: form.celular, descricao: '', whatsapp: form.celularWhatsapp, principal: false })
                    set('contatos', inicial.length > 0 ? inicial : [{ tipo: 'email', valor: '', descricao: '', whatsapp: false, principal: true }])
                  }
                }}
                className="text-xs text-primary underline"
              >
                {form.contatos.length > 0 ? '← Modo simples' : '+ Múltiplos contatos'}
              </button>

              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Observações</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.observacoes}
                  onChange={(e) => set('observacoes', e.target.value)}
                  placeholder="Informações adicionais sobre o cliente..."
                  maxLength={500}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* ── Aba 3: Endereço ───────────────────────────────────────────── */}
          {abaAtiva === 'endereco' && (
            <div className="space-y-4">
              {form.enderecos.length > 0 ? (
                <ListaEnderecos
                  enderecos={form.enderecos}
                  aoMudar={(v) => set('enderecos', v)}
                />
              ) : (
                <>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      O endereço completo é <strong>obrigatório para emissão de NF-e</strong>.
                      Digite o CEP para preencher automaticamente.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <CampoInput
                      rotulo="CEP"
                      valor={form.cep}
                      aoMudar={(v) => set('cep', mascaraCep(v))}
                      onBlur={() => buscarCep(form.cep)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    <div className="sm:col-span-2">
                      <CampoInput
                        rotulo="Logradouro"
                        valor={form.logradouro}
                        aoMudar={(v) => set('logradouro', v)}
                        placeholder="Rua, Avenida, Travessa..."
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <CampoInput
                      rotulo="Número"
                      valor={form.numero}
                      aoMudar={(v) => set('numero', v)}
                      placeholder="123 ou S/N"
                      maxLength={20}
                    />
                    <div className="sm:col-span-2">
                      <CampoInput
                        rotulo="Complemento"
                        valor={form.complemento}
                        aoMudar={(v) => set('complemento', v)}
                        placeholder="Sala, Apto, Bloco..."
                        maxLength={100}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="Bairro"
                      valor={form.bairro}
                      aoMudar={(v) => set('bairro', v)}
                      placeholder="Bairro"
                      maxLength={100}
                    />
                    <CampoInput
                      rotulo="Cidade"
                      valor={form.cidade}
                      aoMudar={(v) => set('cidade', v)}
                      placeholder="Cidade"
                      maxLength={100}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoSelect
                      rotulo="Estado (UF)"
                      valor={form.estado}
                      aoMudar={(v) => set('estado', v)}
                      opcoes={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
                    />
                    <CampoInput
                      rotulo="Código IBGE do município"
                      valor={form.codigoIbge}
                      aoMudar={(v) => set('codigoIbge', v.replace(/\D/g, '').slice(0, 7))}
                      placeholder="0000000 (7 dígitos)"
                      maxLength={7}
                      ajuda="Preenchido automaticamente pelo CEP"
                    />
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  if (form.enderecos.length > 0) {
                    set('enderecos', [])
                  } else {
                    // Migrar campos simples para array
                    const principal: EnderecoForm = {
                      tipo: 'principal',
                      apelido: '',
                      cep: form.cep,
                      logradouro: form.logradouro,
                      numero: form.numero,
                      complemento: form.complemento,
                      bairro: form.bairro,
                      cidade: form.cidade,
                      estado: form.estado,
                      codigoIbge: form.codigoIbge,
                    }
                    set('enderecos', [principal])
                  }
                }}
                className="text-xs text-primary underline"
              >
                {form.enderecos.length > 0 ? '← Modo simples' : '+ Múltiplos endereços'}
              </button>
            </div>
          )}
        </form>
      </Modal>

      {/* ── Tabela ─────────────────────────────────────────────────────────── */}
      <CardPadrao
        titulo="Clientes"
        descricao="Cadastro de clientes pessoa física e jurídica"
        acoes={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportarCsv(
                  listaDeClientes.map((c) => ({
                    Tipo: c.tipo,
                    Nome: c.nome,
                    'CPF/CNPJ': formatarDocumentoTabela(c),
                    Email: c.email || '',
                    Telefone: c.telefone ? mascaraTelefone(c.telefone) : '',
                    Cidade: c.cidade || '',
                    UF: c.estado || '',
                    Status: c.ativo ? 'Ativo' : 'Inativo',
                  })),
                  'clientes'
                )
              }
            >
              Exportar CSV
            </Button>
            {podeCriar && (
              <BotaoPrimario type="button" onClick={abrirModalNovo}>
                + Novo cliente
              </BotaoPrimario>
            )}
          </div>
        }
      >
        <div className="mb-3">
          <input
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Buscar por nome, CPF/CNPJ, email, cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Nome / Razão Social</th>
                <th className="px-4 py-3 text-left font-medium">CPF / CNPJ</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Cidade / UF</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Cadastro</th>
                {(podeEditar || podeDesativar) && (
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {carregandoLista && (
                <>
                  {[1, 2, 3].map((i) => (
                    <tr key={i} className="border-b border-border">
                      {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}
              {!carregandoLista && clientesFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {busca
                      ? 'Nenhum cliente encontrado para essa busca.'
                      : 'Nenhum cliente cadastrado ainda.'}
                  </td>
                </tr>
              )}
              {!carregandoLista && clientesFiltrados.map((cliente) => {
                const statusCadastro = calcularStatusCadastro(cliente)
                const estaAlterandoEsseLine = alterandoStatus === cliente.id
                return (
                  <tr
                    key={cliente.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          cliente.tipo === 'PF'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        {cliente.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{cliente.nome}</div>
                      {cliente.nomeFantasia && (
                        <div className="text-xs text-muted-foreground">{cliente.nomeFantasia}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatarDocumentoTabela(cliente)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{cliente.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cliente.cidade && cliente.estado
                        ? `${cliente.cidade} / ${cliente.estado}`
                        : cliente.cidade || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatus variante={cliente.ativo ? 'ativo' : 'inativo'}>
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </BadgeStatus>
                    </td>
                    <td className="px-4 py-3">
                      {statusCadastro.completo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Completo
                        </span>
                      ) : (
                        <span
                          title={`Pendências:\n${statusCadastro.pendencias.join('\n')}`}
                          className="inline-flex cursor-help items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M5 3v2.5M5 7h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Incompleto
                        </span>
                      )}
                    </td>
                    {(podeEditar || podeDesativar) && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {podeEditar && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={estaAlterandoEsseLine}
                              onClick={() => abrirModalEdicao(cliente)}
                            >
                              Editar
                            </Button>
                          )}
                          {podeDesativar && (
                            <Button
                              type="button"
                              variant={cliente.ativo ? 'destructive' : 'outline'}
                              size="sm"
                              disabled={estaAlterandoEsseLine}
                              onClick={() => alternarStatus(cliente)}
                            >
                              {estaAlterandoEsseLine ? (
                                <span className="flex items-center gap-1.5">
                                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                                  </svg>
                                  {cliente.ativo ? 'Desativando...' : 'Reativando...'}
                                </span>
                              ) : (
                                cliente.ativo ? 'Desativar' : 'Reativar'
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {listaDeClientes.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {clientesFiltrados.length} de {listaDeClientes.length} clientes
          </p>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaDeClientes() {
  return (
    <ProtegerRota chaveDaPagina="clientes">
      <ConteudoDaPaginaDeClientes />
    </ProtegerRota>
  )
}
