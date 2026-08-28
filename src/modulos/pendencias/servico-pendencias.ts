/**
 * Agrega pendências operacionais a partir do estado vivo do banco.
 * Sem tabela Notificacao — item some quando o estado deixa de ser pendente.
 */
import { Prisma } from '@prisma/client'
import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { repositorioDePermissoes } from '../permissoes/repositorio-permissoes.js'
import { repositorioDeUsuarios } from '../usuarios/repositorio-usuarios.js'
import { usuarioEhAdmin } from '../../compartilhado/paginas/registro-de-paginas.js'
import { STATUS_APROVACAO } from '../clientes/regras-cliente.js'
import {
  STATUS_AGUARDANDO_CHEGADA,
  STATUS_AGUARDANDO_CONTAGEM,
  STATUS_CONTAGEM_DIVERGENTE,
  STATUS_CONTAGEM_OK,
  STATUS_CONSOLIDADA,
} from '../entrada-notas/status-entrada-contagem.js'
import { repositorioDeRecorrenciasFinanceiras } from '../recorrencias-financeiras/repositorio-recorrencias-financeiras.js'
import {
  adicionarDias,
  competenciaDeData,
  formatarMoedaBr,
  formatarQtd,
  inicioDoDia,
  isoDataLocal,
  urgenciaPorVencimento,
} from './datas-pendencias.js'
import { tiposParaTela } from './mapa-tela-pendencias.js'
import {
  DIAS_A_VENCER,
  ORDEM_URGENCIA,
  ROTULO_TIPO_PENDENCIA,
  type ItemPendencia,
  type ListaPendencias,
  type ResumoPendencias,
  type TipoPendencia,
} from './tipos-pendencias.js'

type ContextoPermissao = {
  financeiro: boolean
  compras: boolean
  estoque: boolean
  clientes: boolean
  admin: boolean
}

async function resolverPermissoes(idDoUsuario: string): Promise<ContextoPermissao> {
  const usuario = await repositorioDeUsuarios.buscarPorId(idDoUsuario)
  const admin = Boolean(usuario && usuarioEhAdmin(usuario.roles))
  if (admin) {
    return {
      financeiro: true,
      compras: true,
      estoque: true,
      clientes: true,
      admin: true,
    }
  }
  const [financeiro, compras, estoque, clientes] = await Promise.all([
    repositorioDePermissoes.usuarioPossuiPermissao(idDoUsuario, 'financeiro:view'),
    repositorioDePermissoes.usuarioPossuiPermissao(idDoUsuario, 'compras:view'),
    repositorioDePermissoes.usuarioPossuiPermissao(idDoUsuario, 'estoque:view'),
    repositorioDePermissoes.usuarioPossuiPermissao(idDoUsuario, 'clientes:view'),
  ])
  return { financeiro, compras, estoque, clientes, admin }
}

function decimalParaNumero(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  return Number(v)
}

function ordenarItens(itens: ItemPendencia[]): ItemPendencia[] {
  return [...itens].sort((a, b) => {
    const u = ORDEM_URGENCIA[a.urgencia] - ORDEM_URGENCIA[b.urgencia]
    if (u !== 0) return u
    return a.titulo.localeCompare(b.titulo, 'pt-BR')
  })
}

function filtrarTiposPermitidos(
  tipos: TipoPendencia[] | undefined,
  perm: ContextoPermissao
): TipoPendencia[] | undefined {
  if (!tipos) return undefined
  return tipos.filter((t) => tipoPermitido(t, perm))
}

function tipoPermitido(tipo: TipoPendencia, perm: ContextoPermissao): boolean {
  switch (tipo) {
    case 'conta_pagar_vencida':
    case 'conta_pagar_a_vencer':
    case 'conta_receber_vencida':
    case 'conta_receber_a_vencer':
    case 'recorrencia_aguardando':
      return perm.financeiro
    case 'credito_fornecedor':
    case 'pendencia_fornecedor':
    case 'pedido_anexo':
    case 'pedido_aprovar':
    case 'contagem_sessao':
    case 'contagem_baixar':
    case 'divergencia_bloquear':
    case 'problema_entrada':
    case 'fila_entrada_analise':
    case 'fila_entrada_chegada':
    case 'fila_entrada_contagem':
    case 'fila_entrada_problemas':
    case 'fila_entrada_bloqueio':
      return perm.compras
    case 'estoque_bloqueado':
      return perm.estoque || perm.compras
    case 'cliente_aprovacao':
    case 'cliente_assinatura':
      return perm.admin
    default:
      return false
  }
}

