'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { ComboboxEnderecoWms } from '@/components/produtos/combobox-endereco-wms'
import { haEnderecoEstoqueDuplicado } from '@/lib/enderecos-estoque-produto'

export type EnderecoEstoqueForm = {
  endereco: string
}

type Props = {
  itens: EnderecoEstoqueForm[]
  aoMudar: (itens: EnderecoEstoqueForm[]) => void
  disabled?: boolean
  podeSalvarNesteProduto?: boolean
  salvandoNesteProduto?: boolean
  mensagemNesteProduto?: string
  aoSalvarNesteProduto?: () => void
}

const itemVazio = (): EnderecoEstoqueForm => ({ endereco: '' })

function linhaDuplicada(itens: EnderecoEstoqueForm[], index: number) {
  const chave = itens[index].endereco.trim().toUpperCase()
  if (!chave) return false
  return itens.filter((e) => e.endereco.trim().toUpperCase() === chave).length > 1
}

export function ListaEnderecosEstoque({
  itens,
  aoMudar,
  disabled,
  podeSalvarNesteProduto = false,
  salvandoNesteProduto = false,
  mensagemNesteProduto = '',
  aoSalvarNesteProduto,
}: Props) {
  function atualizar(index: number, valor: string) {
    const nova = [...itens]
    nova[index] = { endereco: valor }
    aoMudar(nova)
  }

  return (
    <div className="space-y-3 pb-56">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Endereços de estoque</p>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => aoMudar([...itens, itemVazio()])}>
            <Plus className="mr-1 size-4" />
            Adicionar
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Só o apartamento (código completo, ex.: A-RC-20-01-2-05). Local e área da árvore não entram.
      </p>

      {itens.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum endereço cadastrado.</p>
      )}

      {itens.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto]">
          <ComboboxEnderecoWms
            valor={item.endereco}
            aoMudar={(codigo) => atualizar(index, codigo)}
            disabled={disabled}
            mensagemDeErro={
              linhaDuplicada(itens, index) ? 'Este endereço já está em outra linha.' : undefined
            }
          />
          {!disabled && (
            <div className="flex items-end pb-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => aoMudar(itens.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {podeSalvarNesteProduto && aoSalvarNesteProduto ? (
        <div className="space-y-2">
          <BotaoPrimario
            type="button"
            disabled={disabled || salvandoNesteProduto || haEnderecoEstoqueDuplicado(itens)}
            onClick={aoSalvarNesteProduto}
          >
            {salvandoNesteProduto ? 'Salvando...' : 'Salvar neste produto'}
          </BotaoPrimario>
          {mensagemNesteProduto ? (
            <p className="text-sm text-primary">{mensagemNesteProduto}</p>
          ) : null}
        </div>
      ) : !disabled ? (
        <p className="text-xs text-muted-foreground">
          Os endereços entram ao clicar em Cadastrar produto no rodapé.
        </p>
      ) : null}
    </div>
  )
}
