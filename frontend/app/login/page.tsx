'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteHttp } from '@/services/api'
import {
  buscarPerfilDoUsuario,
  resolverRotaAposLogin,
} from '@/services/autenticacao'
import { useSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { BotaoPrimario } from '@/components/ui/botao-primario'
import { CardPadrao } from '@/components/ui/card-padrao'
import { InputPadrao } from '@/components/ui/input-padrao'

export default function PaginaDeLogin() {
  const roteador = useRouter()
  const { estaAutenticado, carregando, recarregarPerfil } = useSessaoDoUsuario()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagemDeErro, setMensagemDeErro] = useState('')

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

    try {
      const { data } = await clienteHttp.post('/auth/login', { email, senha })
      localStorage.setItem('token', data.token)
      await recarregarPerfil()
      const perfil = await buscarPerfilDoUsuario()
      roteador.push(resolverRotaAposLogin(perfil))
    } catch (erro: unknown) {
      const resposta = (erro as { response?: { data?: { mensagem?: string }; status?: number } })
        ?.response

      if (!resposta) {
        setMensagemDeErro(
          'Não foi possível conectar à API. Rode "npm run dev" na pasta Erp.'
        )
        return
      }

      setMensagemDeErro(
        resposta.data?.mensagem || 'Email ou senha incorretos'
      )
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
          ERP PRÓPRIO
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Sistema de Gestão</p>
      </div>

      <CardPadrao className="w-full">
        <form onSubmit={aoEnviarFormulario} className="space-y-4">
          <InputPadrao
            rotulo="Email"
            type="email"
            placeholder="usuario@empresa.com.br"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
          />

          <InputPadrao
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            required
          />

          {mensagemDeErro && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mensagemDeErro}
            </p>
          )}

          <BotaoPrimario type="submit" className="w-full">
            Entrar
          </BotaoPrimario>

          <p className="text-center text-sm text-muted-foreground hover:text-foreground">
            Esqueci minha senha
          </p>
        </form>
      </CardPadrao>
    </div>
  )
}
