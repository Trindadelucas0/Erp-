'use client'

/**
 * Login público do portal do fornecedor.
 * Senha = número do pedido (enviado por e-mail quando o pedido é liberado).
 */
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import { CardPadrao } from '@/components/ui/card-padrao'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { InputPadrao } from '@/components/ui/input-padrao'
import { CHAVE_TOKEN_PORTAL_FORNECEDOR } from '@/lib/portal-fornecedor'

function extrairErro(erro: unknown, padrao: string): string {
  if (erro && typeof erro === 'object' && 'response' in erro) {
    const res = (erro as { response?: { data?: { mensagem?: string; message?: string } } }).response
    if (res?.data?.mensagem) return res.data.mensagem
    if (res?.data?.message) return res.data.message
  }
  return padrao
}

export default function PaginaLoginPortalFornecedor() {
  const router = useRouter()
  const [cnpj, setCnpj] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      const { data } = await clienteHttp.post('/portal-fornecedor/login', { cnpj, senha })
      localStorage.setItem(CHAVE_TOKEN_PORTAL_FORNECEDOR, data.token)
      router.push('/portal-fornecedor/pedido')
    } catch (e) {
      setErro(extrairErro(e, 'Não foi possível entrar. Confira o CNPJ e a senha.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <CardPadrao
          titulo="Portal do fornecedor"
          descricao="Acesse com o CNPJ e a senha enviados por e-mail"
        >
          <form onSubmit={entrar} className="space-y-4">
            <InputPadrao
              rotulo="CNPJ"
              obrigatorio
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              autoComplete="off"
            />
            <InputPadrao
              rotulo="Senha (número do pedido)"
              obrigatorio
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Ex.: 42"
              inputMode="numeric"
              autoComplete="off"
            />

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <BotaoPrimario type="submit" disabled={enviando || !cnpj || !senha} className="w-full">
              {enviando ? 'Entrando...' : 'Entrar'}
            </BotaoPrimario>
          </form>
        </CardPadrao>
      </div>
    </div>
  )
}
