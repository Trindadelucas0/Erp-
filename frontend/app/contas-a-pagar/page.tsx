'use client'

import { useCallback, useEffect, useState } from 'react'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { clienteHttp } from '@/services/api'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import { usePermissao } from '@/hooks/use-permissao'
import { CardPadrao } from '@/components/ui/card-padrao'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { Modal } from '@/components/ui/modal'
import { Abas } from '@/components/ui/abas'
import { LinhasSkeletonTabela } from '@/components/ui/linhas-skeleton-tabela'
import { FormularioContaPagar } from '@/components/contas-a-pagar/formulario-conta-pagar'
import { TelaBaixasContasAPagar } from '@/components/contas-a-pagar/tela-baixas-contas-a-pagar'
import {
  BadgeStatusContaPagar,
  BadgeTipoContaPagar,
  CelulaVencimentoContaPagar,
} from '@/components/contas-a-pagar/badges-conta-pagar'
import {
  ContaPagarLista,
  FormContaPagar,
  OPCOES_STATUS_CONTA,
  OPCOES_TIPO_CONTA,
  classeLinhaStatusContaPagar,
  contaParaForm,
  diasAteVencimento,
  formContaPagarVazio,
  formParaPayload,
  formatarCodigoContaPagar,
  formatarDataBr,
  formatarMoedaBr,
  rotuloStatusContaPagar,
  tituloVencido,
  validarFormContaPagar,
} from '@/lib/contas-a-pagar'

type Opcao = { id: string; nome: string; codigo?: string }

type Filtros = {
  pessoaId: string
  planoFinanceiroId: string
  tipo: string
  status: string
  codigo: string
  numeroDocumento: string
  vencimentoDe: string
  vencimentoAte: string
  valorMin: string
  valorMax: string
}

const FILTROS_VAZIOS: Filtros = {
  pessoaId: '',
  planoFinanceiroId: '',
  tipo: '',
  status: '',
  codigo: '',
  numeroDocumento: '',
  vencimentoDe: '',
  vencimentoAte: '',
  valorMin: '',
  valorMax: '',
}

