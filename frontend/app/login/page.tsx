'use client'

/**
 * Tela de login — formulário básico sem design.
 */
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteHttp } from '../../services/api'

export default function PaginaDeLogin() {
  const roteador = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagemDeErro, setMensagemDeErro] = useState('')

  /**
   * Envia email e senha para a API e salva o token no navegador.
   * @param evento - Evento de submit do formulário
   */
  async function aoEnviarFormulario(evento: FormEvent) {
    evento.preventDefault()
    setMensagemDeErro('')

    try {
      const { data } = await clienteHttp.post('/auth/login', { email, senha })
      localStorage.setItem('token', data.token)
      roteador.push('/users')
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

  return (
    <main>
      <h1>Login</h1>
      <form onSubmit={aoEnviarFormulario}>
        <div>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
          />
        </div>
        <br />
        <div>
          <label>Senha</label>
          <br />
          <input
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            required
          />
        </div>
        <br />
        {mensagemDeErro && <p>{mensagemDeErro}</p>}
        <button type="submit">Entrar</button>
      </form>
    </main>
  )
}
