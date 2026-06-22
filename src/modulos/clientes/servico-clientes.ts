/**
 * Regras de negócio para clientes.
 */
import { ErroDaAplicacao } from '../../compartilhado/erros/ErroDaAplicacao.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { repositorioDeClientes } from './repositorio-clientes.js'
import { statusPermiteEdicaoVendedor } from './regras-cliente.js'
import type {
  DadosParaAprovacaoDeCliente,
  DadosParaConfirmacaoDeAssinatura,
  DadosParaCriarCliente,
  DadosParaEditarCliente,
} from './esquema-clientes.js'

async function listarClientes(companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada. Selecione uma empresa.', 400)
  }
  return repositorioDeClientes.listarPorEmpresa(companyId)
}

async function listarClientesPendentes(companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada. Selecione uma empresa.', 400)
  }
  return repositorioDeClientes.listarPendentes(companyId)
}

async function criarCliente(
  dados: DadosParaCriarCliente,
  companyId: string,
  idDoAutor: string
) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }

  const documento =
    dados.tipo === 'PF' ? dados.cpf?.replace(/\D/g, '') : dados.cnpj?.replace(/\D/g, '')

  if (documento) {
    const busca = await repositorioDeClientes.buscarPessoaPorDocumentoNaEmpresa(
      documento,
      companyId
    )
    if (busca.temPapelCliente && busca.pessoa?.ativo) {
      const status = busca.pessoa.statusAprovacao
      if (status !== 'reprovado') {
        throw new ErroDaAplicacao(
          dados.tipo === 'PF'
            ? 'CPF já cadastrado como cliente nesta empresa'
            : 'CNPJ já cadastrado como cliente nesta empresa',
          400
        )
      }
    }
  }

  const cliente = await repositorioDeClientes.criar(dados, companyId)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'criar',
    entidade: 'cliente',
    entidadeId: cliente.id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo, statusAprovacao: cliente.statusAprovacao },
  })

  return cliente
}

async function editarCliente(
  id: string,
  dados: DadosParaEditarCliente,
  companyId: string,
  idDoAutor: string,
  podeAprovar: boolean
) {
  const clienteExistente = await repositorioDeClientes.buscarPorId(id)

  if (!clienteExistente || clienteExistente.companyId !== companyId) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  if (!podeAprovar && !statusPermiteEdicaoVendedor(clienteExistente.statusAprovacao)) {
    throw new ErroDaAplicacao(
      'Cadastro não pode ser editado neste status. Aguarde aprovação ou assinatura.',
      400
    )
  }

  if (dados.tipo === 'PF' && dados.cpf) {
    const existente = await repositorioDeClientes.buscarPorCpfNaEmpresa(dados.cpf, companyId)
    if (existente && existente.id !== id) {
      throw new ErroDaAplicacao('CPF já cadastrado nesta empresa', 400)
    }
  }

  if (dados.tipo === 'PJ' && dados.cnpj) {
    const existente = await repositorioDeClientes.buscarPorCnpjNaEmpresa(dados.cnpj, companyId)
    if (existente && existente.id !== id) {
      throw new ErroDaAplicacao('CNPJ já cadastrado nesta empresa', 400)
    }
  }

  const atualizado = await repositorioDeClientes.atualizar(id, dados)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'editar',
    entidade: 'cliente',
    entidadeId: id,
    valoresDepois: { nome: dados.nome, tipo: dados.tipo, statusAprovacao: atualizado.statusAprovacao },
  })

  return atualizado
}

async function alterarStatusDoCliente(
  id: string,
  ativo: boolean,
  companyId: string,
  idDoAutor: string
) {
  const clienteExistente = await repositorioDeClientes.buscarPorId(id)

  if (!clienteExistente || clienteExistente.companyId !== companyId) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  const atualizado = await repositorioDeClientes.alterarStatus(id, ativo)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: ativo ? 'reativar' : 'desativar',
    entidade: 'cliente',
    entidadeId: id,
    valoresDepois: { ativo },
  })

  return atualizado
}

async function processarAprovacao(
  id: string,
  dados: DadosParaAprovacaoDeCliente,
  companyId: string,
  idDoAutor: string
) {
  const clienteExistente = await repositorioDeClientes.buscarPorId(id)

  if (!clienteExistente || clienteExistente.companyId !== companyId) {
    throw new ErroDaAplicacao('Cliente não encontrado', 404)
  }

  if (dados.acao === 'reprovar') {
    const reprovado = await repositorioDeClientes.reprovar(
      id,
      dados.motivoReprovacao,
      idDoAutor
    )

    await registrarAuditoria({
      usuarioId: idDoAutor,
      acao: 'reprovar_cliente',
      entidade: 'cliente',
      entidadeId: id,
      valoresAntes: { statusAprovacao: clienteExistente.statusAprovacao },
      valoresDepois: {
        statusAprovacao: 'reprovado',
        motivoReprovacao: dados.motivoReprovacao,
      },
    })

    return { cliente: reprovado, tokenAssinatura: null }
  }

  const resultado = await repositorioDeClientes.aprovar(id, dados, idDoAutor)

  await registrarAuditoria({
    usuarioId: idDoAutor,
    acao: 'aprovar_cliente',
    entidade: 'cliente',
    entidadeId: id,
    valoresAntes: { statusAprovacao: clienteExistente.statusAprovacao },
    valoresDepois: {
      statusAprovacao: 'aguardando_assinatura',
      tipoCliente: dados.tipoCliente,
      limiteCredito: dados.limiteCredito,
      condicaoPagamento: dados.condicaoPagamento,
      vendedorId: dados.vendedorId || null,
      calculaComissao: dados.calculaComissao,
    },
  })

  return resultado
}

async function buscarClientePorDocumento(documento: string, companyId: string) {
  if (!companyId) {
    throw new ErroDaAplicacao('Empresa ativa não informada.', 400)
  }
  return repositorioDeClientes.buscarPessoaPorDocumentoNaEmpresa(documento, companyId)
}

async function consultarAssinatura(token: string) {
  const resultado = await repositorioDeClientes.buscarAssinaturaPorToken(token)
  if (!resultado) {
    throw new ErroDaAplicacao('Link de assinatura inválido', 404)
  }
  return resultado
}

async function confirmarAssinatura(dados: DadosParaConfirmacaoDeAssinatura, ipAssinante?: string) {
  return repositorioDeClientes.confirmarAssinatura(
    dados.token,
    dados.nomeAssinante,
    ipAssinante
  )
}

export const servicoDeClientes = {
  listarClientes,
  listarClientesPendentes,
  criarCliente,
  editarCliente,
  alterarStatusDoCliente,
  processarAprovacao,
  buscarClientePorDocumento,
  consultarAssinatura,
  confirmarAssinatura,
}