async function coletarFinanceiro(
  companyId: string,
  hoje: Date
): Promise<ItemPendencia[]> {
  const inicio = inicioDoDia(hoje)
  const fimJanela = adicionarDias(inicio, DIAS_A_VENCER)
  const fimJanelaFimDia = new Date(fimJanela)
  fimJanelaFimDia.setHours(23, 59, 59, 999)

  const [parcelasPagar, parcelasReceber] = await Promise.all([
    clientePrisma.contaPagarParcela.findMany({
      where: {
        status: { in: ['aberta', 'parcial'] },
        vencimento: { lte: fimJanelaFimDia },
        contaPagar: {
          companyId,
          status: { in: ['aberto', 'parcial'] },
        },
      },
      include: {
        contaPagar: {
          select: {
            id: true,
            codigo: true,
            numeroDocumento: true,
            pessoa: { select: { nome: true, nomeFantasia: true } },
          },
        },
      },
      orderBy: { vencimento: 'asc' },
      take: 100,
    }),
    clientePrisma.contaReceberParcela.findMany({
      where: {
        status: { in: ['aberta', 'parcial'] },
        vencimento: { lte: fimJanelaFimDia },
        contaReceber: {
          companyId,
          status: { in: ['aberto', 'parcial'] },
        },
      },
      include: {
        contaReceber: {
          select: {
            id: true,
            codigo: true,
            numeroDocumento: true,
            pessoa: { select: { nome: true, nomeFantasia: true } },
          },
        },
      },
      orderBy: { vencimento: 'asc' },
      take: 100,
    }),
  ])

  const itens: ItemPendencia[] = []
  const hojeIso = isoDataLocal(inicio)
  const ateIso = isoDataLocal(fimJanela)

  for (const p of parcelasPagar) {
    const urg = urgenciaPorVencimento(p.vencimento, hoje)
    if (!urg || urg === 'fila') continue
    const nome =
      p.contaPagar.pessoa?.nomeFantasia || p.contaPagar.pessoa?.nome || 'Sem fornecedor'
    const doc = p.contaPagar.numeroDocumento || p.numeroDocumento || p.contaPagar.codigo
    const valor = decimalParaNumero(p.valor) - decimalParaNumero(p.valorPago)
    const dias = Math.round(
      (inicioDoDia(p.vencimento).getTime() - inicio.getTime()) / 86400000
    )
    const tipo: TipoPendencia =
      urg === 'vencido' ? 'conta_pagar_vencida' : 'conta_pagar_a_vencer'
    const href =
      urg === 'vencido'
        ? `/contas-a-pagar?vencimentoAte=${hojeIso}`
        : `/contas-a-pagar?vencimentoDe=${hojeIso}&vencimentoAte=${ateIso}`
    const titulo =
      urg === 'vencido'
        ? `Pagar vencido — ${doc}`
        : urg === 'hoje'
          ? `Pagar hoje — ${doc}`
          : `Pagar em ${dias} dia(s) — ${doc}`
    itens.push({
      id: `cap:${p.id}`,
      tipo,
      urgencia: urg,
      titulo,
      descricao: `${nome} · ${formatarMoedaBr(valor)}`,
      href,
    })
  }

  for (const p of parcelasReceber) {
    const urg = urgenciaPorVencimento(p.vencimento, hoje)
    if (!urg || urg === 'fila') continue
    const nome =
      p.contaReceber.pessoa?.nomeFantasia || p.contaReceber.pessoa?.nome || 'Sem cliente'
    const doc = p.contaReceber.numeroDocumento || p.numeroDocumento || p.contaReceber.codigo
    const valor = decimalParaNumero(p.valor) - decimalParaNumero(p.valorPago)
    const dias = Math.round(
      (inicioDoDia(p.vencimento).getTime() - inicio.getTime()) / 86400000
    )
    const tipo: TipoPendencia =
      urg === 'vencido' ? 'conta_receber_vencida' : 'conta_receber_a_vencer'
    const href =
      urg === 'vencido'
        ? `/contas-a-receber?vencimentoAte=${hojeIso}`
        : `/contas-a-receber?vencimentoDe=${hojeIso}&vencimentoAte=${ateIso}`
    const titulo =
      urg === 'vencido'
        ? `Receber vencido — ${doc}`
        : urg === 'hoje'
          ? `Receber hoje — ${doc}`
          : `Receber em ${dias} dia(s) — ${doc}`
    itens.push({
      id: `car:${p.id}`,
      tipo,
      urgencia: urg,
      titulo,
      descricao: `${nome} · ${formatarMoedaBr(valor)}`,
      href,
    })
  }

  return itens
}

