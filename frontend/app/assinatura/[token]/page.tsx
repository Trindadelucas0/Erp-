'use client'

/**
 * Página pública de assinatura digital do cadastro de cliente.
 */
import { FormEvent, useEffect, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'

type DadosAssinatura = {
  token: string
  status: string
  expiraEm?: string | null
  assinadoEm?: string | null
  cliente: {
    nome: string
    tipo: string
    cpf?: string | null
    cnpj?: string | null
  }
}

function extrairErro(erro: unknown, padrao: string): string {
  if (erro && typeof erro === 'object' && 'response' in erro) {
    const res = (erro as { response?: { data?: { message?: string } } }).response
    if (res?.data?.message) return res.data.message
  }
  return padrao
}

export default function PaginaAssinatura({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [dados, setDados] = useState<DadosAssinatura | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [nomeAssinante, setNomeAssinante] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState(false)

  useEffect(() => {
    params.then((p) => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return

    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const { data } = await clienteHttp.get(`/clientes/assinatura/${token}`)
        setDados(data)
        if (data.status === 'assinado') setConcluido(true)
      } catch (e) {
        setErro(extrairErro(e, 'Link de assinatura inválido ou expirado'))
      } finally {
        setCarregando(false)
      }
    }

    carregar()
  }, [token])

  async function aoAssinar(evento: FormEvent) {
    evento.preventDefault()
    if (!aceite) return

    setEnviando(true)
    setErro('')
    try {
      await clienteHttp.post('/clientes/assinatura/confirmar', {
        token,
        nomeAssinante,
        aceite: true,
      })
      setConcluido(true)
    } catch (e) {
      setErro(extrairErro(e, 'Erro ao registrar assinatura'))
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (erro && !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <CardPadrao titulo="Assinatura indisponível" descricao="">
          <p className="text-sm text-destructive">{erro}</p>
        </CardPadrao>
      </div>
    )
  }

  if (concluido || dados?.status === 'assinado') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <CardPadrao
          titulo="Assinatura concluída"
          descricao={dados?.cliente.nome ?? ''}
        >
          <p className="text-sm text-muted-foreground">
            O cadastro foi assinado com sucesso e está ativo no sistema.
          </p>
        </CardPadrao>
      </div>
    )
  }

  if (dados?.status === 'expirado') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <CardPadrao titulo="Link expirado" descricao="">
          <p className="text-sm text-muted-foreground">
            Este link de assinatura expirou. Solicite um novo link ao responsável pelo cadastro.
          </p>
        </CardPadrao>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <CardPadrao
          titulo="Assinatura de cadastro"
          descricao={dados?.cliente.nome}
        >
          <form onSubmit={aoAssinar} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está assinando o cadastro de{' '}
              <strong>{dados?.cliente.nome}</strong> ({dados?.cliente.tipo}) como titular
              ou representante autorizado.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nome completo do assinante *</label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={nomeAssinante}
                onChange={(e) => setNomeAssinante(e.target.value)}
                required
                minLength={2}
                placeholder="Digite seu nome completo"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm">
                Li e concordo com os dados do cadastro e autorizo o uso comercial conforme
                as condições definidas pela empresa.
              </span>
            </label>

            {erro && (
              <p className="text-sm text-destructive">{erro}</p>
            )}

            <BotaoPrimario type="submit" disabled={enviando || !aceite} className="w-full">
              {enviando ? 'Registrando...' : 'Assinar cadastro'}
            </BotaoPrimario>
          </form>
        </CardPadrao>
      </div>
    </div>
  )
}
