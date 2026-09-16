'use client'

import { FormEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import {
  completarCodigoNivelWms,
  mascaraCodigoNivelWms,
  ROTULOS_NIVEL_ESTRUTURA_WMS,
  type NivelEstruturaWms,
} from '@/lib/estrutura-wms'
import { TIPOS_ENDERECO_WMS } from '@/lib/endereco-wms'

const STATUS_OPCOES = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'bloqueado', label: 'Bloqueado' },
  { value: 'inativo', label: 'Inativo' },
]

type Props = {
  aberto: boolean
  titulo: string
  nivel: NivelEstruturaWms | 'apartamento'
  hierarquia?: string
  codigo: string
  nome: string
  status: string
  tipoEndereco?: string
  salvando: boolean
  erro: string
  aoMudarCodigo: (v: string) => void
  aoMudarNome: (v: string) => void
  aoMudarStatus: (v: string) => void
  aoMudarTipo?: (v: string) => void
  aoFechar: () => void
  aoSalvar: (e: FormEvent) => void
}

export function ModalNivelWms({
  aberto,
  titulo,
  nivel,
  hierarquia,
  codigo,
  nome,
  status,
  tipoEndereco,
  salvando,
  erro,
  aoMudarCodigo,
  aoMudarNome,
  aoMudarStatus,
  aoMudarTipo,
  aoFechar,
  aoSalvar,
}: Props) {
  const ehAp = nivel === 'apartamento'
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      largura="md"
      rodape={
        <>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <BotaoPrimario type="submit" form="form-nivel-wms" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </BotaoPrimario>
        </>
      }
    >
      <form id="form-nivel-wms" onSubmit={aoSalvar} className="space-y-4">
        {hierarquia && (
          <p className="text-sm text-muted-foreground">
            Hierarquia: <span className="font-mono">{hierarquia}</span>
          </p>
        )}
        {erro && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
        )}
        <InputPadrao
          rotulo="Código"
          obrigatorio
          value={codigo}
          onChange={(e) => aoMudarCodigo(mascaraCodigoNivelWms(nivel, e.target.value))}
          onBlur={() => aoMudarCodigo(completarCodigoNivelWms(nivel, codigo))}
          disabled={salvando}
          className="font-mono"
        />
        {!ehAp && nivel !== 'rua' && nivel !== 'bloco' && (
          <InputPadrao
            rotulo="Nome"
            value={nome}
            onChange={(e) => aoMudarNome(e.target.value)}
            disabled={salvando}
          />
        )}
        {ehAp && (
          <SelectPadrao
            rotulo="Tipo de endereço"
            valor={tipoEndereco ?? ''}
            aoMudar={(v) => aoMudarTipo?.(v)}
            opcoes={TIPOS_ENDERECO_WMS}
            obrigatorio
            disabled={salvando}
          />
        )}
        <SelectPadrao
          rotulo="Situação"
          valor={status}
          aoMudar={aoMudarStatus}
          opcoes={STATUS_OPCOES}
          disabled={salvando}
        />
        <p className="text-xs text-muted-foreground">
          {ehAp
            ? 'O código completo é montado automaticamente.'
            : `Nível: ${ROTULOS_NIVEL_ESTRUTURA_WMS[nivel]}`}
        </p>
      </form>
    </Modal>
  )
}
