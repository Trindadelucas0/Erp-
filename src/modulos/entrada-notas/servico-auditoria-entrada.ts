import { clientePrisma } from '../../compartilhado/banco-dados/cliente-prisma.js'
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { exigirAcessoPagina } from '../acesso/servico-acesso-aba.js'

export async function auditarEntrada(companyId: string, notaId: string, usuarioId: string) {
  await exigirAcessoPagina(usuarioId, 'auditoria-entradas')
  const where = { id: notaId, companyId }
  const nota = await clientePrisma.nfeRecebida.findFirst({ where })
  if (!nota) throw new ErroDaAplicacao('Nota não encontrada', 404)
  if (!['nfe55', 'nfse'].includes(nota.tipoDocumento) || nota.statusEntrada !== 'entrada_consolidada') {
    throw new ErroDaAplicacao('Somente NF-e e NFS-e consolidadas podem ser auditadas', 409)
  }
  if (!nota.auditadaEm) {
    const usuario = await clientePrisma.user.findUniqueOrThrow({ where: { id: usuarioId } })
    const alteracao = await clientePrisma.nfeRecebida.updateMany({
      where: { ...where, statusEntrada: 'entrada_consolidada', tipoDocumento: { in: ['nfe55', 'nfse'] }, auditadaEm: null },
      data: { auditadaEm: new Date(), auditadaPorId: usuarioId, auditadaPorNome: usuario.name },
    })
    if (alteracao.count > 0) {
      await registrarAuditoria({ usuarioId, acao: 'auditar', entidade: 'entrada_nota', entidadeId: notaId })
    }
  }
  const atual = await clientePrisma.nfeRecebida.findFirst({ where,
    select: { id: true, auditadaEm: true, auditadaPorId: true, auditadaPorNome: true },
  })
  if (!atual?.auditadaEm) throw new ErroDaAplicacao('A nota não está mais disponível para auditoria', 409)
  return { nota: atual }
}
