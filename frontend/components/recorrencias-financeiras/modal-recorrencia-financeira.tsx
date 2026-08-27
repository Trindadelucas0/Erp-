'use client'

import { FormEvent, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { Modal } from '@/components/ui/modal'
import { ModalFaixaErro, ModalSecao } from '@/components/ui/modal-layout'
import { InputPadrao } from '@/components/ui/input-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { ComboboxPessoa } from '@/components/pedidos-compra/combobox-pessoa'
import {
  ComboboxProduto,
  type ProdutoOpcao,
} from '@/components/pedidos-compra/combobox-produto'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import type { RecorrenciaFinanceiraLista } from './tipos-recorrencia'

type Props = {
  aberto: boolean
  modoEdicao: boolean
  registro: RecorrenciaFinanceiraLista | null
  fornecedores: Array<{ id: string; nome: string }>
  aoFechar: () => void
  aoSalvo: () => void
}

type FormRecorrencia = {
  fornecedorPessoaId: string
  produtoId: string
  valor: string
  ativo: boolean
}

const formVazio: FormRecorrencia = {
  fornecedorPessoaId: '',
  produtoId: '',
  valor: '',
  ativo: true,
}

function parseDinheiro(texto: string): number {
  const t = texto.trim().replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export function ModalRecorrenciaFinanceira({
  aberto,
  modoEdicao,
  registro,
  fornecedores,
  aoFechar,
  aoSalvo,
}: Props) {
  const [form, setForm] = useState<FormRecorrencia>(formVazio)
  const [produtos, setProdutos] = useState<ProdutoOpcao[]>([])
  const [carregandoBuscaProduto, setCarregandoBuscaProduto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    if (modoEdicao && registro) {
      setForm({
        fornecedorPessoaId: registro.fornecedorPessoaId,
        produtoId: registro.produtoId,
        valor: String(registro.valor).replace('.', ','),
        ativo: registro.ativo,
      })
      if (registro.produto) {
        setProdutos([
          {
            id: registro.produto.id,
            nomeVenda: registro.produto.nomeVenda,
            sku: registro.produto.sku,
            unidade: registro.produto.unidade,
          },
        ])
      } else {
        setProdutos([])
      }
    } else {
      setForm(formVazio)
      setProdutos([])
    }
    setErro('')
  }, [aberto, modoEdicao, registro])

  async function buscarProdutos(termo: string) {
    const q = termo.trim()
    if (q.length < 2) {
      setProdutos((atual) =>
        form.produtoId ? atual.filter((p) => p.id === form.produtoId) : []
      )
      return
    }
    setCarregandoBuscaProduto(true)
    try {
      const { data } = await clienteHttp.get<{ produtos?: ProdutoOpcao[] }>('/produtos', {
        params: { q, pagina: 1, limite: 20, resumo: 'true' },
      })
      const lista = data.produtos ?? []
      setProdutos((atual) => {
        const selecionado = atual.find((p) => p.id === form.produtoId)
        if (!selecionado) return lista
        if (lista.some((p) => p.id === selecionado.id)) return lista
        return [selecionado, ...lista]
      })
    } catch {
      setProdutos((atual) => atual.filter((p) => p.id === form.produtoId))
    } finally {
      setCarregandoBuscaProduto(false)
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.fornecedorPessoaId) {
      setErro('Selecione o fornecedor')
      return
    }
    if (!form.produtoId) {
      setErro('Selecione o produto/serviço')
      return
    }
    const valor = parseDinheiro(form.valor)
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor maior que zero')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        fornecedorPessoaId: form.fornecedorPessoaId,
        produtoId: form.produtoId,
        valor,
        ativo: form.ativo,
      }
      if (modoEdicao && registro) {
        await clienteHttp.put(`/recorrencias-financeiras/${registro.id}`, payload)
      } else {
        await clienteHttp.post('/recorrencias-financeiras', payload)
      }
      aoSalvo()
      aoFechar()
    } catch (err) {
      setErro(extrairMensagemApi(err, 'Não foi possível salvar a recorrência'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={modoEdicao ? 'Editar recorrência' : 'Nova recorrência'}
      descricao="Quando a nota do fornecedor chegar com este valor, a Entrada consolida sozinha."
      largura="lg"
      rodape={
        <>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <BotaoPrimario type="submit" form="form-recorrencia" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </BotaoPrimario>
        </>
      }
    >
      <form id="form-recorrencia" className="space-y-4" onSubmit={(e) => void salvar(e)}>
        <ModalFaixaErro mensagem={erro} />
        <ModalSecao titulo="Dados da recorrência">
          <div className="space-y-3">
            <ComboboxPessoa
              rotulo="Fornecedor"
              pessoas={fornecedores}
              valor={form.fornecedorPessoaId}
              aoMudar={(id) => setForm((f) => ({ ...f, fornecedorPessoaId: id }))}
              obrigatorio
            />
            <ComboboxProduto
              rotulo="Produto / serviço"
              produtos={produtos}
              valor={form.produtoId}
              aoMudar={(id) => setForm((f) => ({ ...f, produtoId: id }))}
              aoBuscar={(termo) => void buscarProdutos(termo)}
              carregandoBusca={carregandoBuscaProduto}
            />
            <InputPadrao
              rotulo="Valor"
              obrigatorio
              inputMode="decimal"
              placeholder="Ex.: 2600,00"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="recorrencia-ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v === true }))}
              />
              <Label htmlFor="recorrencia-ativo">Habilitado</Label>
            </div>
          </div>
        </ModalSecao>
      </form>
    </Modal>
  )
}
