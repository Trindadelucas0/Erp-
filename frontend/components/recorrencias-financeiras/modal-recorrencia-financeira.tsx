'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import { Modal } from '@/components/ui/modal'
import { ModalFaixaErro, ModalSecao } from '@/components/ui/modal-layout'
import { InputPadrao } from '@/components/ui/input-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { ComboboxPessoa } from '@/components/pedidos-compra/combobox-pessoa'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { extrairMensagemApi } from '@/lib/extrair-mensagem-api'
import {
  gravarDeepLinkFornecedor,
  RETORNO_RECORRENCIA_FINANCEIRA,
} from '@/lib/fornecedor-deep-link'
import { usePermissao } from '@/hooks/use-permissao'
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
  valor: string
  periodicidade: 'mensal' | 'anual'
  diaVencimento: string
  competenciaInicio: string
  competenciaFim: string
  ativo: boolean
}

const OPCOES_PERIODICIDADE = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
] as const

const OPCOES_DIA = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

function competenciaHoje(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const ano = partes.find((p) => p.type === 'year')?.value ?? '2026'
  const mes = partes.find((p) => p.type === 'month')?.value ?? '01'
  return `${ano}-${mes}`
}

const formVazio = (): FormRecorrencia => ({
  fornecedorPessoaId: '',
  valor: '',
  periodicidade: 'mensal',
  diaVencimento: '1',
  competenciaInicio: competenciaHoje(),
  competenciaFim: '',
  ativo: true,
})

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
  const router = useRouter()
  const podeCriarFornecedor = usePermissao('fornecedores:create')

  const [form, setForm] = useState<FormRecorrencia>(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    if (modoEdicao && registro) {
      setForm({
        fornecedorPessoaId: registro.fornecedorPessoaId,
        valor: String(registro.valor).replace('.', ','),
        periodicidade: registro.periodicidade === 'anual' ? 'anual' : 'mensal',
        diaVencimento: String(registro.diaVencimento || 1),
        competenciaInicio: registro.competenciaInicio || competenciaHoje(),
        competenciaFim: registro.competenciaFim || '',
        ativo: registro.ativo,
      })
    } else {
      setForm(formVazio())
    }
    setErro('')
  }, [aberto, modoEdicao, registro])

  function irCadastrarFornecedor() {
    gravarDeepLinkFornecedor({
      documento: '',
      retorno: RETORNO_RECORRENCIA_FINANCEIRA,
    })
    router.push('/fornecedores')
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.fornecedorPessoaId) {
      setErro('Selecione o fornecedor')
      return
    }
    const valor = parseDinheiro(form.valor)
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor maior que zero')
      return
    }
    const dia = Number(form.diaVencimento)
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
      setErro('Dia de vencimento deve ser entre 1 e 28')
      return
    }
    if (!form.competenciaInicio) {
      setErro('Informe a competência de início')
      return
    }
    if (form.competenciaFim && form.competenciaFim < form.competenciaInicio) {
      setErro('Competência fim não pode ser anterior ao início')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        fornecedorPessoaId: form.fornecedorPessoaId,
        valor,
        periodicidade: form.periodicidade,
        diaVencimento: dia,
        competenciaInicio: form.competenciaInicio,
        competenciaFim: form.competenciaFim || null,
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
      descricao="Quando a nota do fornecedor chegar com este valor, na vigência, a Entrada consolida sozinha."
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
            <div className="space-y-1.5">
              <ComboboxPessoa
                rotulo="Fornecedor"
                pessoas={fornecedores}
                valor={form.fornecedorPessoaId}
                aoMudar={(id) => setForm((f) => ({ ...f, fornecedorPessoaId: id }))}
                obrigatorio
              />
              {podeCriarFornecedor && (
                <button
                  type="button"
                  className="text-sm text-primary underline-offset-2 hover:underline"
                  onClick={irCadastrarFornecedor}
                >
                  Cadastrar fornecedor
                </button>
              )}
            </div>
            <InputPadrao
              rotulo="Valor"
              obrigatorio
              inputMode="decimal"
              placeholder="Ex.: 2600,00"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectPadrao
                rotulo="Periodicidade"
                obrigatorio
                valor={form.periodicidade}
                aoMudar={(v) =>
                  setForm((f) => ({
                    ...f,
                    periodicidade: v === 'anual' ? 'anual' : 'mensal',
                  }))
                }
                opcoes={OPCOES_PERIODICIDADE}
              />
              <SelectPadrao
                rotulo="Dia de vencimento"
                obrigatorio
                valor={form.diaVencimento}
                aoMudar={(v) => setForm((f) => ({ ...f, diaVencimento: v }))}
                opcoes={OPCOES_DIA}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputPadrao
                rotulo="Início (competência)"
                obrigatorio
                type="month"
                value={form.competenciaInicio}
                onChange={(e) => setForm((f) => ({ ...f, competenciaInicio: e.target.value }))}
              />
              <InputPadrao
                rotulo="Fim (competência)"
                type="month"
                value={form.competenciaFim}
                onChange={(e) => setForm((f) => ({ ...f, competenciaFim: e.target.value }))}
              />
            </div>
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
