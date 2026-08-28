/**

 * Mensagens amigáveis e helpers de diagnóstico Focus (sem vazar token).

 * Erro 400 documentado pela Focus em GET /nfes_recebidas:

 * { codigo: "requisicao_invalida", mensagem: "CNPJ do emitente não autorizado ou não informado" }

 * @see https://doc.focusnfe.com.br/reference/consultar_nfes_recebidas

 */



export function normalizarCnpj(cnpj: string): string {

  return cnpj.replace(/\D/g, '')

}



export function mascararCnpj(cnpj: string): string {

  const digitos = normalizarCnpj(cnpj)

  if (digitos.length < 4) return '****'

  return `${'*'.repeat(Math.max(0, digitos.length - 4))}${digitos.slice(-4)}`

}



export function mensagemErroFocusAmigavel(opcoes: {

  codigoHttp?: number

  mensagemOriginal?: string

  ambiente: 'homolog' | 'producao'

  cnpjMascarado?: string

  fonte?: 'banco' | 'env'

}): string {

  const http = opcoes.codigoHttp

  const original = (opcoes.mensagemOriginal ?? '').toLowerCase()

  const dicaEnv =

    opcoes.fonte === 'env'

      ? ' Preferível salvar o token no painel Focus NFe desta empresa (fonte=banco).'

      : ''



  if (http === 401 || original.includes('access token') || original.includes('token inválido')) {

    return `Token inválido para o ambiente ${opcoes.ambiente}. Use o token_homologacao com homologação marcada (ou token_producao com homologação desmarcada).${dicaEnv}`

  }



  const cnpjNaoAutorizado =

    original.includes('cnpj') &&

    (original.includes('não autorizado') ||

      original.includes('nao autorizado') ||

      original.includes('não informado') ||

      original.includes('nao informado'))



  if ((http === 400 || http === 403) && cnpjNaoAutorizado) {

    const cnpjInfo = opcoes.cnpjMascarado ? ` (CNPJ enviado: ${opcoes.cnpjMascarado})` : ''

    const flagHomolog =

      opcoes.ambiente === 'homolog'

        ? ' Em homologação a Focus exige Recebimento de NFes / habilita_manifestacao_homologacao (não basta NFe de emissão nem só a flag de produção).'

        : ' Em produção: Documentos fiscais → Recebimento de NFes (habilita_manifestacao).'

    return (

      `CNPJ não autorizado para NFe recebidas nesta Focus${cnpjInfo}.` +

      flagHomolog +

      ' Painel Focus → Empresas → DETALHES → Documentos fiscais → ligar Recebimento de NFes → Salvar. ' +

      'Depois re-copie o token e teste de novo.' +

      dicaEnv

    )

  }



  if (http === 403) {

    return `Permissão negada na Focus (403). Nos Detalhes → Documentos fiscais, habilite Recebimento de NFes / habilita_manifestacao.${dicaEnv}`

  }



  return opcoes.mensagemOriginal || `Erro Focus HTTP ${http ?? '?'} `
}

export function mensagemBloqueioAutenticacaoFocus(mensagemOriginal: string): string {
  const m = mensagemOriginal.match(/(\d+)\s*segundo/i)
  const sec = m ? Math.min(Number(m[1]) || 120, 120) : 120
  return (
    `Focus bloqueou tentativas de autenticação deste IP (token inválido). ` +
    `Aguarde cerca de ${sec} segundo(s), corrija o token em Configurações → Focus NFe ` +
    `(token de produção com homologação desmarcada, ou token de homologação com homologação marcada) e tente de novo.`
  )
}

/**
 * XML/lista OK na Focus, mas PDF (DANFE/DACTe) falha — indica inconsistência do serviço Focus, não token ERP.
 */
export function mensagemInconsistenciaFocusPdf(
  tipoDocumento: 'nfe55' | 'nfse' | 'cte' | string | null | undefined
): string {
  const doc =
    tipoDocumento === 'nfse'
      ? 'PDF da NFS-e'
      : tipoDocumento === 'cte'
        ? 'DACTe (PDF)'
        : 'DANFE (PDF)'
  return (
    `${doc} indisponível na Focus para esta nota — inconsistência com a Focus ` +
    `(o XML da mesma nota está acessível; token e BUSCAR estão corretos). ` +
    'Use Ver nota ou Baixar XML. Se persistir, contate o suporte da Focus NFe.'
  )
}

