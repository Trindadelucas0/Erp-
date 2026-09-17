'use client'

import { FormEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { InputPadrao } from '@/components/ui/input-padrao'
import { SelectPadrao } from '@/components/ui/select-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { TIPOS_ENDERECO_WMS } from '@/lib/endereco-wms'
import {
  mascaraCodigoNivelWms,
  rotuloNivelEstruturaWms,
  type FormGerarWms,
  type ItemEstruturaWms,
  type NivelEstruturaWms,
} from '@/lib/estrutura-wms'
import { cn } from '@/lib/utils'

const ORDEM_NIVEL = ['local', 'area', 'rua', 'bloco', 'andar'] as const

function nivelTravado(origem: NivelEstruturaWms | null | undefined, campo: (typeof ORDEM_NIVEL)[number]) {
  if (!origem) return false
  return ORDEM_NIVEL.indexOf(campo) <= ORDEM_NIVEL.indexOf(origem)
}

type Props = {
  aberto: boolean
  form: FormGerarWms
  locais: ItemEstruturaWms[]
  areas: ItemEstruturaWms[]
  ruas: ItemEstruturaWms[]
  total?: number
  exemplos?: string[]
  salvando: boolean
  erro: string
  origemNivel?: NivelEstruturaWms | null
  caminho?: string
  aoMudar: (form: FormGerarWms) => void
  aoFechar: () => void
  aoPreview: (e: FormEvent) => void
  aoConfirmar: () => void
}

function rotuloOpcao(item: ItemEstruturaWms) {
  return item.nome && item.nome !== item.codigo ? `${item.codigo} — ${item.nome}` : item.codigo
}

export function ModalGerarEstruturaWms({
  aberto,
  form,
  locais,
  areas,
  ruas,
  total,
  exemplos,
  salvando,
  erro,
  origemNivel,
  caminho,
  aoMudar,
  aoFechar,
  aoPreview,
  aoConfirmar,
}: Props) {
  const um = form.modo === 'um'
  const travaLocal = nivelTravado(origemNivel, 'local')
  const travaArea = nivelTravado(origemNivel, 'area')
  const travaRua = nivelTravado(origemNivel, 'rua')
  const travaBloco = nivelTravado(origemNivel, 'bloco')
  const travaAndar = nivelTravado(origemNivel, 'andar')
  const opcoesLocal = locais.map((l) => ({ value: l.id, label: rotuloOpcao(l) }))
  const opcoesArea = areas.map((l) => ({ value: l.id, label: rotuloOpcao(l) }))
  const opcoesRua = [
    { value: '', label: um ? 'Informar código da rua' : 'Gerar ruas da faixa' },
    ...ruas.map((l) => ({ value: l.id, label: l.codigo })),
  ]

  function soDigitos(nivel: string, valor: string) {
    return mascaraCodigoNivelWms(nivel, valor)
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={
        origemNivel
          ? `Gerar endereços abaixo de ${rotuloNivelEstruturaWms(origemNivel)}`
          : 'Cadastrar endereços'
      }
      descricao={
        origemNivel && caminho
          ? `Caminho: ${caminho}. Só a faixa abaixo deste item. O tipo fica no apartamento.`
          : 'O código nasce sozinho: LOCAL-ÁREA-RUA-BLOCO-ANDAR-AP (ex.: A-RC-20-01-2-05). O tipo fica só no apartamento.'
      }
      largura="xl"
      rodape={
        <>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <BotaoPrimario
            type="button"
            onClick={aoConfirmar}
            disabled={salvando || total == null || Boolean(erro)}
          >
            {salvando
              ? 'Gerando...'
              : total != null
                ? `Gerar ${total} endereço${total === 1 ? '' : 's'}`
                : 'Gerar'}
          </BotaoPrimario>
        </>
      }
    >
      <form id="form-gerar-wms" onSubmit={aoPreview} className="space-y-4">
        {erro && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={um ? 'default' : 'outline'}
            onClick={() => aoMudar({ ...form, modo: 'um' })}
            disabled={salvando}
          >
            Só um endereço
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!um ? 'default' : 'outline'}
            onClick={() => aoMudar({ ...form, modo: 'varios' })}
            disabled={salvando}
          >
            Vários (faixa)
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            {!travaLocal && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.novoLocal}
                  disabled={salvando}
                  onCheckedChange={(v) =>
                    aoMudar({
                      ...form,
                      novoLocal: v === true,
                      localId: v === true ? '' : form.localId,
                      novaArea: v === true ? true : form.novaArea,
                      areaId: v === true ? '' : form.areaId,
                      ruaId: '',
                    })
                  }
                />
                Novo local
              </label>
            )}
            {form.novoLocal && !travaLocal ? (
              <div className="grid gap-2">
                <InputPadrao
                  rotulo="Código do local"
                  obrigatorio
                  value={form.localCodigo}
                  onChange={(e) =>
                    aoMudar({ ...form, localCodigo: soDigitos('local', e.target.value) })
                  }
                  disabled={salvando}
                  className="font-mono"
                />
                <InputPadrao
                  rotulo="Nome do local"
                  value={form.localNome}
                  onChange={(e) => aoMudar({ ...form, localNome: e.target.value })}
                  disabled={salvando}
                />
              </div>
            ) : (
              <SelectPadrao
                rotulo="Local"
                valor={form.localId}
                aoMudar={(v) => aoMudar({ ...form, localId: v, areaId: '', ruaId: '' })}
                opcoes={opcoesLocal}
                obrigatorio
                disabled={salvando || travaLocal}
                placeholder={opcoesLocal.length ? 'Selecione' : 'Nenhum local — marque Novo local'}
              />
            )}
          </div>
          <div className="space-y-2">
            {!travaArea && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.novaArea}
                  disabled={salvando || form.novoLocal}
                  onCheckedChange={(v) =>
                    aoMudar({
                      ...form,
                      novaArea: v === true,
                      areaId: v === true ? '' : form.areaId,
                      ruaId: '',
                    })
                  }
                />
                Nova área
              </label>
            )}
            {form.novaArea && !travaArea ? (
              <div className="grid gap-2">
                <InputPadrao
                  rotulo="Código da área"
                  obrigatorio
                  value={form.areaCodigo}
                  onChange={(e) =>
                    aoMudar({ ...form, areaCodigo: soDigitos('area', e.target.value) })
                  }
                  disabled={salvando}
                  className="font-mono"
                />
                <InputPadrao
                  rotulo="Nome da área"
                  value={form.areaNome}
                  onChange={(e) => aoMudar({ ...form, areaNome: e.target.value })}
                  disabled={salvando}
                />
              </div>
            ) : (
              <SelectPadrao
                rotulo="Área"
                valor={form.areaId}
                aoMudar={(v) => aoMudar({ ...form, areaId: v, ruaId: '' })}
                opcoes={opcoesArea}
                obrigatorio
                disabled={salvando || travaArea || (!form.localId && !form.novoLocal)}
                placeholder={form.localId || form.novoLocal ? 'Selecione' : 'Selecione o local'}
              />
            )}
          </div>
        </div>

        {!travaRua && (
        <SelectPadrao
          rotulo="Rua cadastrada"
          valor={form.ruaId}
          aoMudar={(v) => aoMudar({ ...form, ruaId: v })}
          opcoes={opcoesRua}
          disabled={salvando || form.novaArea || (!form.areaId && !form.novaArea)}
        />
        )}
        {!form.ruaId && !travaRua && (
          <div className={cn('grid gap-3', um ? 'sm:grid-cols-1' : 'sm:grid-cols-2')}>
            <InputPadrao
              rotulo={um ? 'Rua' : 'Ruas — inicial'}
              value={form.ruaInicio}
              onChange={(e) => aoMudar({ ...form, ruaInicio: soDigitos('rua', e.target.value) })}
              disabled={salvando}
              className="font-mono"
            />
            {!um && (
              <InputPadrao
                rotulo="Ruas — final"
                value={form.ruaFim}
                onChange={(e) => aoMudar({ ...form, ruaFim: soDigitos('rua', e.target.value) })}
                disabled={salvando}
                className="font-mono"
              />
            )}
          </div>
        )}

        <div className={cn('grid gap-3', um ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          <InputPadrao
            rotulo={um ? 'Bloco' : 'Blocos — inicial'}
            value={form.blocoInicio}
            onChange={(e) => aoMudar({ ...form, blocoInicio: soDigitos('bloco', e.target.value) })}
            disabled={salvando || travaBloco}
            className="font-mono"
          />
          {!um && (
            <InputPadrao
              rotulo="Blocos — final"
              value={form.blocoFim}
              onChange={(e) => aoMudar({ ...form, blocoFim: soDigitos('bloco', e.target.value) })}
              disabled={salvando || travaBloco}
              className="font-mono"
            />
          )}
          <InputPadrao
            rotulo={um ? 'Andar' : 'Andares — inicial'}
            value={form.andarInicio}
            onChange={(e) => aoMudar({ ...form, andarInicio: soDigitos('andar', e.target.value) })}
            disabled={salvando || travaAndar}
            className="font-mono"
          />
          {!um && (
            <InputPadrao
              rotulo="Andares — final"
              value={form.andarFim}
              onChange={(e) => aoMudar({ ...form, andarFim: soDigitos('andar', e.target.value) })}
              disabled={salvando || travaAndar}
              className="font-mono"
            />
          )}
          <InputPadrao
            rotulo={um ? 'Apartamento' : 'Apartamentos — inicial'}
            value={form.apartamentoInicio}
            onChange={(e) =>
              aoMudar({ ...form, apartamentoInicio: soDigitos('apartamento', e.target.value) })
            }
            disabled={salvando}
            className="font-mono"
          />
          {!um && (
            <InputPadrao
              rotulo="Apartamentos — final"
              value={form.apartamentoFim}
              onChange={(e) =>
                aoMudar({ ...form, apartamentoFim: soDigitos('apartamento', e.target.value) })
              }
              disabled={salvando}
              className="font-mono"
            />
          )}
        </div>
        <SelectPadrao
          rotulo="Tipo padrão"
          valor={form.tipoPadrao}
          aoMudar={(v) => aoMudar({ ...form, tipoPadrao: v })}
          opcoes={TIPOS_ENDERECO_WMS}
          disabled={salvando}
        />
        {total != null && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium">
              Serão criados até {total} endereço{total === 1 ? '' : 's'} (já existentes são
              pulados).
            </p>
            <ul className="mt-2 font-mono text-xs">
              {(exemplos ?? []).map((ex) => (
                <li key={ex}>{ex}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  )
}
