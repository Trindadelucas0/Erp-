import { beforeEach, describe, expect, it, vi } from 'vitest'
import { esquemaRegrasFiscais, regrasFiscaisPadrao } from './esquema-regras-fiscais.js'
vi.mock('./repositorio-regras-fiscais.js', () => ({ repositorioRegrasFiscais: { buscarDaEmpresa: vi.fn(), gravar: vi.fn() } }))
vi.mock('../../compartilhado/auditoria/registrar-auditoria.js', () => ({ registrarAuditoria: vi.fn() }))
import { repositorioRegrasFiscais } from './repositorio-regras-fiscais.js'
import { registrarAuditoria } from '../../compartilhado/auditoria/registrar-auditoria.js'
import { servicoRegrasFiscais } from './servico-regras-fiscais.js'

describe('regras fiscais', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each([null, '', ' ', -1, 101, 'abc', Infinity, true, []])('recusa alíquota fixa %s', (aliquota) => {
    expect(esquemaRegrasFiscais.safeParse({ mercadoria: { modo: 'pre_definida', aliquota }, transporte: { modo: 'nota', aliquota: null } }).success).toBe(false)
  })
  it.each([0, 100, '12,5'])('aceita alíquota fixa %s', (aliquota) => {
    expect(esquemaRegrasFiscais.safeParse({ mercadoria: { modo: 'pre_definida', aliquota }, transporte: { modo: 'nota', aliquota: null } }).success).toBe(true)
  })
  it('limpa alíquota no modo nota e recusa companyId no corpo', () => {
    expect(esquemaRegrasFiscais.parse({ mercadoria: { modo: 'nota', aliquota: 12 }, transporte: { modo: 'nota', aliquota: 18 } })).toEqual(regrasFiscaisPadrao())
    expect(esquemaRegrasFiscais.safeParse({ ...regrasFiscaisPadrao(), companyId: 'outra' }).success).toBe(false)
  })
  it('empresa sem configuração recebe modo nota, sem gravar dados', async () => {
    vi.mocked(repositorioRegrasFiscais.buscarDaEmpresa).mockResolvedValue(null)
    expect(await servicoRegrasFiscais.obter('a')).toEqual(regrasFiscaisPadrao())
    expect(repositorioRegrasFiscais.gravar).not.toHaveBeenCalled()
  })
  it('salva por empresa e audita os quatro parâmetros', async () => {
    const dados = esquemaRegrasFiscais.parse({ mercadoria: { modo: 'pre_definida', aliquota: '12,5' }, transporte: { modo: 'nota', aliquota: null }, baseIcms: 'bruto', operacoes: [] })
    const registro = { id: 'r', companyId: 'a', mercadoriaModo: 'pre_definida', mercadoriaAliquota: 12.5, transporteModo: 'nota', transporteAliquota: null } as never
    vi.mocked(repositorioRegrasFiscais.buscarDaEmpresa).mockResolvedValue(null)
    vi.mocked(repositorioRegrasFiscais.gravar).mockResolvedValue(registro)
    expect(await servicoRegrasFiscais.gravar('a', dados, 'u')).toEqual(dados)
    expect(repositorioRegrasFiscais.gravar).toHaveBeenCalledWith('a', dados)
    expect(registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'u', valoresDepois: { companyId: 'a', ...dados } }))
  })
  it('consulta cada empresa separadamente e exige empresa ativa', async () => {
    vi.mocked(repositorioRegrasFiscais.buscarDaEmpresa).mockImplementation(async (companyId) => companyId === 'a' ? ({ mercadoriaModo: 'pre_definida', mercadoriaAliquota: 12, transporteModo: 'nota', transporteAliquota: null } as never) : null)
    expect((await servicoRegrasFiscais.obter('a')).mercadoria.aliquota).toBe(12)
    expect((await servicoRegrasFiscais.obter('b')).mercadoria.aliquota).toBeNull()
    expect(repositorioRegrasFiscais.buscarDaEmpresa).toHaveBeenNthCalledWith(2, 'b', expect.anything())
    await expect(servicoRegrasFiscais.obter('')).rejects.toMatchObject({ codigoHttp: 400 })
  })
})
