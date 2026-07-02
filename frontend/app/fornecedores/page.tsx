'use client'

/**
 * Tela de fornecedores — CRUD completo PF/PJ com validação inline,
 * BrasilAPI, verificação de duplicidade e flags fiscais.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { LinhaTabelaClicavel } from '@/components/compartilhado/linha-tabela-clicavel'
import { RodapeModalVisualizacao } from '@/components/compartilhado/rodape-modal-visualizacao'
import { RodapeModalFormulario } from '@/components/compartilhado/rodape-modal-formulario'
import { IndicadorEtapasModal } from '@/components/compartilhado/indicador-etapas-modal'
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
import { BadgeCadastro } from '@/components/ui/badge-cadastro'
import { CelulaBadge } from '@/components/ui/celula-badge'
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
import { ListaEnderecos, ENDERECO_VAZIO, type EnderecoForm } from '@/components/clientes/lista-enderecos'
import {
  ListaDadosBancarios,
  DADOS_BANCARIO_VAZIO,
  dadosBancarioApiParaForm,
  type DadosBancarioForm,
} from '@/components/clientes/lista-dados-bancarios'
import { ListaCnaes, type CnaeForm } from '@/components/pessoas/lista-cnaes'
import { CampoInscricaoEstadual } from '@/components/pessoas/campo-inscricao-estadual'
import {
  SelecaoMultiplaCatalogo,
  type ItemCatalogo,
} from '@/components/fornecedores/selecao-multipla-catalogo'
import { ListaParesPlanoCfop, type PlanoCfopPar } from '@/components/fornecedores/lista-pares-plano-cfop'
import { mesclarTexto, mesclarArray, mesclarBoolean } from '@/lib/mesclar-pre-preenchimento'
import { MSG_PLANO_SOMENTE_DESPESA, MSG_PLANO_SOMENTE_SUBGRUPO, planoEhDespesa, planoEhSubgrupo } from '@/lib/plano-financeiro'
import {
  FornecedoresRelacionadosField,
  type FornecedorRelacionadoItem,
} from '@/components/fornecedores/fornecedores-relacionados-field'

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
  cnaes?: { codigo: string; descricao?: string | null; principal: boolean }[]
  dataFundacao?: string | null
  ie?: string | null
  im?: string | null
  simplesNacional?: boolean
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
  observacoes?: string | null
  tipoRevenda?: boolean
  tipoConsumo?: boolean
  tipoPrestadorServico?: boolean
  permitirVinculoManual?: boolean
  exigirItensEntrada?: boolean
  prazosPagamento?: (number | null)[]
  planosFinanceiros?: ItemCatalogo[]
  cfopsEntrada?: ItemCatalogo[]
  paresPlanoCfopPadrao?: PlanoCfopPar[]
  dadosFornecedorId?: string | null
  fornecedoresVinculadosIds?: string[]
  fornecedoresRelacionados?: FornecedorRelacionadoItem[]
  dadosBancarios?: DadosBancarioForm[]
}

type FormFornecedor = {
  tipo: TipoFornecedor
  documento: string
  nome: string
  rg: string
  dataNascimento: string
  nomeFantasia: string
  cnaes: CnaeForm[]
  dataFundacao: string
  ie: string
  ieIsento: boolean
  im: string
  simplesNacional: boolean
  email: string
  telefone: string
  celularWhatsapp: boolean
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  codigoIbge: string
  observacoes: string
  tipoRevenda: boolean
  tipoConsumo: boolean
  tipoPrestadorServico: boolean
  permitirVinculoManual: boolean
  exigirItensEntrada: boolean
  prazosPagamento: string[]
  planosFinanceiros: ItemCatalogo[]
  cfopsEntrada: ItemCatalogo[]
  paresPlanoCfopPadrao: PlanoCfopPar[]
  fornecedoresVinculadosIds: string[]
  fornecedoresRelacionados: FornecedorRelacionadoItem[]
  dadosBancarios: DadosBancarioForm[]
  contatos: ContatoForm[]
  enderecos: EnderecoForm[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]


const FORM_VAZIO: FormFornecedor = {
  tipo: 'PJ',
  documento: '',
  nome: '',
  rg: '',
  dataNascimento: '',
  nomeFantasia: '',
  cnaes: [],
  dataFundacao: '',
  ie: '',
  ieIsento: false,
  im: '',
  simplesNacional: false,
  email: '',
  telefone: '',
  celularWhatsapp: false,
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  codigoIbge: '',
  observacoes: '',
  tipoRevenda: true,
  tipoConsumo: false,
  tipoPrestadorServico: false,
  permitirVinculoManual: false,
  exigirItensEntrada: false,
  prazosPagamento: ['', '', '', '', '', ''],
  planosFinanceiros: [],
  cfopsEntrada: [],
  paresPlanoCfopPadrao: [],
  fornecedoresVinculadosIds: [],
  fornecedoresRelacionados: [],
  dadosBancarios: [],
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
  const telefoneRaw = f.telefone || f.celular || ''
  const prazos = [...(f.prazosPagamento ?? [])]
  while (prazos.length < 6) prazos.push(null)

  return {
    tipo: f.tipo,
    documento: documentoParaMascara(f),
    nome: f.nome,
    rg: f.rg || '',
    dataNascimento: f.dataNascimento || '',
    nomeFantasia: f.nomeFantasia || '',
    cnaes: Array.isArray(f.cnaes)
      ? f.cnaes.map((c) => ({
          codigo: c.codigo,
          descricao: c.descricao || '',
          principal: c.principal ?? false,
        }))
      : [],
    dataFundacao: f.dataFundacao || '',
    ie: f.ie === 'ISENTO' ? '' : (f.ie || ''),
    ieIsento: f.ie === 'ISENTO',
    im: f.im || '',
    simplesNacional: f.simplesNacional ?? false,
    email: f.email || '',
    telefone: telefoneRaw ? mascaraTelefone(telefoneRaw) : '',
    celularWhatsapp: f.celularWhatsapp ?? false,
    cep: f.cep ? mascaraCep(f.cep) : '',
    logradouro: f.logradouro || '',
    numero: f.numero || '',
    complemento: f.complemento || '',
    bairro: f.bairro || '',
    cidade: f.cidade || '',
    estado: f.estado || '',
    codigoIbge: f.codigoIbge || '',
    observacoes: f.observacoes || '',
    tipoRevenda: f.tipoRevenda ?? false,
    tipoConsumo: f.tipoConsumo ?? false,
    tipoPrestadorServico: f.tipoPrestadorServico ?? false,
    permitirVinculoManual: f.permitirVinculoManual ?? false,
    exigirItensEntrada: f.exigirItensEntrada ?? false,
    prazosPagamento: prazos.slice(0, 6).map((p) => (p != null ? String(p) : '')),
    planosFinanceiros: f.planosFinanceiros ?? [],
    cfopsEntrada: f.cfopsEntrada ?? [],
    paresPlanoCfopPadrao: (f.paresPlanoCfopPadrao ?? []).map((par: PlanoCfopPar & { planoTipo?: string }) => ({
      planoFinanceiroId: par.planoFinanceiroId || '',
      planoCodigo: par.planoCodigo || '',
      planoDescricao: par.planoDescricao || '',
      planoTipo: par.planoTipo,
      cfopId: par.cfopId || '',
      cfopCodigo: par.cfopCodigo || '',
      cfopDescricao: par.cfopDescricao || '',
    })),
    fornecedoresVinculadosIds: f.fornecedoresVinculadosIds ?? [],
    fornecedoresRelacionados: f.fornecedoresRelacionados ?? [],
    dadosBancarios: Array.isArray(f.dadosBancarios)
      ? f.dadosBancarios.map((db) =>
          dadosBancarioApiParaForm(db, f.nome, documentoParaMascara(f))
        )
      : [],
    contatos: Array.isArray((f as Fornecedor & { contatos?: ContatoForm[] }).contatos)
      ? (f as Fornecedor & { contatos: ContatoForm[] }).contatos.map((ct) => ({
          tipo: ct.tipo,
          valor: ct.valor,
          descricao: ct.descricao || '',
          whatsapp: ct.whatsapp ?? false,
          principal: ct.principal ?? false,
        }))
      : [],
    enderecos: Array.isArray((f as Fornecedor & { enderecos?: EnderecoForm[] }).enderecos)
      ? (f as Fornecedor & { enderecos: EnderecoForm[] }).enderecos.map((e) => ({
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
  cnaes: 'Identificação',
  tipoFornecedor: 'Identificação',
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
  dadosBancarios: 'Dados Bancários',
  planosFinanceiros: 'Outros',
}

function contaBancariaTemAlgumCampo(db: DadosBancarioForm): boolean {
  return [
    db.apelido,
    db.banco,
    db.agencia,
    db.conta,
    db.pix,
    db.favorecido,
    db.documentoFavorecido,
  ].some((v) => v.trim().length > 0)
}

function validarDadosBancarios(dados: DadosBancarioForm[]): string | undefined {
  for (const db of dados) {
    if (!contaBancariaTemAlgumCampo(db)) continue
    if (!db.banco.trim() || !db.agencia.trim() || !db.conta.trim()) {
      return 'contas parcialmente preenchidas devem ter banco, agência e conta'
    }
  }
  return undefined
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function emailContatoValido(email: string): boolean {
  const t = email.trim()
  return !t || RE_EMAIL.test(t)
}

function telefoneContatoValido(telefone: string): boolean {
  const digitos = telefone.replace(/\D/g, '')
  return digitos.length === 0 || digitos.length >= 10
}

function validarContatosArray(contatos: ContatoForm[]): string | undefined {
  for (const c of contatos) {
    const valor = c.valor.trim()
    if (!valor) continue
    if (c.tipo === 'email' && !RE_EMAIL.test(valor)) return 'e-mail inválido'
    if (c.tipo === 'telefone' && valor.replace(/\D/g, '').length < 10) return 'telefone ou celular inválido'
  }
  return undefined
}

function contatoSimplesValido(email: string, telefone: string): boolean {
  return emailContatoValido(email) && telefoneContatoValido(telefone)
}

function validarPlanosFinanceirosFornecedor(form: FormFornecedor): string | undefined {
  if (!form.tipoConsumo && !form.tipoPrestadorServico) return undefined

  const planoLiberadoInvalido = form.planosFinanceiros.find(
    (p) => !planoEhDespesa(p) || !planoEhSubgrupo(p)
  )
  if (planoLiberadoInvalido) {
    if (!planoEhDespesa(planoLiberadoInvalido)) {
      return `${MSG_PLANO_SOMENTE_DESPESA} (${planoLiberadoInvalido.codigo})`
    }
    return `${MSG_PLANO_SOMENTE_SUBGRUPO} (${planoLiberadoInvalido.codigo})`
  }

  const parInvalido = form.paresPlanoCfopPadrao.find(
    (par) =>
      par.planoFinanceiroId &&
      (!planoEhDespesa({ codigo: par.planoCodigo, tipo: par.planoTipo }) ||
        !planoEhSubgrupo({ codigo: par.planoCodigo }))
  )
  if (parInvalido) {
    if (!planoEhDespesa({ codigo: parInvalido.planoCodigo, tipo: parInvalido.planoTipo })) {
      return `${MSG_PLANO_SOMENTE_DESPESA} (par padrão ${parInvalido.planoCodigo})`
    }
    return `${MSG_PLANO_SOMENTE_SUBGRUPO} (par padrão ${parInvalido.planoCodigo})`
  }

  return undefined
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

  const modoArray = form.contatos.length > 0

  if (modoArray) {
    const erroContatos = validarContatosArray(form.contatos)
    if (erroContatos) erros.contatos = erroContatos
  } else {
    const emailTrim = form.email.trim()
    if (emailTrim && !RE_EMAIL.test(emailTrim)) erros.email = 'e-mail inválido'
    const telDigitos = form.telefone.replace(/\D/g, '')
    if (telDigitos.length > 0 && telDigitos.length < 10) erros.telefone = 'telefone ou celular inválido'
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

  if (!form.tipoRevenda && !form.tipoConsumo && !form.tipoPrestadorServico)
    erros.tipoFornecedor = 'selecione ao menos um tipo de fornecedor'

  const erroDadosBancarios = validarDadosBancarios(form.dadosBancarios)
  if (erroDadosBancarios) erros.dadosBancarios = erroDadosBancarios

  const erroPlanos = validarPlanosFinanceirosFornecedor(form)
  if (erroPlanos) erros.planosFinanceiros = erroPlanos

  return erros
}

function gerarPendenciasDoForm(form: FormFornecedor): string[] {
  return Object.entries(validarFormFornecedor(form)).map(
    ([campo, mensagem]) => `${PREFIXO_ERRO_POR_CAMPO[campo] ?? 'Formulário'}: ${mensagem}`
  )
}

const ROTULO_POR_ABA: Record<string, string> = {
  identificacao: 'Identificação',
  contato: 'Contato',
  endereco: 'Endereço',
  'dados-bancarios': 'Dados Bancários',
  outros: 'Outros',
}

const CAMPOS_POR_ABA: Record<string, string[]> = {
  identificacao: ['nome', 'documento', 'cnaes'],
  contato: ['email', 'telefone', 'contatos'],
  endereco: ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'codigoIbge', 'enderecos'],
  'dados-bancarios': ['dadosBancarios'],
  outros: ['tipoFornecedor', 'planosFinanceiros'],
}

function gerarPendenciasDaAba(abaId: string, form: FormFornecedor): string[] {
  const rotulo = ROTULO_POR_ABA[abaId]
  return Object.entries(validarFormFornecedor(form))
    .filter(([campo]) => PREFIXO_ERRO_POR_CAMPO[campo] === rotulo)
    .map(([, mensagem]) => mensagem)
    .filter((m): m is string => !!m)
}

function calcularStatusCadastro(f: Fornecedor): { completo: boolean; pendencias: string[] } {
  const erros: string[] = []
  if (!f.nome || f.nome.trim().length < 2) erros.push('Nome obrigatório')
  if (!f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) erros.push('E-mail obrigatório')
  if (!f.telefone) erros.push('Telefone obrigatório')
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
  const [modoVisualizacao, setModoVisualizacao] = useState(false)
  const [idEmEdicao, setIdEmEdicao] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('identificacao')
  const [errosDaAbaAtual, setErrosDaAbaAtual] = useState<string[]>([])

  const idsAbas = ['identificacao', 'contato', 'endereco', 'dados-bancarios', 'outros']
  const indiceAbaAtiva = idsAbas.indexOf(abaAtiva)
  const ehPrimeiraAba = indiceAbaAtiva === 0
  const ehUltimaAba = indiceAbaAtiva === idsAbas.length - 1

  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState<FormFornecedor>(FORM_VAZIO)
  const [formInicial, setFormInicial] = useState<FormFornecedor>(() => clonarFormulario(FORM_VAZIO))
  const formRef = useRef(form)
  formRef.current = form
  const modoEdicaoRef = useRef(modoEdicao)
  modoEdicaoRef.current = modoEdicao
  const modoVisualizacaoRef = useRef(modoVisualizacao)
  modoVisualizacaoRef.current = modoVisualizacao

  const somenteLeitura = modoVisualizacao

  const [avisoDuplicidade, setAvisoDuplicidade] = useState<{
    tipo: 'fornecedor_existente' | 'pessoa_sem_papel'
    fornecedorId?: string
    mensagem: string
  } | null>(null)
  const [camposTocados, setCamposTocados] = useState<Set<string>>(() => new Set())
  const [erroSalvar, setErroSalvar] = useState('')
  const refBusca = useRef<HTMLInputElement>(null)

  const teclaNovo = useTeclaDaAcao('novo')
  const teclaSalvar = useTeclaDaAcao('salvar')

  // ─── Validação de abas ───────────────────────────────────────────────────

  const configAbas: ConfigDeAba[] = useMemo(
    () => [
      {
        id: 'identificacao',
        validar: () => {
          const f = formRef.current
          if (!f.nome.trim() || f.nome.trim().length < 2) return false
          const nums = f.documento.replace(/\D/g, '')
          if (f.tipo === 'PF') { if (!validarCpf(nums)) return false }
          else { if (!validarCnpj(nums)) return false }
          if (!f.tipoRevenda && !f.tipoConsumo && !f.tipoPrestadorServico) return false
          return true
        },
      },
      {
        id: 'contato',
        validar: () => {
          const f = formRef.current
          if (f.contatos.length > 0) return !validarContatosArray(f.contatos)
          return contatoSimplesValido(f.email, f.telefone)
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
          if (
            cep.replace(/\D/g, '').length < 8 ||
            !logradouro.trim() ||
            !numero.trim() ||
            !bairro.trim() ||
            !cidade.trim() ||
            !estado.trim()
          ) return false
          if (f.codigoIbge && !/^\d{7}$/.test(f.codigoIbge.replace(/\D/g, ''))) return false
          return true
        },
      },
      {
        id: 'dados-bancarios',
        validar: () => !validarDadosBancarios(formRef.current.dadosBancarios),
      },
      {
        id: 'outros',
        validar: () => true,
      },
    ],
    []
  )

  const { statusDasAbas, validarTodasAsAbas, irParaAbaComErro, resetarStatus, validarAba, abaLiberada } =
    useValidacaoDeAbas(configAbas)

  const abasComStatus = [
    { id: 'identificacao', rotulo: 'Identificação', status: statusDasAbas['identificacao'] },
    { id: 'contato', rotulo: 'Contato', status: statusDasAbas['contato'] },
    { id: 'endereco', rotulo: 'Endereço', status: statusDasAbas['endereco'] },
    { id: 'dados-bancarios', rotulo: 'Dados Bancários', status: statusDasAbas['dados-bancarios'] },
    { id: 'outros', rotulo: 'Outros', status: statusDasAbas['outros'] },
  ]

  const etapasModalFornecedor = abasComStatus.map(({ id, rotulo }) => ({ id, rotulo }))

  const errosForm = useMemo(() => validarFormFornecedor(form), [form])
  const documentoDuplicado = avisoDuplicidade?.tipo === 'fornecedor_existente'
  const formularioValido = Object.keys(errosForm).length === 0 && !documentoDuplicado

  const etapaAtualLiberada =
    abaLiberada(abaAtiva) && !(abaAtiva === 'identificacao' && documentoDuplicado)

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

  const {
    aoSairDocumento,
    carregandoBrasilApi,
    verificandoDocumento,
    resetarConsulta,
  } = useConsultaDocumento({
    getForm: () => ({ documento: formRef.current.documento, tipo: formRef.current.tipo }),
    getModoEdicao: () => modoEdicaoRef.current,
    getSomenteLeitura: () => modoVisualizacaoRef.current,
    endpointPorDocumento: '/fornecedores/por-documento',
    tocarCampo,
    aoAplicarDadosCnpj: (dados) => {
      setForm((f) => ({
        ...f,
        nome: mesclarTexto(f.nome, dados.nome),
        nomeFantasia: mesclarTexto(f.nomeFantasia, dados.nomeFantasia),
        cnaes: dados.cnaes.length > 0 ? dados.cnaes : f.cnaes,
        dataFundacao: mesclarTexto(f.dataFundacao, dados.dataFundacao),
        email: mesclarTexto(f.email, dados.email),
        telefone: mesclarTexto(f.telefone, dados.telefone),
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
      if (data.temPapelFornecedor) {
        setAvisoDuplicidade({
          tipo: 'fornecedor_existente',
          fornecedorId: data.pessoa?.id,
          mensagem: `Documento já cadastrado como fornecedor: ${data.pessoa?.nome}`,
        })
      } else {
        setAvisoDuplicidade({
          tipo: 'pessoa_sem_papel',
          mensagem: `Pessoa encontrada no sistema (${(data.papeis as string[])?.join(', ')}): ${data.pessoa?.nome}. Os dados foram pré-preenchidos.`,
        })
        if (data.pessoa) {
          const importado = fornecedorParaForm({ ...(data.pessoa as Fornecedor), tipo } as Fornecedor)
          setForm((f) => ({
            ...f,
            nome: mesclarTexto(f.nome, importado.nome),
            nomeFantasia: mesclarTexto(f.nomeFantasia, importado.nomeFantasia),
            ie: importado.ieIsento ? '' : mesclarTexto(f.ie, importado.ie),
            ieIsento: importado.ieIsento || f.ieIsento,
            im: mesclarTexto(f.im, importado.im),
            cnaes: importado.cnaes.length > 0 ? importado.cnaes : f.cnaes,
            dataFundacao: mesclarTexto(f.dataFundacao, importado.dataFundacao),
            simplesNacional: mesclarBoolean(f.simplesNacional, importado.simplesNacional),
            email: mesclarTexto(f.email, importado.email),
            telefone: mesclarTexto(f.telefone, importado.telefone),
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
            tipoRevenda: mesclarBoolean(f.tipoRevenda, importado.tipoRevenda),
            tipoConsumo: mesclarBoolean(f.tipoConsumo, importado.tipoConsumo),
            tipoPrestadorServico: mesclarBoolean(f.tipoPrestadorServico, importado.tipoPrestadorServico),
            permitirVinculoManual: mesclarBoolean(f.permitirVinculoManual, importado.permitirVinculoManual),
            exigirItensEntrada: mesclarBoolean(f.exigirItensEntrada, importado.exigirItensEntrada),
            prazosPagamento: importado.prazosPagamento.some((p) => p) ? importado.prazosPagamento : f.prazosPagamento,
            paresPlanoCfopPadrao: mesclarArray(f.paresPlanoCfopPadrao, importado.paresPlanoCfopPadrao),
          }))
        }
      }
    },
  })

  const tocarCamposDaAba = useCallback((abaId: string) => {
    const campos = CAMPOS_POR_ABA[abaId] ?? []
    setCamposTocados((anterior) => {
      const proximo = new Set(anterior)
      for (const campo of campos) proximo.add(campo)
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

  function aoMudarTipoFornecedor(
    campo: 'tipoRevenda' | 'tipoConsumo' | 'tipoPrestadorServico',
    valor: boolean
  ) {
    tocarCampo('tipoFornecedor')
    setForm((f) => {
      const proximo = { ...f, [campo]: valor }
      if (!proximo.tipoConsumo && !proximo.tipoPrestadorServico) {
        proximo.permitirVinculoManual = false
        proximo.exigirItensEntrada = false
      }
      return proximo
    })
  }

  // ─── Modal ──────────────────────────────────────────────────────────────

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
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    setErrosDaAbaAtual([])
    resetarStatus()
    resetarConsulta()
    setModalAberto(true)
  }

  function abrirModalEdicao(f: Fornecedor) {
    const formEdicao = fornecedorParaForm(f)
    setForm(formEdicao)
    setFormInicial(clonarFormulario(formEdicao))
    setModoEdicao(true)
    setModoVisualizacao(false)
    setIdEmEdicao(f.id)
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setErroSalvar('')
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    setErrosDaAbaAtual([])
    resetarStatus()
    resetarConsulta()
    setModalAberto(true)
  }

  function abrirModalVisualizacao(f: Fornecedor) {
    const formView = fornecedorParaForm(f)
    setForm(formView)
    setFormInicial(clonarFormulario(formView))
    setModoEdicao(false)
    setModoVisualizacao(true)
    setIdEmEdicao(f.id)
    setAbaAtiva('identificacao')
    setMensagemDeErro('')
    setErroSalvar('')
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    setErrosDaAbaAtual([])
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
    setCamposTocados(new Set())
    setAvisoDuplicidade(null)
    setErrosDaAbaAtual([])
    resetarStatus()
    resetarConsulta()
  }, [resetarStatus, resetarConsulta])

  const { solicitarFechar, dialogoConfirmacao } = useConfirmarSaida(
    form,
    formInicial,
    fecharModal
  )

  // ─── Campo documento unificado ───────────────────────────────────────────

  function camposAoTrocarTipo(novoTipo: 'PF' | 'PJ') {
    return {
      rg: '',
      dataNascimento: '',
      nomeFantasia: '',
      cnaes: [] as CnaeForm[],
      dataFundacao: '',
      ie: '',
      ieIsento: false,
      im: '',
      simplesNacional: false,
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
          logradouro: dados.logradouro ? paraCaixaAlta(dados.logradouro) : f.logradouro,
          bairro: dados.bairro ? paraCaixaAlta(dados.bairro) : f.bairro,
          cidade: dados.localidade ? paraCaixaAlta(dados.localidade) : f.cidade,
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
    const prazosPagamento = form.prazosPagamento.map((p) => {
      const trimmed = p.trim()
      return trimmed ? parseInt(trimmed, 10) : null
    })

    const dadosBancariosPayload = form.dadosBancarios
      .filter(contaBancariaTemAlgumCampo)
      .map((db) => ({
        apelido: db.apelido || undefined,
        banco: db.banco || undefined,
        agencia: db.agencia || undefined,
        conta: db.conta || undefined,
        tipoConta: db.tipoConta || undefined,
        pix: db.pix || undefined,
        favorecido: db.favorecido || undefined,
        documentoFavorecido: db.documentoFavorecido.replace(/\D/g, '') || undefined,
        principal: db.principal,
      }))

    const base = {
      tipo: form.tipo,
      nome: form.nome,
      email: form.email || undefined,
      telefone: form.telefone || undefined,
      celularWhatsapp: form.celularWhatsapp,
      cep: form.cep || undefined,
      logradouro: form.logradouro || undefined,
      numero: form.numero || undefined,
      complemento: form.complemento || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      estado: form.estado || undefined,
      codigoIbge: form.codigoIbge || undefined,
      observacoes: form.observacoes || undefined,
      tipoRevenda: form.tipoRevenda,
      tipoConsumo: form.tipoConsumo,
      tipoPrestadorServico: form.tipoPrestadorServico,
      permitirVinculoManual: form.permitirVinculoManual,
      exigirItensEntrada: form.exigirItensEntrada,
      prazosPagamento,
      planosFinanceirosIds: form.planosFinanceiros.map((p) => p.id),
      cfopsEntradaIds: form.cfopsEntrada.map((c) => c.id),
      paresPlanoCfopPadrao: form.paresPlanoCfopPadrao
        .filter((par) => par.planoFinanceiroId && par.cfopId)
        .map((par) => ({ planoFinanceiroId: par.planoFinanceiroId, cfopId: par.cfopId })),
      fornecedoresVinculadosIds: form.fornecedoresVinculadosIds,
      dadosBancarios: dadosBancariosPayload.length > 0 ? dadosBancariosPayload : undefined,
    }

    const contatosPayload =
      form.contatos.length > 0
        ? { contatos: form.contatos.filter((c) => c.valor.trim()) }
        : {
            email: form.email || undefined,
            telefone: form.telefone || undefined,
            celularWhatsapp: form.celularWhatsapp,
          }

    const enderecosPayload =
      form.enderecos.length > 0
        ? { enderecos: form.enderecos.map((e) => ({ ...e, cep: e.cep.replace(/\D/g, '') || undefined })) }
        : { cep: form.cep || undefined, logradouro: form.logradouro || undefined, numero: form.numero || undefined, complemento: form.complemento || undefined, bairro: form.bairro || undefined, cidade: form.cidade || undefined, estado: form.estado || undefined, codigoIbge: form.codigoIbge || undefined }

    if (form.tipo === 'PF') {
      return { ...base, ...contatosPayload, ...enderecosPayload, cpf: nums, rg: form.rg || undefined, dataNascimento: form.dataNascimento || undefined }
    }

    return {
      ...base,
      ...contatosPayload,
      ...enderecosPayload,
      cnpj: nums,
      nomeFantasia: form.nomeFantasia || undefined,
      cnaes: form.cnaes.length > 0 ? form.cnaes : undefined,
      dataFundacao: form.dataFundacao || undefined,
      ie: form.ieIsento ? 'ISENTO' : (form.ie || undefined),
      im: form.im || undefined,
      simplesNacional: form.simplesNacional,
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

  async function alternarStatus(f: Fornecedor, opcoes?: { fecharModalApos?: boolean }) {
    setMensagemDeErro('')
    setMensagemDeSucesso('')
    setAlterandoStatus(f.id)
    try {
      await clienteHttp.patch(`/fornecedores/${f.id}/ativo`, { ativo: !f.ativo })
      setMensagemDeSucesso(f.ativo ? 'Fornecedor desativado.' : 'Fornecedor reativado.')
      await carregarFornecedores()
      if (opcoes?.fecharModalApos) fecharModal()
    } catch (erro) {
      setMensagemDeErro(extrairErro(erro, 'Erro ao alterar status'))
    } finally {
      setAlterandoStatus(null)
    }
  }

  const fornecedorEmVisualizacao = listaFornecedores.find((f) => f.id === idEmEdicao)

  const qualquerOperacaoAtiva = salvando || verificandoDocumento || carregandoBrasilApi

  useRegistrarAtalhos(
    {
      buscar: () => refBusca.current?.focus(),
      novo: abrirModalNovo,
      atualizar: carregarFornecedores,
      salvar: () => submeterFormularioPorId('form-fornecedor'),
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

  const fornecedoresFiltrados = listaFornecedores.filter((f) => {
    const termo = busca.toLowerCase()
    return (
      f.nome.toLowerCase().includes(termo) ||
      (f.nomeFantasia && f.nomeFantasia.toLowerCase().includes(termo)) ||
      (f.cpf && f.cpf.includes(busca.replace(/\D/g, ''))) ||
      (f.cnpj && f.cnpj.includes(busca.replace(/\D/g, ''))) ||
      (f.email && f.email.toLowerCase().includes(termo)) ||
      (f.estado && f.estado.toLowerCase().includes(termo))
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
        titulo={
          modoVisualizacao
            ? `Visualizar fornecedor: ${form.nome}`
            : modoEdicao
              ? `Editar fornecedor: ${form.nome}`
              : 'Novo fornecedor'
        }
        descricao={modoVisualizacao ? 'Consulta dos dados cadastrados (somente leitura)' : undefined}
        largura="2xl"
        manterPosicao={!modoVisualizacao}
        alturaMinimaConteudo={!modoVisualizacao ? 'min-h-[420px]' : undefined}
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
                if (fornecedorEmVisualizacao) {
                  void alternarStatus(fornecedorEmVisualizacao, { fecharModalApos: true })
                }
              }}
              podeDesativar={podeDesativar}
              registroAtivo={fornecedorEmVisualizacao?.ativo ?? true}
              carregandoStatus={
                !!fornecedorEmVisualizacao && alterandoStatus === fornecedorEmVisualizacao.id
              }
            />
          ) : (
            <RodapeModalFormulario
              formId="form-fornecedor"
              rotuloSalvar={modoEdicao ? 'Salvar' : 'Cadastrar fornecedor'}
              salvando={salvando}
              podeSalvar={formularioValido}
              titleSalvar={tituloComAtalho(
                modoEdicao ? 'Salvar' : 'Cadastrar fornecedor',
                teclaSalvar
              )}
              aoAnterior={irParaAbaAnterior}
              mostrarAnterior={!ehPrimeiraAba}
              aoProximo={aoAvancar}
              mostrarProximo={!ehUltimaAba}
              podeProximo={etapaAtualLiberada}
              desabilitado={salvando}
            />
          )
        }
      >
        {!modoVisualizacao && avisoDuplicidade && (
          <div className={`mb-4 rounded-md px-3 py-2 text-sm ${
            avisoDuplicidade.tipo === 'fornecedor_existente'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
          }`}>
            {avisoDuplicidade.mensagem}
          </div>
        )}

        {!modoVisualizacao && (
          <IndicadorEtapasModal
            etapas={etapasModalFornecedor}
            etapaAtiva={abaAtiva}
            className="mb-4"
          />
        )}

        {!modoVisualizacao && (errosDaAbaAtual.length > 0 || erroSalvar) && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erroSalvar ? (
              <p>{erroSalvar}</p>
            ) : (
              <ul className="space-y-0.5">
                {errosDaAbaAtual.map((erro, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span>{erro}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!modoVisualizacao &&
          !etapaAtualLiberada &&
          !ehUltimaAba &&
          errosDaAbaAtual.length === 0 && (
            <p className="mb-4 text-xs text-muted-foreground">
              Preencha os campos obrigatórios desta etapa para continuar
            </p>
          )}

        <Abas abas={abasComStatus} abaAtiva={abaAtiva} aoMudar={setAbaAtiva} className="mb-5" />

        <div className="relative">
          {salvando && (
            <div className="absolute inset-0 z-10 rounded-md bg-background/60 backdrop-blur-[1px]" />
          )}
          <form id="form-fornecedor" onSubmit={aoSalvar}>
            <fieldset disabled={somenteLeitura} className="m-0 min-w-0 border-0 p-0">
            <div key={abaAtiva} className="transition-opacity duration-150">
            {/* ── Aba 1: Identificação ─────────────────────────────────── */}
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
                      <label className="text-sm font-medium leading-none">
                        CNPJ
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
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          disabled={modoEdicao || somenteLeitura}
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
                    <div className="flex items-end pb-1">
                      <CampoCheckbox
                        rotulo="Simples Nacional"
                        valor={form.simplesNacional}
                        aoMudar={(v) => set('simplesNacional', v)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-sm font-medium leading-none">
                      CPF
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
                        placeholder="000.000.000-00"
                        maxLength={14}
                        disabled={modoEdicao || somenteLeitura}
                        aria-invalid={!!erroDocumentoVisivel()}
                      />
                      {verificandoDocumento && (
                        <span className="absolute right-2 top-2 text-xs text-muted-foreground">Verificando...</span>
                      )}
                    </div>
                    {erroDocumentoVisivel() && (
                      <p className="text-sm text-destructive">{erroDocumentoVisivel()}</p>
                    )}
                    {modoEdicao && !erroDocumentoVisivel() && (
                      <p className="text-xs text-muted-foreground">CPF/CNPJ não pode ser alterado após o cadastro.</p>
                    )}
                  </div>
                )}

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
                      <CampoInscricaoEstadual
                        ie={form.ie}
                        ieIsento={form.ieIsento}
                        aoMudarIe={(v) => set('ie', v)}
                        aoMudarIsento={(v) => {
                          setForm((f) => ({
                            ...f,
                            ieIsento: v,
                            ie: v ? '' : f.ie,
                          }))
                        }}
                      />
                      <CampoInput rotulo="IM" valor={form.im} aoMudar={(v) => set('im', v)} placeholder="Inscrição Municipal" maxLength={30} />
                    </div>
                    <CampoInput rotulo="Data de fundação" valor={form.dataFundacao} aoMudar={(v) => set('dataFundacao', v)} tipo="date" />
                    <ListaCnaes cnaes={form.cnaes} />
                  </div>
                )}

                <Separator />

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
                    disabled={somenteLeitura}
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
                    <CampoInput rotulo="Telefone" valor={form.telefone}
                      aoMudar={(v) => { tocarCampo('telefone'); set('telefone', mascaraTelefone(v)) }}
                      onBlur={() => tocarCampo('telefone')}
                      placeholder="(00) 0000-0000 ou (00) 00000-0000" maxLength={15}
                      mensagemDeErro={erroVisivel('telefone')} />
                    <CampoCheckbox rotulo="Telefone com WhatsApp" valor={form.celularWhatsapp} aoMudar={(v) => set('celularWhatsapp', v)} />
                  </>
                )}
                {!somenteLeitura && (
                  <button type="button"
                    onClick={() => {
                      if (form.contatos.length > 0) {
                        set('contatos', [])
                      } else {
                        const inicial: ContatoForm[] = []
                        if (form.email) inicial.push({ tipo: 'email', valor: form.email, descricao: '', whatsapp: false, principal: true })
                        if (form.telefone) inicial.push({ tipo: 'telefone', valor: form.telefone, descricao: '', whatsapp: form.celularWhatsapp, principal: true })
                        set('contatos', inicial.length > 0 ? inicial : [{ tipo: 'email', valor: '', descricao: '', whatsapp: false, principal: true }])
                      }
                    }}
                    className="text-xs text-primary underline">
                    {form.contatos.length > 0 ? '← Modo simples' : '+ Múltiplos contatos'}
                  </button>
                )}
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
                    disabled={somenteLeitura}
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
                {!somenteLeitura && (
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
                )}
              </div>
            )}

            {/* ── Aba 4: Dados Bancários ─────────────────────────────── */}
            {abaAtiva === 'dados-bancarios' && (
              <ListaDadosBancarios
                dadosBancarios={form.dadosBancarios}
                aoMudar={(v) => { tocarCampo('dadosBancarios'); set('dadosBancarios', v) }}
                nomeCadastro={form.nome}
                documentoCadastro={form.documento}
                mensagemDeErro={erroVisivel('dadosBancarios')}
                disabled={somenteLeitura}
              />
            )}

            {/* ── Aba 5: Outros ──────────────────────────────────────── */}
            {abaAtiva === 'outros' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Tipo de fornecedor</label>
                  <div className="flex flex-wrap gap-4">
                    <CampoCheckbox rotulo="Revenda" valor={form.tipoRevenda} aoMudar={(v) => aoMudarTipoFornecedor('tipoRevenda', v)} />
                    <CampoCheckbox rotulo="Consumo" valor={form.tipoConsumo} aoMudar={(v) => aoMudarTipoFornecedor('tipoConsumo', v)} />
                    <CampoCheckbox rotulo="Prestador de serviço" valor={form.tipoPrestadorServico} aoMudar={(v) => aoMudarTipoFornecedor('tipoPrestadorServico', v)} />
                  </div>
                  {erroVisivel('tipoFornecedor') && (
                    <p className="text-sm text-destructive">{erroVisivel('tipoFornecedor')}</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium">Prazos</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    {form.prazosPagamento.map((prazo, idx) => (
                      <CampoInput
                        key={idx}
                        rotulo={`Prazo ${idx + 1}`}
                        valor={prazo}
                        aoMudar={(v) => {
                          const novos = [...form.prazosPagamento]
                          novos[idx] = v.replace(/\D/g, '')
                          set('prazosPagamento', novos)
                        }}
                        placeholder="Dias"
                        maxLength={4}
                      />
                    ))}
                  </div>
                </div>

                {(form.tipoConsumo || form.tipoPrestadorServico) && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-4">
                      <CampoCheckbox rotulo="Permitir vínculo manual dos produtos na entrada" valor={form.permitirVinculoManual} aoMudar={(v) => set('permitirVinculoManual', v)} />
                      <CampoCheckbox rotulo="Exigir itens na entrada p/ uso e consumo" valor={form.exigirItensEntrada} aoMudar={(v) => set('exigirItensEntrada', v)} />
                    </div>
                  </div>
                )}

                {(form.tipoConsumo || form.tipoPrestadorServico) && (
                  <div className="space-y-4">
                    {erroVisivel('planosFinanceiros') && (
                      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {erroVisivel('planosFinanceiros')}
                      </p>
                    )}
                    <SelecaoMultiplaCatalogo
                      endpoint="/cfops"
                      tipoCfop="entrada"
                      rotulo="CFOPs liberados para entrada"
                      selecionados={form.cfopsEntrada}
                      aoMudar={(v) => set('cfopsEntrada', v)}
                      disabled={somenteLeitura}
                    />
                    <SelecaoMultiplaCatalogo
                        endpoint="/planos-financeiros"
                        tipoPlano="despesa"
                        somenteSubgrupo
                        rotulo="Planos financeiros liberados para entrada"
                        selecionados={form.planosFinanceiros}
                        aoMudar={(v) => set('planosFinanceiros', v)}
                        disabled={somenteLeitura}
                      />
                  </div>
                )}

                {(form.tipoConsumo || form.tipoPrestadorServico) && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Pares Plano Financeiro + CFOP Padrão</label>
                    <p className="text-xs text-muted-foreground">Cada par define um plano financeiro padrão e o CFOP de entrada correspondente.</p>
                    <ListaParesPlanoCfop
                      pares={form.paresPlanoCfopPadrao}
                      aoMudar={(v) => set('paresPlanoCfopPadrao', v)}
                      disabled={somenteLeitura}
                    />
                  </div>
                )}

                <FornecedoresRelacionadosField
                  pessoaIdAtual={(modoEdicao || modoVisualizacao) ? idEmEdicao : undefined}
                  relacionados={form.fornecedoresRelacionados}
                  vinculadosDiretosIds={form.fornecedoresVinculadosIds}
                  aoMudarVinculosDiretos={(ids, relacionados) => {
                    setForm((f) => ({
                      ...f,
                      fornecedoresVinculadosIds: ids,
                      fornecedoresRelacionados: relacionados,
                    }))
                  }}
                  disabled={somenteLeitura}
                />
              </div>
            )}
            </div>
            </fieldset>
          </form>
        </div>
      </Modal>

      {/* Tabela */}
      <CardPadrao
        titulo="Fornecedores"
        descricao="Lista de todos os fornecedores cadastrados"
        acoes={
          <div className="flex gap-2">
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
            placeholder="Buscar por razão social, nome fantasia, CPF/CNPJ ou UF..."
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <colgroup>
              <col />
              <col />
              <col className="w-[9rem]" />
              <col className="w-[2.5rem]" />
              <col className="w-[4.5rem]" />
              <col className="w-[5.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-2 py-2 text-left font-medium">Razão social</th>
                <th className="px-2 py-2 text-left font-medium">Nome fantasia</th>
                <th className="px-2 py-2 text-left font-medium">CPF/CNPJ</th>
                <th className="px-2 py-2 text-left font-medium">UF</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
                <th className="px-2 py-2 text-left font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {carregandoLista &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-2 py-2">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!carregandoLista && fornecedoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
                  <LinhaTabelaClicavel
                    key={f.id}
                    aoClicar={() => abrirModalVisualizacao(f)}
                    ariaLabel={`Visualizar fornecedor ${f.nome}`}
                    desabilitada={alterandoStatus === f.id}
                  >
                    <td
                      className="max-w-0 truncate whitespace-nowrap px-2 py-2 font-medium"
                      title={f.nome}
                    >
                      {f.nome}
                    </td>
                    <td
                      className="max-w-0 truncate whitespace-nowrap px-2 py-2 text-muted-foreground"
                      title={f.nomeFantasia || undefined}
                    >
                      {f.nomeFantasia || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-muted-foreground">
                      {documento}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                      {f.estado || '—'}
                    </td>
                    <CelulaBadge>
                      <BadgeStatus variante={f.ativo ? 'ativo' : 'inativo'}>
                        {f.ativo ? 'Ativo' : 'Inativo'}
                      </BadgeStatus>
                    </CelulaBadge>
                    <CelulaBadge>
                      <BadgeCadastro completo={completo} pendencias={pendencias} />
                    </CelulaBadge>
                  </LinhaTabelaClicavel>
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
