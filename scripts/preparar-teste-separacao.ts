/**
 * Cria um produto só de teste, estoque e uma Separação de 2 UN para o admin.
 * Não altera senha. Não mexe em produto real.
 *
 * npx tsx --import ./scripts/carregar-url-do-banco.ts scripts/preparar-teste-separacao.ts
 */
import { clientePrisma } from '../src/compartilhado/banco-dados/cliente-prisma.js'
import { servicoDeEstoque } from '../src/modulos/estoque/servico-estoque.js'
import { servicoDeRequisicoesWms } from '../src/modulos/requisicoes-wms/servico-requisicoes-wms.js'

const EMAIL_ADMIN = 'admin@erp.local'
const SKU = 'TST-SEP'
const BARRAS = '7890000000001'
const CHAVE_ESTOQUE = 'teste-separacao:entrada'

function numeroRequisicao(numero: number) {
  return `REQ-${String(numero).padStart(5, '0')}`
}

async function empresaDoAdmin(adminId: string) {
  const vinculos = await clientePrisma.userCompany.findMany({
    where: { userId: adminId },
    include: { company: true },
  })
  const ligada = vinculos.find((v) => v.company.active)?.company
  if (ligada) return { company: ligada, vinculou: false }

  const primeira = await clientePrisma.company.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
  if (!primeira) {
    throw new Error('Nenhuma empresa ativa no banco. Cadastre uma empresa antes de testar.')
  }
  await clientePrisma.userCompany.create({
    data: { userId: adminId, companyId: primeira.id },
  })
  return { company: primeira, vinculou: true }
}

async function garantirEstoque(companyId: string, produtoId: string, usuarioId: string) {
  const atual = await servicoDeEstoque.obterSaldosAtuais(companyId, produtoId)
  if (atual.saldos.qtdDisponivel >= 10) return atual.saldos.qtdDisponivel

  await servicoDeEstoque.registrarMovimentoEstoque({
    companyId,
    produtoId,
    dimensao: 'fisico',
    tipoMovimento: 'inventario',
    quantidade: 10,
    origem: 'inventario',
    chaveIdempotencia: CHAVE_ESTOQUE,
    observacao: 'Entrada do produto de teste da Separação',
    usuarioId,
  })

  const depois = await servicoDeEstoque.obterSaldosAtuais(companyId, produtoId)
  if (depois.saldos.qtdDisponivel >= 10) return depois.saldos.qtdDisponivel

  await servicoDeEstoque.registrarMovimentoEstoque({
    companyId,
    produtoId,
    dimensao: 'fisico',
    tipoMovimento: 'inventario',
    quantidade: 10,
    origem: 'inventario',
    chaveIdempotencia: `${CHAVE_ESTOQUE}:${Date.now()}`,
    observacao: 'Reforço do produto de teste da Separação',
    usuarioId,
  })
  const reforco = await servicoDeEstoque.obterSaldosAtuais(companyId, produtoId)
  return reforco.saldos.qtdDisponivel
}

async function main() {
  const admin = await clientePrisma.user.findUnique({ where: { email: EMAIL_ADMIN } })
  if (!admin) {
    throw new Error(
      'Usuário admin@erp.local não existe. Não rode o seed daqui: ele redefine a senha.'
    )
  }

  const { company, vinculou } = await empresaDoAdmin(admin.id)

  const produto = await clientePrisma.produto.upsert({
    where: { sku_companyId: { sku: SKU, companyId: company.id } },
    update: {
      nomeVenda: 'Teste separação',
      marca: 'Teste',
      unidade: 'UN',
      codigoBarras: BARRAS,
      controlaEstoque: true,
      ativo: true,
    },
    create: {
      companyId: company.id,
      sku: SKU,
      nomeVenda: 'Teste separação',
      marca: 'Teste',
      unidade: 'UN',
      codigoBarras: BARRAS,
      controlaEstoque: true,
    },
  })

  const disponivel = await garantirEstoque(company.id, produto.id, admin.id)

  const endereco = await clientePrisma.enderecoWms.findFirst({
    where: { companyId: company.id, ativo: true, status: 'ativo' },
    orderBy: { codigoCompleto: 'asc' },
  })

  const aberta = await clientePrisma.requisicaoWms.findFirst({
    where: {
      companyId: company.id,
      produtoId: produto.id,
      tipoOperacao: 'separacao',
      status: { notIn: ['concluida', 'cancelada'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  let id = aberta?.id
  let numero = aberta?.numero
  let reusou = Boolean(aberta)

  if (!aberta) {
    const criada = await servicoDeRequisicoesWms.criar(company.id, admin.id, {
      tipoOperacao: 'separacao',
      prioridade: 1,
      origemEnderecoId: endereco?.id ?? null,
      destinoEnderecoId: null,
      produtoId: produto.id,
      quantidade: 2,
      responsavelId: admin.id,
      observacao: 'Ordem só para testar a bipagem.',
    })
    id = criada.id
    numero = criada.numero
    reusou = false
  }

  console.log('')
  console.log('Empresa:', company.name, vinculou ? '(admin vinculado agora)' : '')
  console.log('Login:', admin.email)
  console.log('Produto: Teste separação ·', SKU, '· barras', BARRAS)
  console.log('Estoque disponível desse produto:', disponivel)
  console.log('Endereço:', endereco?.codigoCompleto ?? 'nenhum (a ficha mostra traço)')
  console.log('Requisição:', numeroRequisicao(numero!), reusou ? '(já existia)' : '(criada agora)')
  console.log('URL: http://localhost:3333/separacao/' + id)
  console.log('')
}

main()
  .catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await clientePrisma.$disconnect()
  })
