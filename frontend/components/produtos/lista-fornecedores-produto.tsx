'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputPadrao } from '@/components/ui/input-padrao'
import { ComboboxPessoa } from '@/components/pedidos-compra/combobox-pessoa'
import { SelecaoUnidadeMedida } from '@/components/produtos/selecao-unidade-medida'
import { aplicarEmbalagemNoFormularioFornecedor } from '@/lib/sincronizar-multiplo-embalagem'

export type FornecedorProdutoForm = {
  fornecedorPessoaId: string
  codigoFornecedor: string
  multiploEntrada: string
  multiplicadorEntrada: string
  unidadeEntrada: string
}

type FornecedorOpcao = { id: string; nome: string }

type Props = {
  itens: FornecedorProdutoForm[]
  opcoesFornecedores: FornecedorOpcao[]
  aoMudar: (itens: FornecedorProdutoForm[]) => void
  disabled?: boolean
  errosPorIndice?: Record<number, { multiplicadorEntrada?: string }>
}

const itemVazio = (): FornecedorProdutoForm => ({
  fornecedorPessoaId: '',
  codigoFornecedor: '',
  multiploEntrada: '',
  multiplicadorEntrada: '',
  unidadeEntrada: '',
})

function filtrarDecimal(valor: string): string {
  const limpo = valor.replace(/[^\d,.]/g, '')
  const partes = limpo.replace(/\./g, ',').split(',')
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes[0]},${partes.slice(1).join('')}`
}

export function ListaFornecedoresProduto({
  itens,
  opcoesFornecedores,
  aoMudar,
  disabled,
  errosPorIndice,
}: Props) {
  function atualizar(index: number, campo: keyof FornecedorProdutoForm, valor: string) {
    const nova = [...itens]
    const atual = nova[index]
    if (campo === 'multiplicadorEntrada') {
      const sincronizado = aplicarEmbalagemNoFormularioFornecedor({
        multiplicadorEntradaAnterior: atual.multiplicadorEntrada,
        multiplicadorEntrada: valor,
        multiploEntradaAtual: atual.multiploEntrada,
      })
      nova[index] = {
        ...atual,
        multiplicadorEntrada: sincronizado.multiplicadorEntrada,
        multiploEntrada: sincronizado.multiploEntrada,
      }
    } else {
      nova[index] = { ...atual, [campo]: valor }
    }
    aoMudar(nova)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Fornecedores</p>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => aoMudar([...itens, itemVazio()])}>
            <Plus className="mr-1 size-4" />
            Inserir
          </Button>
        )}
      </div>

      {itens.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum fornecedor vinculado ao produto.</p>
      )}

      {itens.map((item, index) => (
        <div
          key={index}
          className="relative grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
        >
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 w-8 p-0"
              onClick={() => aoMudar(itens.filter((_, i) => i !== index))}
              title="Remover fornecedor"
            >
              <Trash2 className="size-4" />
            </Button>
          )}

          <div className="min-w-0 sm:col-span-2 sm:pr-10">
            <ComboboxPessoa
              rotulo="Fornecedor"
              pessoas={opcoesFornecedores}
              valor={item.fornecedorPessoaId}
              aoMudar={(v) => atualizar(index, 'fornecedorPessoaId', v)}
              disabled={disabled}
              placeholder="Digite o nome do fornecedor..."
              obrigatorio
            />
          </div>
          <div className="min-w-0">
            <InputPadrao
              rotulo="Código Original"
              value={item.codigoFornecedor}
              onChange={(e) => atualizar(index, 'codigoFornecedor', e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="min-w-0 sm:col-span-2">
            <InputPadrao
              rotulo="Múltiplo de compra"
              value={item.multiploEntrada}
              onChange={(e) => atualizar(index, 'multiploEntrada', filtrarDecimal(e.target.value))}
              disabled={disabled}
              inputMode="decimal"
              placeholder="Ex.: 6 — só compra de 6 em 6 caixas"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Passo mínimo que o fornecedor exige no pedido de compra.
            </p>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <InputPadrao
              rotulo="Quantidade por embalagem (entrada)"
              value={item.multiplicadorEntrada}
              onChange={(e) => atualizar(index, 'multiplicadorEntrada', filtrarDecimal(e.target.value))}
              disabled={disabled}
              inputMode="decimal"
              placeholder="Ex.: 12 — quantos itens vêm em cada embalagem de entrada"
              mensagemDeErro={errosPorIndice?.[index]?.multiplicadorEntrada}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Quantos itens da unidade de venda equivalem a 1 embalagem na entrada.
            </p>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <SelecaoUnidadeMedida
              rotulo="Unidade na entrada"
              valor={item.unidadeEntrada}
              aoMudar={(sigla) => atualizar(index, 'unidadeEntrada', sigla)}
              disabled={disabled}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
