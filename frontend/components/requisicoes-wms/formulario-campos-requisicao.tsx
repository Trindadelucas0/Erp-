'use client'

import { useCallback, useEffect, useState } from 'react'
import { ComboboxEnderecoWms } from '@/components/produtos/combobox-endereco-wms'
import { ComboboxProduto, type ProdutoOpcao } from '@/components/pedidos-compra/combobox-produto'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { clienteHttp } from '@/services/api'
import {
  OPCOES_PRIORIDADE,
  OPCOES_TIPO_OPERACAO,
  type RequisicaoWms,
} from '@/lib/requisicoes-wms'

export type FormRequisicao = {
  tipoOperacao: string
  prioridade: string
  origemEnderecoId: string
  destinoEnderecoId: string
  produtoId: string
  quantidade: string
  responsavelId: string
  observacao: string
}

export function formVazioRequisicao(): FormRequisicao {
  return {
    tipoOperacao: 'separacao',
    prioridade: '3',
    origemEnderecoId: '',
    destinoEnderecoId: '',
    produtoId: '',
    quantidade: '',
    responsavelId: '',
    observacao: '',
  }
}

export function requisicaoParaForm(item: RequisicaoWms): FormRequisicao {
  return {
    tipoOperacao: item.tipoOperacao,
    prioridade: String(item.prioridade),
    origemEnderecoId: item.origemEnderecoId ?? '',
    destinoEnderecoId: item.destinoEnderecoId ?? '',
    produtoId: item.produtoId ?? '',
    quantidade: item.quantidade != null ? String(item.quantidade) : '',
    responsavelId: item.responsavelId ?? '',
    observacao: item.observacao ?? '',
  }
}

export function formParaPayload(form: FormRequisicao) {
  const qtd = form.quantidade.trim()
  return {
    tipoOperacao: form.tipoOperacao,
    prioridade: Number(form.prioridade),
    origemEnderecoId: form.origemEnderecoId || null,
    destinoEnderecoId: form.destinoEnderecoId || null,
    produtoId: form.produtoId || null,
    quantidade: qtd ? Number(qtd.replace(',', '.')) : null,
    responsavelId: form.responsavelId || null,
    observacao: form.observacao.trim() || null,
  }
}

type Operador = { id: string; name: string }

type Props = {
  form: FormRequisicao
  aoMudar: (form: FormRequisicao) => void
  operadores: Operador[]
  disabled?: boolean
}

export function FormularioCamposRequisicao({ form, aoMudar, operadores, disabled }: Props) {
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)

  const buscarProdutos = useCallback(async (termo: string) => {
    setCarregandoProdutos(true)
    try {
      const { data } = await clienteHttp.get('/produtos', {
        params: { q: termo, resumo: 'true', limite: 40, pagina: 1 },
      })
      const lista = (data.produtos ?? data.itens ?? []) as Array<{
        id: string
        nomeVenda: string
        sku: string | null
        unidade?: string
      }>
      setProdutos(
        lista.map((p) => ({
          id: p.id,
          nomeVenda: p.nomeVenda,
          sku: p.sku,
          unidade: p.unidade ?? 'UN',
        }))
      )
    } catch {
      setProdutos([])
    } finally {
      setCarregandoProdutos(false)
    }
  }, [])

  useEffect(() => {
    if (form.produtoId && produtos.every((p) => p.id !== form.produtoId)) {
      void buscarProdutos('')
    }
  }, [form.produtoId, produtos, buscarProdutos])

  function patch(parcial: Partial<FormRequisicao>) {
    aoMudar({ ...form, ...parcial })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectPadrao
        rotulo="Tipo de operação"
        obrigatorio
        valor={form.tipoOperacao}
        aoMudar={(tipoOperacao) => patch({ tipoOperacao })}
        opcoes={OPCOES_TIPO_OPERACAO}
        disabled={disabled}
      />
      <SelectPadrao
        rotulo="Prioridade"
        obrigatorio
        valor={form.prioridade}
        aoMudar={(prioridade) => patch({ prioridade })}
        opcoes={OPCOES_PRIORIDADE}
        disabled={disabled}
      />
      <ComboboxEnderecoWms
        rotulo="Origem"
        valor={form.origemEnderecoId}
        aoMudar={(origemEnderecoId) => patch({ origemEnderecoId })}
        tipoValor="id"
        disabled={disabled}
      />
      <ComboboxEnderecoWms
        rotulo="Destino"
        valor={form.destinoEnderecoId}
        aoMudar={(destinoEnderecoId) => patch({ destinoEnderecoId })}
        tipoValor="id"
        disabled={disabled}
      />
      <ComboboxProduto
        rotulo="Produto"
        produtos={produtos}
        valor={form.produtoId}
        aoMudar={(produtoId) => patch({ produtoId })}
        aoBuscar={buscarProdutos}
        carregandoBusca={carregandoProdutos}
        disabled={disabled}
      />
      <InputPadrao
        rotulo="Quantidade"
        value={form.quantidade}
        onChange={(e) => patch({ quantidade: e.target.value })}
        disabled={disabled}
        inputMode="decimal"
      />
      <SelectPadrao
        rotulo="Responsável"
        valor={form.responsavelId}
        aoMudar={(responsavelId) => patch({ responsavelId })}
        opcoes={[{ value: '', label: 'Sem responsável' }, ...operadores.map((o) => ({ value: o.id, label: o.name }))]}
        disabled={disabled}
      />
      <div className="sm:col-span-2">
        <InputPadrao
          rotulo="Observação"
          value={form.observacao}
          onChange={(e) => patch({ observacao: e.target.value })}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
