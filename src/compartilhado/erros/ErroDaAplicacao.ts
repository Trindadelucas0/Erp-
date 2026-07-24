/**
 * Erro personalizado  HTTP.
 * Usado para  mensagens claras ao cliente (400, 401, 403, 404).
 */
export class ErroDaAplicacao extends Error {
  /** Lido pelo Fastify para definir o status HTTP da resposta. */
  statusCode: number
  /** Código de negócio opcional (ex.: COTA_ESGOTADA) para o cliente tratar. */
  codigo?: string
  /** Payload opcional (ex.: usados/cota) sem alterar a mensagem. */
  detalhes?: Record<string, unknown>

  /**
   * @param mensagem - Texto que explica o erro para o usuário
   * @param codigoHttp - Código HTTP (padrão: 400)
   * @param opcoes - codigo/detalhes opcionais para o front
   */
  constructor(
    mensagem: string,
    public codigoHttp: number = 400,
    opcoes?: { codigo?: string; detalhes?: Record<string, unknown> }
  ) {
    super(mensagem)
    this.name = 'ErroDaAplicacao'
    this.statusCode = codigoHttp
    this.codigo = opcoes?.codigo
    this.detalhes = opcoes?.detalhes
  }
}
