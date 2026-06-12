import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/modulos/clientes/repositorio-clientes.js', () => ({
  repositorioDeClientes: {
    listarPorEmpresa: vi.fn(),
    buscarPorId: vi.fn(),
    buscarPorCpfNaEmpresa: vi.fn(),
    buscarPorCnpjNaEmpresa: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    alterarStatus: vi.fn(),
  },
}))

vi.mock('../../../src/compartilhado/auditoria/registrar-auditoria.js', () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

import { servicoDeClientes } from '../../../src/modulos/clientes/servico-clientes.js'
import { repositorioDeClientes } from '../../../src/modulos/clientes/repositorio-clientes.js'
import { ErroDaAplicacao } from '../../../src/compartilhado/erros/ErroDaAplicacao.js'

const clientePFBase = {
  id: 'cliente-001',
  tipo: 'PF',
  nome: 'João Silva',
  cpf: '52998224725',
  companyId: 'company-001',
  ativo: true,
}

const clientePJBase = {
  id: 'cliente-002',
  tipo: 'PJ',
  nome: 'Empresa X Ltda',
  cnpj: '11444777000161',
  companyId: 'company-001',
  ativo: true,
}

function dadosPF(overrides = {}) {
  return {
    tipo: 'PF' as const,
    nome: 'João Silva',
    cpf: '52998224725',
    indicadorIe: '9' as const,
    ...overrides,
  }
}

function dadosPJ(overrides = {}) {
  return {
    tipo: 'PJ' as const,
    nome: 'Empresa X Ltda',
    cnpj: '11444777000161',
    indicadorIe: '1' as const,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('servicoDeClientes.listarClientes', () => {
  it('lança 400 quando companyId está vazio', async () => {
    await expect(
      servicoDeClientes.listarClientes('')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(servicoDeClientes.listarClientes('')).rejects.toThrow(
      'Empresa ativa não informada'
    )
  })

  it('retorna lista quando companyId é válido', async () => {
    vi.mocked(repositorioDeClientes.listarPorEmpresa).mockResolvedValue([
      clientePFBase,
    ] as never)

    const resultado = await servicoDeClientes.listarClientes('company-001')
    expect(resultado).toHaveLength(1)
    expect(repositorioDeClientes.listarPorEmpresa).toHaveBeenCalledWith('company-001')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('servicoDeClientes.criarCliente', () => {
  it('lança 400 quando companyId está vazio', async () => {
    await expect(
      servicoDeClientes.criarCliente(dadosPF(), '', 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })
  })

  it('lança 400 quando CPF já está cadastrado nesta empresa', async () => {
    vi.mocked(repositorioDeClientes.buscarPorCpfNaEmpresa).mockResolvedValue(
      clientePFBase as never
    )

    await expect(
      servicoDeClientes.criarCliente(dadosPF(), 'company-001', 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(
      servicoDeClientes.criarCliente(dadosPF(), 'company-001', 'autor-001')
    ).rejects.toThrow('CPF já cadastrado')
  })

  it('lança 400 quando CNPJ já está cadastrado nesta empresa', async () => {
    vi.mocked(repositorioDeClientes.buscarPorCnpjNaEmpresa).mockResolvedValue(
      clientePJBase as never
    )

    await expect(
      servicoDeClientes.criarCliente(dadosPJ(), 'company-001', 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })

    await expect(
      servicoDeClientes.criarCliente(dadosPJ(), 'company-001', 'autor-001')
    ).rejects.toThrow('CNPJ já cadastrado')
  })

  it('cria cliente PF quando CPF não existe na empresa', async () => {
    vi.mocked(repositorioDeClientes.buscarPorCpfNaEmpresa).mockResolvedValue(null)
    vi.mocked(repositorioDeClientes.criar).mockResolvedValue(clientePFBase as never)

    const resultado = await servicoDeClientes.criarCliente(
      dadosPF(),
      'company-001',
      'autor-001'
    )

    expect(resultado.nome).toBe('João Silva')
    expect(repositorioDeClientes.criar).toHaveBeenCalledWith(dadosPF(), 'company-001')
  })

  it('cria cliente PJ quando CNPJ não existe na empresa', async () => {
    vi.mocked(repositorioDeClientes.buscarPorCnpjNaEmpresa).mockResolvedValue(null)
    vi.mocked(repositorioDeClientes.criar).mockResolvedValue(clientePJBase as never)

    const resultado = await servicoDeClientes.criarCliente(
      dadosPJ(),
      'company-001',
      'autor-001'
    )

    expect(resultado.nome).toBe('Empresa X Ltda')
  })

  it('o mesmo CPF pode existir em empresas diferentes', async () => {
    // CPF em company-001 existe, mas estamos criando em company-002
    vi.mocked(repositorioDeClientes.buscarPorCpfNaEmpresa).mockResolvedValue(null)
    vi.mocked(repositorioDeClientes.criar).mockResolvedValue(clientePFBase as never)

    await expect(
      servicoDeClientes.criarCliente(dadosPF(), 'company-002', 'autor-001')
    ).resolves.toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('servicoDeClientes.editarCliente', () => {
  it('lança 404 quando cliente não existe', async () => {
    vi.mocked(repositorioDeClientes.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeClientes.editarCliente('inexistente', dadosPF(), 'company-001', 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('lança 404 quando cliente pertence a outra empresa', async () => {
    vi.mocked(repositorioDeClientes.buscarPorId).mockResolvedValue({
      ...clientePFBase,
      companyId: 'company-outra', // empresa diferente
    } as never)

    await expect(
      servicoDeClientes.editarCliente('cliente-001', dadosPF(), 'company-001', 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('lança 400 quando CPF novo já pertence a outro cliente', async () => {
    vi.mocked(repositorioDeClientes.buscarPorId).mockResolvedValue(
      clientePFBase as never
    )
    vi.mocked(repositorioDeClientes.buscarPorCpfNaEmpresa).mockResolvedValue({
      ...clientePFBase,
      id: 'outro-cliente-999', // CPF de outro cliente
    } as never)

    await expect(
      servicoDeClientes.editarCliente('cliente-001', dadosPF(), 'company-001', 'autor-001')
    ).rejects.toMatchObject({ codigoHttp: 400 })
  })

  it('permite editar quando CPF pertence ao mesmo cliente', async () => {
    vi.mocked(repositorioDeClientes.buscarPorId).mockResolvedValue(
      clientePFBase as never
    )
    vi.mocked(repositorioDeClientes.buscarPorCpfNaEmpresa).mockResolvedValue(
      clientePFBase as never // mesmo id
    )
    vi.mocked(repositorioDeClientes.atualizar).mockResolvedValue(clientePFBase as never)

    await expect(
      servicoDeClientes.editarCliente('cliente-001', dadosPF(), 'company-001', 'autor-001')
    ).resolves.toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('servicoDeClientes.alterarStatusDoCliente', () => {
  it('lança 404 quando cliente não existe', async () => {
    vi.mocked(repositorioDeClientes.buscarPorId).mockResolvedValue(null)

    await expect(
      servicoDeClientes.alterarStatusDoCliente(
        'inexistente',
        false,
        'company-001',
        'autor-001'
      )
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('lança 404 quando cliente é de outra empresa', async () => {
    vi.mocked(repositorioDeClientes.buscarPorId).mockResolvedValue({
      ...clientePFBase,
      companyId: 'company-outra',
    } as never)

    await expect(
      servicoDeClientes.alterarStatusDoCliente(
        'cliente-001',
        false,
        'company-001',
        'autor-001'
      )
    ).rejects.toMatchObject({ codigoHttp: 404 })
  })

  it('altera status com sucesso', async () => {
    vi.mocked(repositorioDeClientes.buscarPorId).mockResolvedValue(
      clientePFBase as never
    )
    vi.mocked(repositorioDeClientes.alterarStatus).mockResolvedValue({
      ...clientePFBase,
      ativo: false,
    } as never)

    const resultado = await servicoDeClientes.alterarStatusDoCliente(
      'cliente-001',
      false,
      'company-001',
      'autor-001'
    )

    expect(resultado.ativo).toBe(false)
  })
})
