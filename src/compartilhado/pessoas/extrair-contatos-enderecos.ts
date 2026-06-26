/**
 * Extrai contatos e endereços de uma Pessoa para uso no pré-preenchimento
 * quando a pessoa já existe com outro papel (ex.: fornecedor → transportadora).
 */

type ContatoRaw = {
  tipo: string
  valor: string
  whatsapp: boolean
  principal: boolean
  descricao?: string | null
}

type EnderecoRaw = {
  tipo: string
  apelido?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  codigoIbge?: string | null
}

type DadosBancarioRaw = {
  apelido?: string | null
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  tipoConta?: string | null
  pix?: string | null
  favorecido?: string | null
  documentoFavorecido?: string | null
  principal: boolean
}

export type ContatosEEnderecos = {
  email: string | null
  telefone: string | null
  celular: string | null
  celularWhatsapp: boolean
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  codigoIbge: string | null
  contatos: ContatoRaw[]
  enderecos: EnderecoRaw[]
  dadosBancarios: DadosBancarioRaw[]
}

export function extrairContatosEEnderecos(pessoa: {
  contatos: ContatoRaw[]
  enderecos: EnderecoRaw[]
  dadosBancarios?: DadosBancarioRaw[]
}): ContatosEEnderecos {
  const emailPrincipal =
    pessoa.contatos.find((c) => c.tipo === 'email' && c.principal) ??
    pessoa.contatos.find((c) => c.tipo === 'email')

  const telefonePrincipal =
    pessoa.contatos.find((c) => c.tipo === 'telefone' && c.principal) ??
    pessoa.contatos.find((c) => c.tipo === 'telefone')

  const celular = pessoa.contatos.find(
    (c) => c.tipo === 'telefone' && !c.principal && c.valor !== telefonePrincipal?.valor
  )

  const enderecoPrincipal =
    pessoa.enderecos.find((e) => e.tipo === 'principal') ?? pessoa.enderecos[0]

  return {
    email: emailPrincipal?.valor ?? null,
    telefone: telefonePrincipal?.valor ?? null,
    celular: celular?.valor ?? null,
    celularWhatsapp: telefonePrincipal?.whatsapp ?? celular?.whatsapp ?? false,
    cep: enderecoPrincipal?.cep ?? null,
    logradouro: enderecoPrincipal?.logradouro ?? null,
    numero: enderecoPrincipal?.numero ?? null,
    complemento: enderecoPrincipal?.complemento ?? null,
    bairro: enderecoPrincipal?.bairro ?? null,
    cidade: enderecoPrincipal?.cidade ?? null,
    estado: enderecoPrincipal?.estado ?? null,
    codigoIbge: enderecoPrincipal?.codigoIbge ?? null,
    contatos: pessoa.contatos,
    enderecos: pessoa.enderecos,
    dadosBancarios: pessoa.dadosBancarios ?? [],
  }
}
