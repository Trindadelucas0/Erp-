'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteHttp, URL_DA_API } from '@/services/api'
import {
  buscarPerfilDoUsuario,
  resolverRotaAposLogin,
} from '@/services/autenticacao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'
import { limparSessaoLocal, salvarTokenNaSessao } from '@/lib/sessao-local'

function extrairMensagemDeErro(erro: unknown, padrao: string): string {
  const resposta = (erro as {
    response?: { data?: { mensagem?: string; message?: string } }
  })?.response?.data

  return resposta?.mensagem || resposta?.message || padrao
}

export default function PaginaDeLogin() {
  const roteador = useRouter()
  const { estaAutenticado, carregando, recarregarPerfil } = useSessaoDoUsuario()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagemDeErro, setMensagemDeErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    limparSessaoLocal()
  }, [])

  useEffect(() => {
    if (!carregando && estaAutenticado) {
      buscarPerfilDoUsuario().then((perfil) => {
        roteador.replace(resolverRotaAposLogin(perfil))
      })
    }
  }, [carregando, estaAutenticado, roteador])

  async function aoEnviarFormulario(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')
    setEnviando(true)

    try {
      const { data } = await clienteHttp.post('/auth/login', { email, senha })
      salvarTokenNaSessao(data.token)
      const perfil = await recarregarPerfil()
      if (!perfil) {
        throw new Error('Não foi possível carregar o perfil após o login')
      }
      roteador.push(resolverRotaAposLogin(perfil))
    } catch (erro: unknown) {
      const resposta = (erro as { response?: { status?: number } })?.response

      if (!resposta) {
        setMensagemDeErro(
          `Não foi possível conectar à API (${URL_DA_API}). Na VPS, confira o .env, a rota do Cloudflare para a API e rode "npm run build" de novo.`
        )
        return
      }

      setMensagemDeErro(
        extrairMensagemDeErro(erro, 'Email ou senha incorretos')
      )
    } finally {
      setEnviando(false)
    }
  }

  if (carregando || estaAutenticado) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Redirecionando...
      </p>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          ERP 
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Sistema de Gestão</p>
      </div>

      <CardPadrao className="w-full">
        <form onSubmit={aoEnviarFormulario} className="space-y-4">
          <InputPadrao
            rotulo="Email"
            type="email"
            placeholder="********"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
          />

          <InputPadrao
            rotulo="Senha"
            type="password"
             placeholder="********"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            required
          />

          

          {mensagemDeErro && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mensagemDeErro}
            </p>
          )}

          <BotaoPrimario type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </BotaoPrimario>

          <p className="text-center text-sm text-muted-foreground">
            Esqueci minha senha — contate o administrador
          </p>
        </form>
      </CardPadrao>
    </div>
  )
}
