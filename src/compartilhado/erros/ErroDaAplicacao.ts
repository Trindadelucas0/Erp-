/**
 * Erro personalizado  HTTP.
 * Usado para  mensagens claras ao cliente (400, 401, 403, 404).
 */
export class ErroDaAplicacao extends Error {
  /**
   * @param mensagem - Texto que explica o erro para o usuário
   * @param codigoHttp - Código HTTP (padrão: 400)
   */
  constructor(
    mensagem: string,
    public codigoHttp: number = 400
  ) {
    super(mensagem)
    this.name = 'ErroDaAplicacao'
  }
}
