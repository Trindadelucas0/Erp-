'use client'

/**
 * Tela de cadastros — CRUD de empresas com permissões cadastros:*.
 */
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { LinhaTabelaClicavel } from '@/components/compartilhado/linha-tabela-clicavel'
import { RodapeModalVisualizacao } from '@/components/compartilhado/rodape-modal-visualizacao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { usePermissao } from '@/hooks/use-permissao'
import { useRegistrarAtalhos } from '@/hooks/use-registrar-atalhos'
import { useConfirmarSaida } from '@/hooks/use-confirmar-saida'
import { clonarFormulario } from '@/lib/formulario-alterado'
import {
  tituloComAtalho,
  useTeclaDaAcao,
} from '@/components/compartilhado/provedor-de-atalhos'
import { BadgeStatus } from '@/components/ui/badge-status'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { Modal } from '@/components/ui/modal'
import { Separator } from '@/components/ui/separator'
import { submeterFormularioPorId } from '@/lib/atalhos/submeter-formulario'
import { mascaraTelefone, mascaraCep } from '@/lib/documentos'
import { paraCaixaAlta } from '@/lib/texto'

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

type Empresa = {
  id: string
  name: string
  cnpj: string
  active: boolean
  phone?: string | null
  email?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
}

type FormularioEmpresa = {
  nome: string
  cnpj: string
  phone: string
  email: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

const formularioVazio: FormularioEmpresa = {
  nome: '',
  cnpj: '',
  phone: '',
  email: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
}

function extrairMensagemDeErro(erro: unknown, mensagemPadrao: string): string {
  const respostaAxios = erro as {
    response?: { data?: { mensagem?: string; message?: string } }
    message?: string
    code?: string
  }

  if (!respostaAxios.response) {
    if (respostaAxios.code === 'ERR_NETWORK') {
      return 'Não foi possível conectar à API. Verifique se o servidor está rodando.'
    }
    return respostaAxios.message || mensagemPadrao
  }

  const dados = respostaAxios.response.data
  return dados?.mensagem || dados?.message || mensagemPadrao
}

function aplicarMascaraCnpj(valor: string): string {
  const numeros = valor.replace(/\D/g, '').slice(0, 14)
  return numeros
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function aplicarMascaraCep(valor: string): string {
  return mascaraCep(valor)
}

function empresaParaFormulario(empresa: Empresa): FormularioEmpresa {
  const cnpj = empresa.cnpj.replace(/\D/g, '')
  return {
    nome: empresa.name,
    cnpj: aplicarMascaraCnpj(cnpj),
    phone: empresa.phone ? mascaraTelefone(empresa.phone) : '',
    email: empresa.email || '',
    cep: empresa.cep ? aplicarMascaraCep(empresa.cep) : '',
    logradouro: empresa.logradouro || '',
    numero: empresa.numero || '',
    complemento: empresa.complemento || '',
    bairro: empresa.bairro || '',
    cidade: empresa.cidade || '',
    estado: empresa.estado || '',
  }
}

function ConteudoDaPaginaDeCadastros() {
  const { estaAutenticado, carregando: carregandoSessao } = useSessaoDoUsuario()
  const podeCriar = usePermissao('cadastros:create')
  const podeEditar = usePermissao('cadastros:edit')
  const podeDesativar = usePermissao('cadastros:delete')

  const [listaDeEmpresas, setListaDeEmpresas] = useState<Empresa[]>([])
  const [mensagemDeErro, setMensagemDeErro] = useState('')
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState('')

  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [modoVisualizacao, setModoVisualizacao] = useState(false)
  const [idDaEmpresaEmEdicao, setIdDaEmpresaEmEdicao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [alterandoStatusId, setAlterandoStatusId] = useState('')

  const [form, setForm] = useState<FormularioEmpresa>(formularioVazio)
  const [formInicial, setFormInicial] = useState<FormularioEmpresa>(() =>
    clonarFormulario(formularioVazio)
  )

  const teclaNovo = useTeclaDaAcao('novo')
  const teclaSalvar = useTeclaDaAcao('salvar')
  const teclaCancelar = useTeclaDaAcao('cancelar')

  useEffect(() => {
    if (carregandoSessao || !estaAutenticado) return
    carregarEmpresas()
  }, [carregandoSessao, estaAutenticado])

  async function carregarEmpresas() {
    try {
      const { data } = await clienteHttp.get('/companies')
      setListaDeEmpresas(data.empresas)
    } catch (erro: unknown) {
      setMensagemDeErro(extrairMensagemDeErro(erro, 'Erro ao carregar empresas'))
    }
  }

  function atualizarCampo<K extends keyof FormularioEmpresa>(
    campo: K,
    valor: string
  ) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function abrirModalNovo() {
    const vazio = clonarFormulario(formularioVazio)
    setForm(vazio)
    setFormInicial(vazio)
    setModoEdicao(false)
    setModoVisualizacao(false)
    setIdDaEmpresaEmEdicao('')
    setMensagemDeErro('')
    setModalAberto(true)
  }

  function abrirModalEdicao(empresa: Empresa) {
    const f = empresaParaFormulario(empresa)
    setForm(f)
    setFormInicial(clonarFormulario(f))
    setModoEdicao(true)
    setModoVisualizacao(false)
    setIdDaEmpresaEmEdicao(empresa.id)
    setMensagemDeErro('')
    setModalAberto(true)
  }

  function abrirModalVisualizacao(empresa: Empresa) {
    const f = empresaParaFormulario(empresa)
    setForm(f)
    setFormInicial(clonarFormulario(f))
    setModoEdicao(false)
    setModoVisualizacao(true)
    setIdDaEmpresaEmEdicao(empresa.id)
    setMensagemDeErro('')
    setModalAberto(true)
  }

  function alternarParaEdicao() {
    if (!podeEditar) return
    setModoVisualizacao(false)
    setModoEdicao(true)
    setFormInicial(clonarFormulario(form))
  }

  const fecharModal = useCallback(() => {
    setModalAberto(false)
    setModoVisualizacao(false)
    setMensagemDeErro('')
  }, [])

  const { solicitarFechar, dialogoConfirmacao } = useConfirmarSaida(
    form,
    formInicial,
    fecharModal
  )

  async function buscarEnderecoPorCep(cep: string) {
    const numeros = cep.replace(/\D/g, '')
    if (numeros.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${numeros}/json/`)
      const dados = await res.json()
      if (!dados.erro) {
        setForm((f) => ({
          ...f,
          logradouro: dados.logradouro ? paraCaixaAlta(dados.logradouro) : f.logradouro,
          bairro: dados.bairro ? paraCaixaAlta(dados.bairro) : f.bairro,
          cidade: dados.localidade ? paraCaixaAlta(dados.localidade) : f.cidade,
          estado: dados.uf || f.estado,
        }))
      }
    } catch {
      // silencia erro de CEP
    }
  }

  async function aoSalvarEmpresa(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')
    setSalvando(true)

    const corpo = {
      nome: form.nome,
      cnpj: form.cnpj,
      phone: form.phone || undefined,
      email: form.email || undefined,
      cep: form.cep || undefined,
      logradouro: form.logradouro || undefined,
      numero: form.numero || undefined,
      complemento: form.complemento || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      estado: form.estado || undefined,
    }

    try {
      if (modoEdicao) {
        await clienteHttp.put(`/companies/${idDaEmpresaEmEdicao}`, corpo)
        setMensagemDeSucesso('Empresa atualizada!')
      } else {
        await clienteHttp.post('/companies', corpo)
        setMensagemDeSucesso('Empresa criada!')
      }
      fecharModal()
      await carregarEmpresas()
    } catch (erro: unknown) {
      setMensagemDeErro(extrairMensagemDeErro(erro, 'Erro ao salvar empresa'))
    } finally {
      setSalvando(false)
    }
  }

  async function alternarStatusDaEmpresa(empresa: Empresa, opcoes?: { fecharModalApos?: boolean }) {
    setMensagemDeErro('')
    setMensagemDeSucesso('')
    setAlterandoStatusId(empresa.id)
    try {
      await clienteHttp.patch(`/companies/${empresa.id}/ativo`, {
        ativo: !empresa.active,
      })
      setMensagemDeSucesso(empresa.active ? 'Empresa desativada.' : 'Empresa reativada.')
      await carregarEmpresas()
      if (opcoes?.fecharModalApos) fecharModal()
    } catch (erro: unknown) {
      setMensagemDeErro(extrairMensagemDeErro(erro, 'Erro ao alterar status'))
    } finally {
      setAlterandoStatusId('')
    }
  }

  const empresaEmVisualizacao = listaDeEmpresas.find((e) => e.id === idDaEmpresaEmEdicao)

  useRegistrarAtalhos(
    {
      novo: abrirModalNovo,
      atualizar: carregarEmpresas,
      salvar: () => submeterFormularioPorId('form-empresa'),
      cancelar: solicitarFechar,
    },
    {
      novo: podeCriar && !modalAberto,
      atualizar: !modalAberto,
      salvar: modalAberto && !salvando && !modoVisualizacao,
      cancelar: modalAberto && !salvando,
    }
  )

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

      {dialogoConfirmacao}

      {/* Modal de criar/editar empresa */}
      <Modal
        aberto={modalAberto}
        aoFechar={solicitarFechar}
        titulo={
          modoVisualizacao
            ? `Visualizar empresa: ${form.nome || 'empresa'}`
            : modoEdicao
              ? 'Editar empresa'
              : 'Nova empresa'
        }
        descricao={
          modoVisualizacao
            ? 'Consulta dos dados cadastrados (somente leitura)'
            : modoEdicao
              ? 'Altere os dados e clique em Salvar'
              : 'Preencha os dados para cadastrar uma nova empresa'
        }
        largura="xl"
        rodape={
          modoVisualizacao ? (
            <RodapeModalVisualizacao
              aoFechar={fecharModal}
              aoEditar={alternarParaEdicao}
              podeEditar={podeEditar}
              aoAlternarStatus={() => {
                if (empresaEmVisualizacao) {
                  void alternarStatusDaEmpresa(empresaEmVisualizacao, { fecharModalApos: true })
                }
              }}
              podeDesativar={podeDesativar}
              registroAtivo={empresaEmVisualizacao?.active ?? true}
              carregandoStatus={alterandoStatusId === empresaEmVisualizacao?.id}
            />
          ) : (
          <div className="flex justify-end gap-2">
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
              form="form-empresa"
              type="submit"
              disabled={salvando}
              title={tituloComAtalho(
                modoEdicao ? 'Salvar' : 'Criar empresa',
                teclaSalvar
              )}
            >
              {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Criar empresa'}
            </BotaoPrimario>
          </div>
          )
        }
      >
        {mensagemDeErro && modalAberto && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mensagemDeErro}
          </p>
        )}

        <form
          id="form-empresa"
          onSubmit={aoSalvarEmpresa}
          className="space-y-5"
        >
          <fieldset disabled={modoVisualizacao} className="m-0 min-w-0 space-y-5 border-0 p-0">
          {/* Identificação */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Identificação
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputPadrao
                rotulo="Razão Social"
                value={form.nome}
                onChange={(e) => atualizarCampo('nome', e.target.value)}
                placeholder="Nome completo da empresa"
                required
              />
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">
                  CNPJ <span className="text-destructive">*</span>
                </label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.cnpj}
                  onChange={(e) =>
                    atualizarCampo('cnpj', aplicarMascaraCnpj(e.target.value))
                  }
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">
                  Telefone
                </label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.phone}
                  onChange={(e) =>
                    atualizarCampo(
                      'phone',
                      mascaraTelefone(e.target.value)
                    )
                  }
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <InputPadrao
                rotulo="Email corporativo"
                type="email"
                value={form.email}
                onChange={(e) => atualizarCampo('email', e.target.value)}
                placeholder="contato@empresa.com.br"
              />
            </div>
          </div>

          <Separator />

          {/* Endereço */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Endereço
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">CEP</label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.cep}
                  onChange={(e) =>
                    atualizarCampo('cep', aplicarMascaraCep(e.target.value))
                  }
                  onBlur={(e) => buscarEnderecoPorCep(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>
              <div className="sm:col-span-2">
                <InputPadrao
                  rotulo="Logradouro"
                  value={form.logradouro}
                  onChange={(e) => atualizarCampo('logradouro', e.target.value)}
                  placeholder="Rua, Avenida, etc."
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <InputPadrao
                rotulo="Número"
                value={form.numero}
                onChange={(e) => atualizarCampo('numero', e.target.value)}
                placeholder="123"
              />
              <div className="sm:col-span-2">
                <InputPadrao
                  rotulo="Complemento"
                  value={form.complemento}
                  onChange={(e) =>
                    atualizarCampo('complemento', e.target.value)
                  }
                  placeholder="Sala, Andar, Bloco..."
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <InputPadrao
                rotulo="Bairro"
                value={form.bairro}
                onChange={(e) => atualizarCampo('bairro', e.target.value)}
                placeholder="Bairro"
              />
              <InputPadrao
                rotulo="Cidade"
                value={form.cidade}
                onChange={(e) => atualizarCampo('cidade', e.target.value)}
                placeholder="Cidade"
              />
              <SelectPadrao
                rotulo="Estado"
                valor={form.estado}
                aoMudar={(v) => atualizarCampo('estado', v)}
                opcoes={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
              />
            </div>
          </div>
          </fieldset>
        </form>
      </Modal>

      <CardPadrao
        titulo="Empresas"
        descricao="Cadastro de empresas do sistema"
        acoes={
          <div className="flex gap-2">
            {podeCriar && (
              <BotaoPrimario
                type="button"
                onClick={abrirModalNovo}
                title={tituloComAtalho('Nova empresa', teclaNovo)}
              >
                + Nova empresa
              </BotaoPrimario>
            )}
          </div>
        }
      >
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">CNPJ</th>
                <th className="px-4 py-3 text-left font-medium">Telefone</th>
                <th className="px-4 py-3 text-left font-medium">Cidade / UF</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {listaDeEmpresas.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma empresa cadastrada.
                  </td>
                </tr>
              )}
              {listaDeEmpresas.map((empresa) => (
                <LinhaTabelaClicavel
                  key={empresa.id}
                  ariaLabel={`Visualizar ${empresa.name}`}
                  desabilitada={alterandoStatusId === empresa.id}
                  aoClicar={() => abrirModalVisualizacao(empresa)}
                >
                  <td className="px-4 py-3 font-medium">{empresa.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {aplicarMascaraCnpj(empresa.cnpj)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {empresa.phone
                      ? mascaraTelefone(empresa.phone)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {empresa.cidade && empresa.estado
                      ? `${empresa.cidade} / ${empresa.estado}`
                      : empresa.cidade || empresa.estado || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeStatus variante={empresa.active ? 'ativo' : 'inativo'}>
                      {empresa.active ? 'Ativa' : 'Inativa'}
                    </BadgeStatus>
                  </td>
                </LinhaTabelaClicavel>
              ))}
            </tbody>
          </table>
        </div>
      </CardPadrao>
    </div>
  )
}

export default function PaginaDeCadastros() {
  return (
    <ProtegerRota chaveDaPagina="cadastros">
      <ConteudoDaPaginaDeCadastros />
    </ProtegerRota>
  )
}