async function coletarRecorrencia(companyId: string, hoje: Date): Promise<ItemPendencia[]> {
  const competencia = competenciaDeData(hoje)
  const agenda = await repositorioDeRecorrenciasFinanceiras.montarAgenda(
    companyId,
    competencia
  )
  return agenda.itens
    .filter((i) => i.situacao === 'aguardando')
    .map((i) => ({
      id: `rec:${i.recorrenciaId}:${competencia}`,
      tipo: 'recorrencia_aguardando' as const,
      urgencia: 'fila' as const,
      titulo: `Recorrência aguardando nota — ${i.fornecedorNome}`,
      descricao: `${i.fornecedorNome} · ${formatarMoedaBr(i.valor)} · dia ${i.diaVencimento}`,
      href: '/configuracoes?aba=financeiro&secao=recorrencia',
    }))
}

async function coletarCompras(companyId: string, hoje: Date): Promise<ItemPendencia[]> {
  const inicio = inicioDoDia(hoje)
  const fimJanela = adicionarDias(inicio, DIAS_A_VENCER)
  fimJanela.setHours(23, 59, 59, 999)

  const [
    creditos,
    pendencias,
    anexos,
    pedidosAprovar,
    sessoes,
    notasBaixar,
    notasDivergencia,
    problemas,
  ] = await Promise.all([
    clientePrisma.creditoFornecedor.findMany({
      where: {
        companyId,
        saldo: { gt: 0 },
        vencimento: { lte: fimJanela },
      },
      include: {
        fornecedor: { select: { id: true, nome: true, nomeFantasia: true } },
      },
      take: 50,
    }),
    clientePrisma.pendenciaFornecedor.findMany({
      where: { companyId, resolvido: false },
      include: {
        fornecedor: { select: { id: true, nome: true, nomeFantasia: true } },
        produto: { select: { nomeVenda: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    clientePrisma.pedidoCompraAnexoFornecedor.findMany({
      where: {
        tipoAnexo: 'documento_fornecedor',
        statusConferencia: { in: ['pendente', 'ajuste_solicitado'] },
        pedidoCompra: {
          companyId,
          status: { in: ['enviado', 'aprovado', 'parcial'] },
        },
      },
      include: {
        pedidoCompra: {
          select: {
            id: true,
            numero: true,
            fornecedor: { select: { nome: true, nomeFantasia: true } },
          },
        },
      },
      take: 50,
    }),
    clientePrisma.pedidoCompra.findMany({
      where: {
        companyId,
        status: 'enviado',
        anexosFornecedor: { some: { statusConferencia: 'aprovado' } },
      },
      include: {
        fornecedor: { select: { nome: true, nomeFantasia: true } },
      },
      take: 50,
    }),
    clientePrisma.contagemEntrada.findMany({
      where: {
        companyId,
        status: { in: ['aberta', 'em_andamento'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    clientePrisma.nfeRecebida.findMany({
      where: {
        companyId,
        statusEntrada: { in: [STATUS_CONTAGEM_OK, STATUS_CONTAGEM_DIVERGENTE] },
        contagensEntradaNotas: {
          some: {
            contagemEntrada: {
              status: { in: ['ok', 'divergente'] },
              baixadaEm: null,
            },
          },
        },
      },
      select: {
        id: true,
        chaveNfe: true,
        nomeEmitente: true,
        statusEntrada: true,
      },
      take: 40,
    }),
    clientePrisma.nfeRecebida.findMany({
      where: {
        companyId,
        statusEntrada: STATUS_CONTAGEM_DIVERGENTE,
        contagensEntradaNotas: {
          some: {
            contagemEntrada: {
              status: 'divergente',
              baixadaEm: { not: null },
            },
          },
        },
      },
      select: {
        id: true,
        chaveNfe: true,
        nomeEmitente: true,
      },
      take: 40,
    }),
    clientePrisma.nfeRecebida.findMany({
      where: { companyId, statusEntrada: 'com_problema' },
      select: {
        id: true,
        chaveNfe: true,
        nomeEmitente: true,
      },
      take: 40,
    }),
  ])

  const itens: ItemPendencia[] = []

  for (const c of creditos) {
    if (!c.vencimento) continue
    const urg = urgenciaPorVencimento(c.vencimento, hoje)
    if (!urg) continue
    const nome = c.fornecedor.nomeFantasia || c.fornecedor.nome
    itens.push({
      id: `cred:${c.id}`,
      tipo: 'credito_fornecedor',
      urgencia: urg,
      titulo: `Crédito ${urg === 'vencido' ? 'vencido' : urg === 'hoje' ? 'vence hoje' : 'a vencer'} — ${nome}`,
      descricao: `Saldo ${formatarMoedaBr(decimalParaNumero(c.saldo))}`,
      href: '/pedidos-compra',
    })
  }

  for (const p of pendencias) {
    const nome = p.fornecedor.nomeFantasia || p.fornecedor.nome
    const prod = p.produto?.nomeVenda ? ` · ${p.produto.nomeVenda}` : ''
    itens.push({
      id: `pend:${p.id}`,
      tipo: 'pendencia_fornecedor',
      urgencia: 'fila',
      titulo: `Pendência — ${nome}`,
      descricao: `${p.descricao}${prod}`,
      href: '/pedidos-compra',
    })
  }

  for (const a of anexos) {
    const nome =
      a.pedidoCompra.fornecedor?.nomeFantasia ||
      a.pedidoCompra.fornecedor?.nome ||
      'Fornecedor'
    const status =
      a.statusConferencia === 'ajuste_solicitado' ? 'ajuste solicitado' : 'aguardando conferência'
    itens.push({
      id: `anexo:${a.id}`,
      tipo: 'pedido_anexo',
      urgencia: 'fila',
      titulo: `Pedido #${a.pedidoCompra.numero} — ${status}`,
      descricao: nome,
      href: `/pedidos-compra/${a.pedidoCompra.id}`,
    })
  }

  for (const ped of pedidosAprovar) {
    const nome = ped.fornecedor?.nomeFantasia || ped.fornecedor?.nome || 'Fornecedor'
    itens.push({
      id: `aprovar:${ped.id}`,
      tipo: 'pedido_aprovar',
      urgencia: 'fila',
      titulo: `Aprovar pedido #${ped.numero}`,
      descricao: nome,
      href: `/pedidos-compra/${ped.id}`,
    })
  }

  for (const s of sessoes) {
    itens.push({
      id: `sessao:${s.id}`,
      tipo: 'contagem_sessao',
      urgencia: 'fila',
      titulo:
        s.status === 'em_andamento'
          ? 'Contagem em andamento'
          : 'Contagem aberta',
      descricao: 'Continuar na tela Contagens',
      href: `/contagens/${s.id}`,
    })
  }

  for (const n of notasBaixar) {
    itens.push({
      id: `baixar:${n.id}`,
      tipo: 'contagem_baixar',
      urgencia: 'fila',
      titulo:
        n.statusEntrada === STATUS_CONTAGEM_DIVERGENTE
          ? 'Baixar contagem (divergente)'
          : 'Baixar contagem (OK)',
      descricao: n.nomeEmitente || n.chaveNfe.slice(-8),
      href: `/entrada-notas/${n.id}`,
    })
  }

  for (const n of notasDivergencia) {
    itens.push({
      id: `div:${n.id}`,
      tipo: 'divergencia_bloquear',
      urgencia: 'vencido',
      titulo: 'Divergência — bloquear estoque',
      descricao: n.nomeEmitente || n.chaveNfe.slice(-8),
      href: `/entrada-notas/${n.id}`,
    })
  }

  for (const n of problemas) {
    itens.push({
      id: `prob:${n.id}`,
      tipo: 'problema_entrada',
      urgencia: 'fila',
      titulo: 'Nota com problema',
      descricao: n.nomeEmitente || n.chaveNfe.slice(-8),
      href: `/entrada-notas/${n.id}`,
    })
  }

  return itens
}

async function coletarFilasEntrada(companyId: string): Promise<ItemPendencia[]> {
  const [
    analise,
    chegada,
    contagem,
    problemas,
    bloqueioNotas,
  ] = await Promise.all([
    clientePrisma.nfeRecebida.count({
      where: {
        companyId,
        statusEntrada: { in: ['pendente', 'em_analise', 'stand_by'] },
      },
    }),
    clientePrisma.nfeRecebida.count({
      where: { companyId, statusEntrada: STATUS_AGUARDANDO_CHEGADA },
    }),
    clientePrisma.nfeRecebida.count({
      where: { companyId, statusEntrada: STATUS_AGUARDANDO_CONTAGEM },
    }),
    clientePrisma.nfeRecebida.count({
      where: { companyId, statusEntrada: 'com_problema' },
    }),
    clientePrisma.nfeRecebida.findMany({
      where: {
        companyId,
        statusEntrada: STATUS_CONSOLIDADA,
        divergenciaDesfecho: 'bloqueio',
      },
      select: { id: true, analiseJson: true },
      take: 200,
    }),
  ])

  const bloqueio = bloqueioNotas.filter((n) => {
    const gestao = (
      n.analiseJson as { divergenciaGestao?: { desbloqueioEm?: string } } | null
    )?.divergenciaGestao
    return !gestao?.desbloqueioEm?.trim()
  }).length

  const itens: ItemPendencia[] = []
  if (analise > 0) {
    itens.push({
      id: 'fila:analise',
      tipo: 'fila_entrada_analise',
      urgencia: 'fila',
      titulo: `${analise} nota(s) em análise`,
      descricao: 'Abrir painel Em análise',
      href: '/entrada-notas?painel=analise',
    })
  }
  if (chegada > 0) {
    itens.push({
      id: 'fila:chegada',
      tipo: 'fila_entrada_chegada',
      urgencia: 'fila',
      titulo: `${chegada} nota(s) aguardando chegada`,
      descricao: 'Conferir preço/nome e liberar',
      href: '/entrada-notas?painel=aguardando_chegada',
    })
  }
  if (contagem > 0) {
    itens.push({
      id: 'fila:contagem',
      tipo: 'fila_entrada_contagem',
      urgencia: 'fila',
      titulo: `${contagem} nota(s) liberada(s) para contagem`,
      descricao: 'Iniciar ou continuar contagem',
      href: '/entrada-notas?painel=contagem',
    })
  }
  if (problemas > 0) {
    itens.push({
      id: 'fila:problemas',
      tipo: 'fila_entrada_problemas',
      urgencia: 'fila',
      titulo: `${problemas} nota(s) com problemas`,
      descricao: 'Abrir painel Com problemas',
      href: '/entrada-notas?painel=problemas',
    })
  }
  if (bloqueio > 0) {
    itens.push({
      id: 'fila:bloqueio',
      tipo: 'fila_entrada_bloqueio',
      urgencia: 'vencido',
      titulo: `${bloqueio} entrada(s) com estoque bloqueado`,
      descricao: 'Desbloquear no detalhe ou Auditoria',
      href: '/entrada-notas?painel=consolidada',
    })
  }
  return itens
}

async function coletarEstoque(companyId: string): Promise<ItemPendencia[]> {
  const saldos = await clientePrisma.estoqueSaldo.findMany({
    where: { companyId, qtdBloqueada: { gt: 0 } },
    include: {
      produto: { select: { id: true, nomeVenda: true, sku: true } },
    },
    take: 40,
  })
  return saldos.map((s) => ({
    id: `est:${s.produtoId}`,
    tipo: 'estoque_bloqueado' as const,
    urgencia: 'vencido' as const,
    titulo: `Estoque bloqueado — ${s.produto.nomeVenda}`,
    descricao: `Qtd bloqueada ${formatarQtd(decimalParaNumero(s.qtdBloqueada))}${s.produto.sku ? ` · SKU ${s.produto.sku}` : ''}`,
    href: `/estoque?produtoId=${s.produtoId}`,
  }))
}

async function coletarClientes(companyId: string): Promise<ItemPendencia[]> {
  const [pendentes, assinatura] = await Promise.all([
    clientePrisma.pessoa.findMany({
      where: {
        companyId,
        papeis: {
          some: {
            papel: 'cliente',
            dadosCliente: { statusAprovacao: STATUS_APROVACAO.PENDENTE },
          },
        },
      },
      select: { id: true, nome: true, nomeFantasia: true },
      take: 40,
    }),
    clientePrisma.pessoa.findMany({
      where: {
        companyId,
        papeis: {
          some: {
            papel: 'cliente',
            dadosCliente: { statusAprovacao: STATUS_APROVACAO.AGUARDANDO_ASSINATURA },
          },
        },
      },
      select: { id: true, nome: true, nomeFantasia: true },
      take: 40,
    }),
  ])

  return [
    ...pendentes.map((c) => ({
      id: `cli-apr:${c.id}`,
      tipo: 'cliente_aprovacao' as const,
      urgencia: 'fila' as const,
      titulo: `Aprovar cliente — ${c.nomeFantasia || c.nome}`,
      descricao: 'Cadastro pendente de aprovação',
      href: '/clientes/aprovacao',
    })),
    ...assinatura.map((c) => ({
      id: `cli-ass:${c.id}`,
      tipo: 'cliente_assinatura' as const,
      urgencia: 'fila' as const,
      titulo: `Assinatura pendente — ${c.nomeFantasia || c.nome}`,
      descricao: 'Aguardando assinatura do termo',
      href: '/clientes/aprovacao',
    })),
  ]
}

async function coletarTodas(
  companyId: string,
  perm: ContextoPermissao,
  hoje: Date = new Date()
): Promise<ItemPendencia[]> {
  const partes: Promise<ItemPendencia[]>[] = []

  if (perm.financeiro) {
    partes.push(coletarFinanceiro(companyId, hoje))
    partes.push(coletarRecorrencia(companyId, hoje))
  }
  if (perm.compras) {
    partes.push(coletarCompras(companyId, hoje))
    partes.push(coletarFilasEntrada(companyId))
  }
  if (perm.estoque || perm.compras) {
    partes.push(coletarEstoque(companyId))
  }
  if (perm.admin) {
    partes.push(coletarClientes(companyId))
  }

  const listas = await Promise.all(partes)
  return ordenarItens(listas.flat())
}

function aplicarFiltroTipos(
  itens: ItemPendencia[],
  tipos: TipoPendencia[] | undefined
): ItemPendencia[] {
  if (!tipos) return itens
  const set = new Set(tipos)
  return itens.filter((i) => set.has(i.tipo))
}

async function listar(opcoes: {
  companyId: string
  idDoUsuario: string
  tela?: string | null
  limite?: number
  pagina?: number
}): Promise<ListaPendencias> {
  const perm = await resolverPermissoes(opcoes.idDoUsuario)
  let todos = await coletarTodas(opcoes.companyId, perm)

  const mapa = tiposParaTela(opcoes.tela ?? null)
  if (mapa === null && opcoes.tela) {
    // tela sem dock / sem fila — lista vazia se pediu filtro de tela
    if (opcoes.tela !== '/pendencias' && !opcoes.tela.startsWith('/pendencias')) {
      return { itens: [], total: 0, pagina: 1, limite: opcoes.limite ?? 50 }
    }
  }
  if (Array.isArray(mapa)) {
    const tipos = filtrarTiposPermitidos(mapa, perm)
    todos = aplicarFiltroTipos(todos, tipos)
  }

  const pagina = Math.max(1, opcoes.pagina ?? 1)
  const limite = Math.min(100, Math.max(1, opcoes.limite ?? 50))
  const inicio = (pagina - 1) * limite
  return {
    itens: todos.slice(inicio, inicio + limite),
    total: todos.length,
    pagina,
    limite,
  }
}

async function resumo(opcoes: {
  companyId: string
  idDoUsuario: string
}): Promise<ResumoPendencias> {
  const perm = await resolverPermissoes(opcoes.idDoUsuario)
  const todos = await coletarTodas(opcoes.companyId, perm)
  const porTipo: Partial<Record<TipoPendencia, number>> = {}
  for (const item of todos) {
    porTipo[item.tipo] = (porTipo[item.tipo] ?? 0) + 1
  }
  return { total: todos.length, porTipo }
}

export const servicoDePendencias = {
  listar,
  resumo,
  ROTULO_TIPO_PENDENCIA,
}
