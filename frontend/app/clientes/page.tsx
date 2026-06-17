'use client'

/**
 * Tela de clientes — CRUD completo de Pessoa Física e Jurídica
 * com todos os campos para emissão de NF-e.
 */
import { FormEvent, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { usePermissao } from '@/hooks/use-permissao'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Modal } from '@/components/ui/modal'
import { Abas } from '@/components/ui/abas'
import { Separator } from '@/components/ui/separator'
import { exportarCsv } from '@/lib/exportar-csv'

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
  nome: string
  cpf: string
  rg: string
  dataNascimento: string
  cnpj: string
  nomeFantasia: string
  ie: string
  im: string
  suframa: string
  email: string
  telefone: string
  celular: string
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

const ABAS = [
  { id: 'identificacao', rotulo: 'Identificação' },
  { id: 'contato', rotulo: 'Contato' },
  { id: 'endereco', rotulo: 'Endereço' },
]

const FORM_VAZIO: FormCliente = {
  tipo: 'PF',
  nome: '',
  cpf: '',
  rg: '',
  dataNascimento: '',
  cnpj: '',
  nomeFantasia: '',
  ie: '',
  im: '',
  suframa: '',
  email: '',
  telefone: '',
  celular: '',
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
}

// ─── Máscaras ─────────────────────────────────────────────────────────────────

