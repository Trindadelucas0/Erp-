'use client'

/**
 * Tela de gestão de permissões por papel.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clienteHttp } from '../../services/api'
import {
  GradePermissoes,
  type Permissao,
} from '../../compartilhado/grade-permissoes'

type Papel = {
  id: string
  name: string
  permissions: { permission: Permissao }[]
}

export default function PaginaDePapeis() {
  const roteador = useRouter()
  const [listaDePapeis, setListaDePapeis] = useState<Papel[]>([])
  const [listaDePermissoes, setListaDePermissoes] = useState<Permissao[]>([])
  const [papelSelecionado, setPapelSelecionado] = useState<Papel | null>(null)
  const [idsDasPermissoes, setIdsDasPermissoes] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      roteador.push('/login')
      return
    }
    carregarDados()
  }, [roteador])

  async function carregarDados() {
    try {
      const [respostaPapeis, respostaPermissoes] = await Promise.all([
        clienteHttp.get('/roles'),
        clienteHttp.get('/permissions'),
      ])
      setListaDePapeis(respostaPapeis.data.papeis)
      setListaDePermissoes(respostaPermissoes.data.permissoes)
    } catch {
      roteador.push('/login')
    }
  }

  function selecionarPapel(papel: Papel) {
    setPapelSelecionado(papel)
    setIdsDasPermissoes(
      papel.permissions.map((item) => item.permission.id)
    )
    setMensagem('')
  }

  async function salvarPermissoes() {
    if (!papelSelecionado) return

    setMensagem('')

    try {
      await clienteHttp.put(`/roles/${papelSelecionado.id}/permissoes`, {
        idsDasPermissoes,
      })
      setMensagem('Permissões salvas com sucesso!')
      await carregarDados()
      const atualizado = (await clienteHttp.get(`/roles/${papelSelecionado.id}`))
        .data.papel
      setPapelSelecionado(atualizado)
      setIdsDasPermissoes(
        atualizado.permissions.map((item: { permission: Permissao }) => item.permission.id)
      )
    } catch (erro: unknown) {
      const msg =
        (erro as { response?: { data?: { mensagem?: string } } })?.response?.data
          ?.mensagem || 'Erro ao salvar'
      setMensagem(msg)
    }
  }

  const ehAdmin = papelSelecionado?.name === 'admin'

  return (
    <main>
      <p>
        <Link href="/users">← Voltar para usuários</Link>
      </p>
      <h1>Gerenciar papéis</h1>
      {mensagem && <p>{mensagem}</p>}

      <h2>Papéis</h2>
      <ul>
        {listaDePapeis.map((papel) => (
          <li key={papel.id}>
            <button type="button" onClick={() => selecionarPapel(papel)}>
              {papel.name}
            </button>
          </li>
        ))}
      </ul>

      {papelSelecionado && (
        <section>
          <h2>Permissões do papel: {papelSelecionado.name}</h2>
          {ehAdmin ? (
            <p>O papel admin tem acesso total ao sistema.</p>
          ) : (
            <>
              <GradePermissoes
                listaDePermissoes={listaDePermissoes}
                idsSelecionados={idsDasPermissoes}
                aoAlterar={setIdsDasPermissoes}
              />
              <br />
              <button type="button" onClick={salvarPermissoes}>
                Salvar permissões
              </button>
            </>
          )}
        </section>
      )}
    </main>
  )
}
