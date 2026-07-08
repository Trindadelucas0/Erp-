'use client'

/**
 * Página de auditoria — histórico de ações do sistema (somente admin).
 */
import { useEffect, useMemo, useState } from 'react'
import { clienteHttp } from '@/services/api'
import { ProtegerRota } from '@/components/compartilhado/proteger-rota'
import { useRegistrarAtalhos } from '@/hooks/use-registrar-atalhos'
import { CardPadrao } from '@/components/ui/card-padrao'
import { CabecalhoColunaOrdenavel } from '@/components/ui/cabecalho-coluna-ordenavel'
import { useOrdenacaoColunas } from '@/hooks/use-ordenacao-colunas'
import { ordenarLista } from '@/lib/ordenacao-lista'
import { InputPadrao } from '@/components/ui/input-padrao'
import { Button } from '@/components/ui/button'

type UsuarioDoLog = {
  id: string
  name: string
  email: string
}

type LogDeAuditoria = {
  id: string
  usuarioId: string
  acao: string
  entidade: string
  entidadeId: string
  valoresAntes: unknown
  valoresDepois: unknown
  criadoEm: string
  usuario: UsuarioDoLog
}

function formatarData(data: string) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function rotuloDaAcao(acao: string) {
  const mapa: Record<string, string> = {
    criar: 'Criou',
    editar: 'Editou',
    desativar: 'Desativou',
    ativar: 'Ativou',
    resetar_senha: 'Redefiniu senha',
    excluir: 'Excluiu',
  }
  return mapa[acao] ?? acao
}

function ConteudoDaPaginaDeAuditoria() {
  const [logs, setLogs] = useState<LogDeAuditoria[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [carregando, setCarregando] = useState(false)

  const [filtroEntidade, setFiltroEntidade] = useState('')
  const [filtroUsuarioId, setFiltroUsuarioId] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const { ordenacao, alternarOrdenacao } = useOrdenacaoColunas<
    'data' | 'usuario' | 'acao' | 'entidade' | 'id'
  >()

  const logsExibidos = useMemo(
    () =>
      ordenarLista(logs, ordenacao, (log, coluna) => {
        switch (coluna) {
          case 'data':
            return new Date(log.criadoEm)
          case 'usuario':
            return log.usuario?.name ?? ''
          case 'acao':
            return rotuloDaAcao(log.acao)
          case 'entidade':
            return log.entidade
          case 'id':
            return log.entidadeId
        }
      }),
    [logs, ordenacao]
  )

  useEffect(() => {
    carregarLogs()
  }, [pagina])

  async function carregarLogs() {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      params.set('pagina', String(pagina))
      if (filtroEntidade) params.set('entidade', filtroEntidade)
      if (filtroUsuarioId) params.set('usuarioId', filtroUsuarioId)
      if (filtroDataInicio) params.set('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.set('dataFim', filtroDataFim)

      const { data } = await clienteHttp.get(`/auditoria?${params.toString()}`)
      setLogs(data.logs)
      setTotal(data.total)
    } catch {
      // silencioso
    } finally {
      setCarregando(false)
    }
  }

  function aplicarFiltros() {
    setPagina(1)
    carregarLogs()
  }

  function limparFiltros() {
    setFiltroEntidade('')
    setFiltroUsuarioId('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setPagina(1)
    setTimeout(() => carregarLogs(), 0)
  }

  useRegistrarAtalhos(
    {
      buscar: () =>
        document.getElementById('filtro-entidade-auditoria')?.focus(),
      atualizar: aplicarFiltros,
    },
    {
      buscar: true,
      atualizar: !carregando,
    }
  )

  const totalPaginas = Math.max(1, Math.ceil(total / 50))

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de alterações do sistema
          </p>
        </div>
      </div>

      <CardPadrao titulo="Filtros">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InputPadrao
            id="filtro-entidade-auditoria"
            rotulo="Entidade"
            value={filtroEntidade}
            onChange={(e) => setFiltroEntidade(e.target.value)}
            placeholder="Ex: usuario, empresa"
          />
          <InputPadrao
            rotulo="Data início"
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
          />
          <InputPadrao
            rotulo="Data fim"
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={aplicarFiltros}>
            Filtrar
          </Button>
          <Button type="button" variant="outline" onClick={limparFiltros}>
            Limpar
          </Button>
        </div>
      </CardPadrao>

      <CardPadrao titulo={`Registros (${total} total)`}>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum registro encontrado.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Data/Hora" coluna="data" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                    <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Usuário" coluna="usuario" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                    <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Ação" coluna="acao" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                    <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="Entidade" coluna="entidade" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                    <CabecalhoColunaOrdenavel className="px-4 py-3" rotulo="ID" coluna="id" ordenacao={ordenacao} onOrdenar={alternarOrdenacao} />
                  </tr>
                </thead>
                <tbody>
                  {logsExibidos.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatarData(log.criadoEm)}
                      </td>
                      <td className="px-4 py-3">
                        <div>{log.usuario?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {log.usuario?.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {rotuloDaAcao(log.acao)}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">{log.entidade}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {log.entidadeId.slice(0, 8)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Página {pagina} de {totalPaginas}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagina === 1}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagina === totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardPadrao>
    </div>
  )
}

export default function PaginaDeAuditoria() {
  return (
    <ProtegerRota somenteAdmin>
      <ConteudoDaPaginaDeAuditoria />
    </ProtegerRota>
  )
}