function mascaraCpf(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function mascaraCnpj(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function mascaraTelefone(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  if (n.length <= 10)
    return n.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return n.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

function mascaraCep(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

function formatarDocumento(cliente: Cliente) {
  if (cliente.tipo === 'PF' && cliente.cpf)
    return mascaraCpf(cliente.cpf)
  if (cliente.tipo === 'PJ' && cliente.cnpj)
    return mascaraCnpj(cliente.cnpj)
  return '—'
}

function clienteParaForm(c: Cliente): FormCliente {
  return {
    tipo: c.tipo,
    nome: c.nome,
    cpf: c.cpf ? mascaraCpf(c.cpf) : '',
    rg: c.rg || '',
    dataNascimento: c.dataNascimento || '',
    cnpj: c.cnpj ? mascaraCnpj(c.cnpj) : '',
    nomeFantasia: c.nomeFantasia || '',
    ie: c.ie || '',
    im: c.im || '',
    suframa: c.suframa || '',
    email: c.email || '',
    telefone: c.telefone ? mascaraTelefone(c.telefone) : '',
    celular: c.celular ? mascaraTelefone(c.celular) : '',
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
  }
}

function extrairErro(erro: unknown, padrao: string): string {
  const e = erro as {
    response?: { data?: { mensagem?: string; message?: string } }
    message?: string
    code?: string
  }
  if (!e.response) {
    if (e.code === 'ERR_NETWORK')
      return 'Não foi possível conectar à API.'
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

  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('identificacao')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState<FormCliente>(FORM_VAZIO)

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarClientes()
  }, [carregandoSessao, estaAutenticado])

  async function carregarClientes() {
    try {
      const { data } = await clienteHttp.get('/clientes')
      setListaDeClientes(data.clientes)
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao carregar clientes'))
    }
  }

  function set<K extends keyof FormCliente>(campo: K, valor: FormCliente[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function abrirModalNovo() {
    setForm({ ...FORM_VAZIO })
    setModoEdicao(false)
    setIdEmEdicao('')
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setModalAberto(true)
  }

  function abrirModalEdicao(cliente: Cliente) {
    setForm(clienteParaForm(cliente))
    setModoEdicao(true)
    setIdEmEdicao(cliente.id)
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setMensagemDeErro('')
  }

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

  function montarCorpo() {
    const base = {
      tipo: form.tipo,
      nome: form.nome,
      email: form.email || undefined,
      telefone: form.telefone || undefined,
      celular: form.celular || undefined,
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

    if (form.tipo === 'PF') {
      return {
        ...base,
        cpf: form.cpf,
        rg: form.rg || undefined,
        dataNascimento: form.dataNascimento || undefined,
      }
    }

    return {
      ...base,
      cnpj: form.cnpj,
      nomeFantasia: form.nomeFantasia || undefined,
      ie: form.ie || undefined,
      im: form.im || undefined,
      suframa: form.suframa || undefined,
    }
  }

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')
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
    try {
      await clienteHttp.patch(`/clientes/${cliente.id}/ativo`, {
        ativo: !cliente.ativo,
      })
      setMensagemDeSucesso(cliente.ativo ? 'Cliente desativado.' : 'Cliente reativado.')
      await carregarClientes()
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao alterar status'))
    }
  }

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

      {/* ── Modal de criar / editar ────────────────────────────────────────── */}
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
            {/* Indicação de abas */}
            <div className="hidden gap-1 sm:flex">
              {ABAS.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAbaAtiva(a.id)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
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
              <Button type="button" variant="outline" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </Button>
              <BotaoPrimario form="form-cliente" type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Cadastrar cliente'}
              </BotaoPrimario>
            </div>
          </div>
        }
      >
        {mensagemDeErro && modalAberto && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mensagemDeErro}
          </p>
        )}

        <Abas abas={ABAS} abaAtiva={abaAtiva} aoMudar={setAbaAtiva} className="mb-5" />

        <form id="form-cliente" onSubmit={aoSalvar}>
          {/* ── Aba 1: Identificação ──────────────────────────────────────── */}
          {abaAtiva === 'identificacao' && (
            <div className="space-y-5">
              {/* Toggle PF/PJ */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set('tipo', 'PF')}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                    form.tipo === 'PF'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Pessoa Física (CPF)
                </button>
                <button
                  type="button"
                  onClick={() => set('tipo', 'PJ')}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                    form.tipo === 'PJ'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Pessoa Jurídica (CNPJ)
                </button>
              </div>

              <Separator />

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
                      rotulo="CPF"
                      valor={form.cpf}
                      aoMudar={(v) => set('cpf', mascaraCpf(v))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      obrigatorio
                    />
                    <CampoInput
                      rotulo="RG"
                      valor={form.rg}
                      aoMudar={(v) => set('rg', v)}
                      placeholder="Número do RG"
                      maxLength={20}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="Data de nascimento"
                      valor={form.dataNascimento}
                      aoMudar={(v) => set('dataNascimento', v)}
                      tipo="date"
                    />
                    <CampoSelect
                      rotulo="Indicador IE (NF-e)"
                      valor={form.indicadorIe}
                      aoMudar={(v) => set('indicadorIe', v)}
                      opcoes={INDICADORES_IE}
                      obrigatorio
                    />
                  </div>
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="CNPJ"
                      valor={form.cnpj}
                      aoMudar={(v) => set('cnpj', mascaraCnpj(v))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      obrigatorio
                    />
                    <CampoInput
                      rotulo="Nome fantasia"
                      valor={form.nomeFantasia}
                      aoMudar={(v) => set('nomeFantasia', v)}
                      placeholder="Nome comercial (opcional)"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoInput
                      rotulo="Inscrição Estadual (IE)"
                      valor={form.ie}
                      aoMudar={(v) => set('ie', v)}
                      placeholder='Número ou "ISENTO"'
                      maxLength={30}
                      ajuda='Deixe "ISENTO" se não for contribuinte ICMS'
                    />
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
                </div>
              )}
            </div>
          )}

          {/* ── Aba 2: Contato ────────────────────────────────────────────── */}
          {abaAtiva === 'contato' && (
            <div className="space-y-4">
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
                <CampoInput
                  rotulo="Celular / WhatsApp"
                  valor={form.celular}
                  aoMudar={(v) => set('celular', mascaraTelefone(v))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">
                  Observações
                </label>
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
            </div>
          )}
        </form>
      </Modal>

      {/* ── Tabela de clientes ─────────────────────────────────────────────── */}
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
                    'CPF/CNPJ': formatarDocumento(c),
                    Email: c.email || '',
                    Telefone: c.telefone
                      ? mascaraTelefone(c.telefone)
                      : '',
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
        {/* Barra de busca */}
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
                {(podeEditar || podeDesativar) && (
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {busca
                      ? 'Nenhum cliente encontrado para essa busca.'
                      : 'Nenhum cliente cadastrado ainda.'}
                  </td>
                </tr>
              )}
              {clientesFiltrados.map((cliente) => (
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
                      <div className="text-xs text-muted-foreground">
                        {cliente.nomeFantasia}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {formatarDocumento(cliente)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cliente.email || '—'}
                  </td>
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
                  {(podeEditar || podeDesativar) && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {podeEditar && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
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
                            onClick={() => alternarStatus(cliente)}
                          >
                            {cliente.ativo ? 'Desativar' : 'Reativar'}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
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
