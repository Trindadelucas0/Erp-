import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import {
  ATALHOS_PADRAO,
  CHAVES_DE_ACAO_ATALHO,
  type ChaveDaAcaoAtalho,
} from '../../compartilhado/atalhos/atalhos-padrao.js'
import {
  repositorioDeAtalhos,
  type AtalhoPersistido,
} from './repositorio-atalhos.js'

const FORMATO_TECLA = /^(F\d{1,2}|Escape|Enter|Space|Tab|Delete|Backspace|Arrow(Up|Down|Left|Right)|([A-Z0-9])|(Ctrl|Alt|Shift|Meta)\+.+)$/i

function normalizarTecla(tecla: string): string {
  const partes = tecla.split('+').map((p) => p.trim())
  const mods: string[] = []
  let principal = ''

  for (const parte of partes) {
    const lower = parte.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') mods.push('Ctrl')
    else if (lower === 'alt') mods.push('Alt')
    else if (lower === 'shift') mods.push('Shift')
    else if (lower === 'meta' || lower === 'cmd') mods.push('Meta')
    else principal = parte === 'Esc' ? 'Escape' : parte
  }

  if (principal.startsWith('f') && /^f\d+$/i.test(principal)) {
    principal = principal.toUpperCase()
  } else if (principal.length === 1) {
    principal = principal.toUpperCase()
  }

  mods.sort()
  return [...mods, principal].join('+')
}

function validarAtalhos(atalhos: AtalhoPersistido[]): void {
  if (!atalhos.length) {
    throw new ErroDaAplicacao('Informe ao menos um atalho', 400)
  }

  const chavesRecebidas = new Set(atalhos.map((a) => a.acao))
  for (const chave of CHAVES_DE_ACAO_ATALHO) {
    if (!chavesRecebidas.has(chave)) {
      throw new ErroDaAplicacao(`Atalho obrigatório ausente: ${chave}`, 400)
    }
  }

  const teclasUsadas = new Map<string, string>()

  for (const atalho of atalhos) {
    if (!CHAVES_DE_ACAO_ATALHO.includes(atalho.acao)) {
      throw new ErroDaAplicacao(`Ação inválida: ${atalho.acao}`, 400)
    }

    const tecla = normalizarTecla(atalho.tecla)
    if (!tecla || !FORMATO_TECLA.test(tecla)) {
      throw new ErroDaAplicacao(`Tecla inválida para ${atalho.acao}: ${atalho.tecla}`, 400)
    }

    if (atalho.ativo) {
      const existente = teclasUsadas.get(tecla)
      if (existente) {
        throw new ErroDaAplicacao(
          `Tecla ${tecla} duplicada entre ${existente} e ${atalho.acao}`,
          400
        )
      }
      teclasUsadas.set(tecla, atalho.acao)
    }
  }
}

export const servicoDeAtalhos = {
  async listar(): Promise<AtalhoPersistido[]> {
    return repositorioDeAtalhos.listar()
  },

  async salvar(
    atalhos: AtalhoPersistido[],
    usuarioId: string
  ): Promise<AtalhoPersistido[]> {
    const normalizados = atalhos.map((a) => ({
      ...a,
      tecla: normalizarTecla(a.tecla),
    }))

    validarAtalhos(normalizados)

    const anteriores = await repositorioDeAtalhos.listar()
    const salvos = await repositorioDeAtalhos.salvarTodos(normalizados)

    const { registrarAuditoria } = await import(
      '../../compartilhado/auditoria/registrar-auditoria.js'
    )

    await registrarAuditoria({
      usuarioId,
      acao: 'atualizar',
      entidade: 'atalho_teclado',
      entidadeId: 'global',
      valoresAntes: { atalhos: anteriores },
      valoresDepois: { atalhos: salvos },
    })

    return salvos
  },

  async restaurarPadroes(usuarioId: string): Promise<AtalhoPersistido[]> {
    const anteriores = await repositorioDeAtalhos.listar()
    const padroes = CHAVES_DE_ACAO_ATALHO.map((acao) => ({
      acao,
      tecla: ATALHOS_PADRAO[acao as ChaveDaAcaoAtalho],
      ativo: true,
    }))
    const salvos = await repositorioDeAtalhos.salvarTodos(padroes)

    const { registrarAuditoria } = await import(
      '../../compartilhado/auditoria/registrar-auditoria.js'
    )

    await registrarAuditoria({
      usuarioId,
      acao: 'restaurar_padroes',
      entidade: 'atalho_teclado',
      entidadeId: 'global',
      valoresAntes: { atalhos: anteriores },
      valoresDepois: { atalhos: salvos },
    })

    return salvos
  },
}