function ConteudoContasAPagar() {
  const podeCriar = usePermissao('financeiro:create')
  const podeEditar = usePermissao('financeiro:edit')

  const [contas, setContas] = useState<ContaPagarLista[]>([])
  const [fornecedores, setFornecedores] = useState<Opcao[]>([])
  const [planos, setPlanos] = useState<Opcao[]>([])
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<ContaPagarLista | null>(null)
  const [form, setForm] = useState<FormContaPagar>(formContaPagarVazio())
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const carregarCatalogos = useCallback(async () => {
    try {
      const [resForn, resPlanos] = await Promise.all([
        clienteHttp.get('/fornecedores'),
        clienteHttp.get('/planos-financeiros', {
          params: { tipo: 'despesa', somenteSubgrupo: 'true' },
        }),
      ])
      setFornecedores(
        (resForn.data.fornecedores ?? [])
          .filter((f: { ativo: boolean }) => f.ativo)
          .map((f: { id: string; nome: string }) => ({ id: f.id, nome: f.nome }))
      )
      const listaPlanos = resPlanos.data.planos ?? resPlanos.data ?? []
      setPlanos(
        (Array.isArray(listaPlanos) ? listaPlanos : []).map(
          (p: { id: string; nome?: string; descricao?: string; codigo: string }) => ({
            id: p.id,
            nome: p.nome ?? p.descricao ?? p.codigo,
            codigo: p.codigo,
          })
        )
      )
    } catch {
      // catálogos opcionais na tela
    }
  }, [])

  const carregar = useCallback(async (f: Filtros = filtros) => {
    setCarregando(true)
    setErro(null)
    try {
      const params: Record<string, string> = {}
      if (f.pessoaId) params.pessoaId = f.pessoaId
      if (f.planoFinanceiroId) params.planoFinanceiroId = f.planoFinanceiroId
      if (f.tipo) params.tipo = f.tipo
      if (f.status) params.status = f.status
      if (f.codigo.trim()) params.codigo = f.codigo.trim()
      if (f.numeroDocumento.trim()) params.numeroDocumento = f.numeroDocumento.trim()
      if (f.vencimentoDe) params.vencimentoDe = f.vencimentoDe
      if (f.vencimentoAte) params.vencimentoAte = f.vencimentoAte
      if (f.valorMin.trim()) params.valorMin = f.valorMin.trim().replace(',', '.')
      if (f.valorMax.trim()) params.valorMax = f.valorMax.trim().replace(',', '.')

      const { data } = await clienteHttp.get<{ contas: ContaPagarLista[] }>('/contas-a-pagar', {
        params,
      })
      setContas(data.contas ?? [])
    } catch (e) {
      setErro(extrairMensagemApi(e, 'Falha ao listar contas a pagar.'))
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => {
    void carregarCatalogos()
    void carregar(FILTROS_VAZIOS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregarCatalogos])

  function abrirNovo() {
    setEditando(null)
    setForm(formContaPagarVazio())
    setErroForm(null)
    setModalAberto(true)
  }

  function abrirEdicao(conta: ContaPagarLista) {
    setEditando(conta)
    setForm(contaParaForm(conta))
    setErroForm(null)
    setModalAberto(true)
  }

  function fecharModal() {
    if (salvando || excluindo) return
    setModalAberto(false)
    setEditando(null)
    setErroForm(null)
  }

  async function gravar() {
    const msg = validarFormContaPagar(form)
    if (msg) {
      setErroForm(msg)
      return
    }
    setSalvando(true)
    setErroForm(null)
    try {
      const payload = formParaPayload(form)
      if (editando) {
        await clienteHttp.put(`/contas-a-pagar/${editando.id}`, payload)
      } else {
        await clienteHttp.post('/contas-a-pagar', payload)
      }
      setModalAberto(false)
      setEditando(null)
      await carregar()
    } catch (e) {
      setErroForm(extrairMensagemApi(e, 'Não foi possível gravar a conta a pagar.'))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!editando) return
    if (!window.confirm(`Excluir o título ${formatarCodigoContaPagar(editando.codigo)}?`)) return
    setExcluindo(true)
    setErroForm(null)
    try {
      await clienteHttp.delete(`/contas-a-pagar/${editando.id}`)
      setModalAberto(false)
      setEditando(null)
      await carregar()
    } catch (e) {
      setErroForm(extrairMensagemApi(e, 'Não foi possível excluir.'))
    } finally {
      setExcluindo(false)
    }
  }

  const somenteLeitura = Boolean(editando && editando.status !== 'aberto')
  const [aba, setAba] = useState('titulos')

  return (
    <div className="min-w-0 space-y-4">
      <CardPadrao titulo="Contas a Pagar" className="min-w-0">
        <Abas
          className="mb-4"
          abaAtiva={aba}
          aoMudar={setAba}
          abas={[
            { id: 'titulos', rotulo: 'Títulos' },
            { id: 'baixas', rotulo: 'Baixas' },
          ]}
        />

        {aba === 'baixas' ? (
          <TelaBaixasContasAPagar fornecedores={fornecedores} planos={planos} />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void carregar()} disabled={carregando}>
                Atualizar
              </Button>
              {podeCriar && (
                <Button type="button" onClick={abrirNovo}>
                  Novo título
                </Button>
              )}
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              Cadastro e visualização de títulos. Use a aba <strong>Baixas</strong> para pagar um ou
              vários de uma vez.
            </p>

        <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <SelectPadrao
              rotulo="Fornecedor"
              valor={filtros.pessoaId}
              aoMudar={(pessoaId) => setFiltros((f) => ({ ...f, pessoaId }))}
              opcoes={[
                { value: '', label: 'Todos' },
                ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
              ]}
              compacto
            />
          </div>
          <div className="min-w-0">
            <SelectPadrao
              rotulo="Plano financeiro"
              valor={filtros.planoFinanceiroId}
              aoMudar={(planoFinanceiroId) => setFiltros((f) => ({ ...f, planoFinanceiroId }))}
              opcoes={[
                { value: '', label: 'Todos' },
                ...planos.map((p) => ({
                  value: p.id,
                  label: p.codigo ? `${p.codigo} ${p.nome}` : p.nome,
                })),
              ]}
              compacto
            />
          </div>
          <div className="min-w-0">
            <SelectPadrao
              rotulo="Tipo"
              valor={filtros.tipo}
              aoMudar={(tipo) => setFiltros((f) => ({ ...f, tipo }))}
              opcoes={[{ value: '', label: 'Todos' }, ...OPCOES_TIPO_CONTA]}
              compacto
            />
          </div>
          <div className="min-w-0">
            <SelectPadrao
              rotulo="Status"
              valor={filtros.status}
              aoMudar={(status) => setFiltros((f) => ({ ...f, status }))}
              opcoes={OPCOES_STATUS_CONTA}
              compacto
            />
          </div>
          <div className="min-w-0">
            <InputPadrao
              rotulo="Código"
              value={filtros.codigo}
              onChange={(e) => setFiltros((f) => ({ ...f, codigo: e.target.value }))}
            />
          </div>
          <div className="min-w-0">
            <InputPadrao
              rotulo="Documento"
              value={filtros.numeroDocumento}
              onChange={(e) => setFiltros((f) => ({ ...f, numeroDocumento: e.target.value }))}
            />
          </div>
          <div className="min-w-0">
            <InputPadrao
              rotulo="Vencimento de"
              type="date"
              value={filtros.vencimentoDe}
              onChange={(e) => setFiltros((f) => ({ ...f, vencimentoDe: e.target.value }))}
            />
          </div>
          <div className="min-w-0">
            <InputPadrao
              rotulo="Vencimento até"
              type="date"
              value={filtros.vencimentoAte}
              onChange={(e) => setFiltros((f) => ({ ...f, vencimentoAte: e.target.value }))}
            />
          </div>
          <div className="flex min-w-0 flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-3">
            <Button type="button" onClick={() => void carregar(filtros)}>
              Filtrar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFiltros(FILTROS_VAZIOS)
                void carregar(FILTROS_VAZIOS)
              }}
            >
              Limpar
            </Button>
          </div>
        </div>

        {erro && (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}

        <div className="min-w-0 overflow-x-auto rounded-md border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Emissão</th>
                <th className="px-3 py-2 font-medium">Vencimento</th>
                <th className="px-3 py-2 font-medium">Fornecedor</th>
                <th className="px-3 py-2 font-medium">Documento</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Saldo</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <LinhasSkeletonTabela colunas={10} linhas={6} />
              ) : contas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum título encontrado.
                  </td>
                </tr>
              ) : (
                contas.map((conta) => {
                  const vencido = tituloVencido(conta.status, conta.vencimento)
                  const dias = diasAteVencimento(conta.vencimento)
                  const saldo = conta.saldoDevedor ?? conta.valorTotal
                  return (
                  <tr
                    key={conta.id}
                    className={`cursor-pointer border-t ${classeLinhaStatusContaPagar(conta.status, vencido)}`}
                    onClick={() => abrirEdicao(conta)}
                  >
                    <td className="px-3 py-2 font-medium">
                      {conta.codigoExibicao ?? formatarCodigoContaPagar(conta.codigo)}
                    </td>
                    <td className="px-3 py-2">{formatarDataBr(conta.dataEmissao)}</td>
                    <td className="px-3 py-2">
                      <CelulaVencimentoContaPagar
                        status={conta.status}
                        vencimento={conta.vencimento}
                        dataFormatada={formatarDataBr(conta.vencimento)}
                        dias={dias}
                      />
                    </td>
                    <td className="px-3 py-2">{conta.pessoa?.nome ?? '—'}</td>
                    <td className="px-3 py-2">{conta.numeroDocumento || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{formatarMoedaBr(conta.valorTotal)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      <span className={saldo <= 0.009 ? 'text-emerald-700' : undefined}>
                        {formatarMoedaBr(saldo)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <BadgeTipoContaPagar tipo={conta.tipo} />
                    </td>
                    <td className="px-3 py-2">
                      <BadgeStatusContaPagar status={conta.status} />
                    </td>
                    <td className="px-3 py-2">{formatarDataBr(conta.dataCadastro)}</td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}
      </CardPadrao>

      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo={editando ? `Título ${formatarCodigoContaPagar(editando.codigo)}` : 'Novo título'}
        descricao={
          editando
            ? `${rotuloStatusContaPagar(editando.status)}${
                somenteLeitura ? ' — somente leitura' : ''
              }`
            : 'Preencha os dados e grave. O código do sistema é gerado automaticamente.'
        }
        cabecalhoExtra={
          editando ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <BadgeStatusContaPagar status={editando.status} />
              <BadgeTipoContaPagar tipo={editando.tipo} />
            </div>
          ) : undefined
        }
        largura="3xl"
        alturaMinimaConteudo="md"
        rodape={
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              {editando && podeEditar && !somenteLeitura && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={salvando || excluindo}
                  onClick={() => void excluir()}
                >
                  {excluindo ? 'Excluindo…' : 'Excluir'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={fecharModal} disabled={salvando || excluindo}>
                Fechar
              </Button>
              {!somenteLeitura && ((editando && podeEditar) || (!editando && podeCriar)) && (
                <Button type="button" disabled={salvando || excluindo} onClick={() => void gravar()}>
                  {salvando ? 'Gravando…' : 'Gravar'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <FormularioContaPagar
          form={form}
          aoMudar={setForm}
          fornecedores={fornecedores}
          planos={planos}
          codigoExibicao={
            editando
              ? editando.codigoExibicao ?? formatarCodigoContaPagar(editando.codigo)
              : null
          }
          somenteLeitura={somenteLeitura || (!podeEditar && Boolean(editando))}
          erro={erroForm}
        />
      </Modal>
    </div>
  )
}

export default function PaginaContasAPagar() {
  return (
    <ProtegerRota chaveDaPagina="contas-a-pagar">
      <ConteudoContasAPagar />
    </ProtegerRota>
  )
}
