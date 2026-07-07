# Auditoria de segurança e SQL injection — ERP

**Data da auditoria:** julho/2026  
**Stack:** Fastify + TypeScript + Prisma (PostgreSQL) + Next.js  
**Escopo:** backend (`src/`), frontend (`frontend/`), repositórios e rotas HTTP

---

## 1. Resumo executivo

O ERP utiliza **Prisma ORM** como única camada de acesso ao banco. Não há uso de `$queryRaw`, `$executeRaw`, `queryRawUnsafe` ou concatenação manual de strings SQL no código de produção.

**Risco atual de SQL injection: baixo.**

Foram identificados, porém, **11 pontos de atenção** em autorização, exposição de arquivos, webhooks e concorrência — alguns com severidade alta. Este documento registra os achados e as recomendações para manter a proteção contra SQL injection e corrigir as demais vulnerabilidades.

---

## 2. Arquitetura de acesso ao banco

```
Frontend → JWT + X-Company-Id → API Fastify
  → middlewareDeAutenticacao
  → middlewareEmpresaAtiva
  → middlewareDeAutorizacao
  → servico-*.ts
  → repositorio-*.ts
  → Prisma Client (queries parametrizadas)
  → PostgreSQL
```

**Repositórios analisados (17 arquivos):**

- `src/modulos/clientes/repositorio-clientes.ts`
- `src/modulos/fornecedores/repositorio-fornecedores.ts`
- `src/modulos/transportadoras/repositorio-transportadoras.ts`
- `src/modulos/produtos/repositorio-produtos.ts`
- `src/modulos/produtos/repositorio-unidades-medida.ts`
- `src/modulos/pedidos-compra/repositorio-pedidos-compra.ts`
- `src/modulos/pedidos-compra/repositorio-pedidos-venda.ts`
- `src/modulos/planos-financeiros/repositorio-planos-financeiros.ts`
- `src/modulos/cfops/repositorio-cfops.ts`
- `src/modulos/catalogos/repositorio-catalogos.ts`
- `src/modulos/usuarios/repositorio-usuarios.ts`
- `src/modulos/papeis/repositorio-papeis.ts`
- `src/modulos/permissoes/repositorio-permissoes.ts`
- `src/modulos/empresas/repositorio-empresas.ts`
- `src/modulos/auditoria/repositorio-auditoria.ts`
- `src/modulos/assinatura-zapsign/repositorio-assinatura-zapsign.ts`
- `src/modulos/configuracoes/repositorio-atalhos.ts`

Todos usam métodos tipados do Prisma (`findMany`, `create`, `update`, `delete`, etc.).

---

## 3. Bugs e vulnerabilidades encontradas

### 3.1 Severidade alta

| # | Problema | Arquivo | Impacto | Recomendação |
|---|----------|---------|---------|--------------|
| 1 | **Uploads de produto sem autenticação** | `src/infraestrutura/http/rotas-uploads.ts` — `GET /uploads/produtos/:companyId/:produtoId/:arquivo` sem `preHandler` | Qualquer pessoa com os UUIDs consegue baixar fotos de produtos (path traversal mitigado, mas IDOR público) | Adicionar autenticação (JWT via header ou cookie `erp_token`) e validar vínculo do usuário com a `companyId` da URL |
| 2 | **Webhook ZapSign aceito sem secret** | `src/modulos/assinatura-zapsign/servico-assinatura-zapsign.ts` (linha ~304) — validação só ocorre se `webhookSecret` estiver configurado | Atacante pode forjar eventos `doc_signed` / `doc_refused` e alterar status de documentos no banco | Rejeitar webhook quando `webhookSecret` não estiver configurado (especialmente em produção) |
| 3 | **Bypass de permissão via query string** | `src/modulos/cfops/rotas-cfops.ts` e `src/modulos/planos-financeiros/rotas-planos-financeiros.ts` — `GET /` exige só autenticação; `?incluirInativos=true` ativa modo gestão completo | Usuário autenticado sem `financeiro:view` pode listar CFOPs/planos inativos e árvore completa | Exigir `middlewareDeAutorizacao('financeiro:view')` no `GET /` e bloquear `incluirInativos=true` sem permissão de gestão (`financeiro:edit`) |

### 3.2 Severidade média

| # | Problema | Arquivo | Impacto | Recomendação |
|---|----------|---------|---------|--------------|
| 4 | **`X-Company-Id` opcional no middleware** | `src/infraestrutura/autenticacao/middleware-empresa-ativa.ts` (linha ~19) — retorna silenciosamente se header ausente | Comportamento inconsistente: alguns serviços retornam 400 (`servico-clientes.ts`), outros consultam com `companyId: ''` | Tornar `X-Company-Id` obrigatório em rotas que usam `middlewareEmpresaAtiva` |
| 5 | **Rotas autenticadas sem checagem de permissão** | Ex.: `GET /planos-financeiros/`, `GET /cfops/`, `GET /integracoes/cnpj/:documento`, `GET /permissions/modulos`, `GET /configuracoes/atalhos` | Escopo de acesso maior que o RBAC; proxy CNPJ aberto a qualquer usuário logado | Adicionar `middlewareDeAutorizacao` com permissão adequada em cada rota |
| 6 | **Concorrência em numeração sequencial** | `src/modulos/pedidos-compra/repositorio-pedidos-compra.ts` (`proximoNumero`) e `src/modulos/produtos/sku-sequencial.ts` | Duas requisições simultâneas podem gerar mesmo número/SKU; constraint `@@unique` evita duplicata, mas pode resultar em erro 500 | Usar `pg_advisory_xact_lock`, `SELECT FOR UPDATE` ou tabela de contadores atômica |
| 7 | **CORS permissivo** | `src/infraestrutura/http/servidor.ts` — `origin: true` | Qualquer origem pode chamar a API se possuir token JWT (risco combinado com XSS) | Restringir `origin` a domínios conhecidos em produção |
| 8 | **JWT em localStorage** | `frontend/services/api.ts`, `frontend/lib/sessao-local.ts` | Token acessível via XSS; cookie `erp_token` protege rotas Next.js, mas API usa Bearer do localStorage | Preferir cookie HttpOnly para o token ou reduzir superfície de XSS |

### 3.3 Severidade baixa

| # | Problema | Arquivo | Impacto | Recomendação |
|---|----------|---------|---------|--------------|
| 9 | **Sem rate limiting no login** | `src/modulos/autenticacao/controlador-autenticacao.ts` | Brute force de senha possível | Adicionar `@fastify/rate-limit` no endpoint `POST /auth/login` |
| 10 | **Endpoint público de assinatura de cliente** | `src/modulos/clientes/rotas-clientes.ts` | Token UUID é seguro, mas expõe CPF/CNPJ parcial a quem possui o link; sem rate limit | Adicionar rate limiting e revisar dados expostos na resposta pública |
| 11 | **Wildcards em buscas `contains`** | Vários repositórios (produtos, CFOPs, fornecedores, planos) | Input com `%` ou `_` pode ampliar resultados de busca (comportamento LIKE) | Escapar wildcards antes de passar ao filtro `contains` |

### 3.4 O que está bem implementado

- Isolamento multi-empresa na camada de serviço (ex.: `servico-pedidos-compra.ts`, `servico-produtos.ts` validam `companyId`)
- Validação Zod nos controladores
- Permissões consultadas no banco (não embutidas no JWT)
- `tokenVersion` invalida sessões de usuários desativados
- Reauth de senha para documentos ZapSign sensíveis (`middleware-reauth-assinatura.ts`)
- Path traversal bloqueado em uploads (`rotas-uploads.ts`)

---

## 4. SQL injection — análise do projeto

### 4.1 Por que o risco atual é baixo

1. **Prisma parametriza automaticamente** todos os valores passados em `where`, `data`, `select`, etc.
2. **Não há SQL raw** no código de produção — busca por `$queryRaw`, `$executeRaw`, `queryRawUnsafe` retornou zero ocorrências.
3. **Buscas com `contains`** (ex.: `nome: { contains: termo, mode: 'insensitive' }`) passam o termo como parâmetro bindado, não como fragmento de SQL.

Exemplo seguro atual em `src/modulos/produtos/repositorio-produtos.ts`:

```typescript
OR: [
  { nomeVenda: { contains: busca, mode: 'insensitive' } },
  { sku: { contains: busca, mode: 'insensitive' } },
]
```

O Prisma gera algo equivalente a:

```sql
WHERE "nomeVenda" ILIKE $1  -- $1 = '%valor%'
```

O input do usuário **nunca** é concatenado na string SQL.

### 4.2 Onde o risco aumentaria no futuro

| Cenário | Risco |
|---------|-------|
| Uso de `$queryRawUnsafe` / `$executeRawUnsafe` com interpolação de string | **Crítico** |
| Uso de `$queryRaw` com template string JavaScript (`\`SELECT ... ${input}\``) | **Crítico** |
| Scripts de manutenção com SQL manual sem parametrização | **Alto** |
| `orderBy` dinâmico com nome de coluna vindo do usuário sem whitelist | **Alto** |
| Filtros `contains` com wildcards não escapados | **Baixo** (amplia resultados, não executa SQL) |

---

## 5. Recomendações para prevenir SQL injection

### 5.1 Regras obrigatórias

1. **Manter Prisma como padrão** para todo acesso ao banco em código de produção.
2. **Proibir** `$queryRawUnsafe` e `$executeRawUnsafe` — nunca usar, mesmo em scripts.
3. **Se precisar de SQL raw**, usar apenas `Prisma.sql` com tagged template:

```typescript
// CORRETO — parâmetro bindado
const resultado = await prisma.$queryRaw`
  SELECT * FROM produtos WHERE company_id = ${companyId}
`

// ERRADO — interpolação direta em string
const resultado = await prisma.$queryRawUnsafe(
  `SELECT * FROM produtos WHERE company_id = '${companyId}'`
)
```

4. **Nunca montar SQL em controladores** — centralizar em repositórios.
5. **Validar inputs com Zod** antes de qualquer query (já feito na maioria dos módulos).

### 5.2 Filtros dinâmicos

**`contains` / LIKE — escapar wildcards:**

```typescript
function escaparWildcardsLike(termo: string): string {
  return termo.replace(/[%_\\]/g, '\\$&')
}

// Uso
{ nome: { contains: escaparWildcardsLike(termo), mode: 'insensitive' } }
```

**`orderBy` dinâmico — usar whitelist:**

```typescript
const COLUNAS_PERMITIDAS = ['nome', 'codigo', 'createdAt'] as const
type ColunaOrdenacao = (typeof COLUNAS_PERMITIDAS)[number]

function orderBySeguro(coluna: string): { [K in ColunaOrdenacao]?: 'asc' | 'desc' } {
  if (!COLUNAS_PERMITIDAS.includes(coluna as ColunaOrdenacao)) {
    return { nome: 'asc' }
  }
  return { [coluna]: 'asc' }
}
```

**`in` dinâmico — validar tipos e tamanho:**

```typescript
const ids = z.array(z.string().uuid()).max(100).parse(inputIds)
await prisma.produto.findMany({ where: { id: { in: ids } } })
```

### 5.3 Automação e CI

Adicionar verificação no pipeline que **falha o build** se detectar padrões perigosos:

```bash
# Exemplo de grep para CI
rg '\$queryRawUnsafe|\$executeRawUnsafe' src/ && exit 1
rg '\$queryRaw`\s*SELECT.*\$\{' src/ && exit 1
```

Opcional: regra ESLint customizada `no-unsafe-prisma-raw`.

### 5.4 Testes de segurança

Incluir testes nos endpoints de busca com payloads clássicos:

| Payload | Resultado esperado |
|---------|-------------------|
| `' OR 1=1--` | Lista vazia ou erro 400, nunca todos os registros |
| `; DROP TABLE produtos--` | Tratado como texto literal na busca |
| `%` | Resultados controlados (com escape de wildcard) |
| `_` | Resultados controlados (com escape de wildcard) |
| String vazia | Lista padrão ou erro de validação |
| String com 10.000 caracteres | Erro 400 por limite de tamanho |

---

## 6. Correções recomendadas (priorizadas)

### Prioridade 1 — corrigir imediatamente

| # | Correção | Arquivo |
|---|----------|---------|
| 1 | Proteger rota de uploads com autenticação + validação de empresa | `src/infraestrutura/http/rotas-uploads.ts` |
| 2 | Exigir `webhookSecret` para processar webhooks ZapSign | `src/modulos/assinatura-zapsign/servico-assinatura-zapsign.ts` |
| 3 | Adicionar `middlewareDeAutorizacao('financeiro:view')` no `GET /cfops` e `GET /planos-financeiros` | `src/modulos/cfops/rotas-cfops.ts`, `src/modulos/planos-financeiros/rotas-planos-financeiros.ts` |
| 4 | Bloquear `?incluirInativos=true` sem permissão `financeiro:edit` | `src/modulos/cfops/controlador-cfops.ts`, `src/modulos/planos-financeiros/controlador-planos-financeiros.ts` |

### Prioridade 2 — corrigir em seguida

| # | Correção | Arquivo |
|---|----------|---------|
| 5 | Tornar `X-Company-Id` obrigatório no middleware | `src/infraestrutura/autenticacao/middleware-empresa-ativa.ts` |
| 6 | Adicionar permissões nas rotas sem RBAC | `src/modulos/integracoes/rotas-integracoes.ts`, `src/modulos/permissoes/rotas-permissoes.ts`, `src/modulos/configuracoes/rotas-configuracoes.ts` |
| 7 | Tornar `proximoNumero` e `proximoSkuNumerico` atômicos | `src/modulos/pedidos-compra/repositorio-pedidos-compra.ts`, `src/modulos/produtos/sku-sequencial.ts` |

### Prioridade 3 — melhorias de hardening

| # | Correção | Arquivo |
|---|----------|---------|
| 8 | Restringir CORS em produção | `src/infraestrutura/http/servidor.ts` |
| 9 | Rate limiting no login | `src/modulos/autenticacao/rotas-autenticacao.ts` |
| 10 | Escapar wildcards em buscas `contains` | Repositórios com filtros de texto |
| 11 | Helper compartilhado `escaparWildcardsLike` | `src/compartilhado/normalizacao/` (novo arquivo) |

### Snippets de referência para as correções

**middleware-empresa-ativa.ts — tornar header obrigatório:**

```typescript
if (!empresaAtivaId) {
  throw new ErroDaAplicacao('Empresa ativa não informada. Selecione uma empresa.', 400)
}
```

**rotas-cfops.ts — exigir permissão no GET /:**

```typescript
aplicacao.get(
  '/',
  { preHandler: [...auth, middlewareDeAutorizacao('financeiro:view')] },
  controladorDeCfops.listarCfops
)
```

**servico-assinatura-zapsign.ts — rejeitar webhook sem secret:**

```typescript
if (!webhookSecret) {
  throw new ErroDaAplicacao('Webhook não configurado', 401)
}
if (headerSecret !== webhookSecret) {
  throw new ErroDaAplicacao('Webhook secret inválido', 401)
}
```

**proximoNumero — lock transacional com advisory lock:**

```typescript
import { Prisma } from '@prisma/client'

async function proximoNumero(companyId: string, tx: Prisma.TransactionClient): Promise<number> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`)
  const ultimo = await tx.pedidoCompra.findFirst({
    where: { companyId },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  return (ultimo?.numero ?? 0) + 1
}
```

---

## 7. Fluxo de risco — autorização

```
Requisição autenticada
  → X-Company-Id presente?
      Não → Middleware retorna sem erro
          → Controlador usa companyId = ''
          → Serviço valida companyId?
              Sim → 400 "Empresa não informada"
              Não → Query com companyId vazio (vazamento de dados)
      Sim → middlewareDeAutorizacao presente?
          Não → Dados expostos sem RBAC
          Sim → Acesso correto
```

---

## 8. Checklist de revisão para novos PRs

Use este checklist ao revisar pull requests que tocam banco de dados ou rotas HTTP:

### SQL injection

- [ ] Não usa `$queryRawUnsafe` nem `$executeRawUnsafe`
- [ ] Se usa `$queryRaw`, usa `Prisma.sql` tagged template com parâmetros
- [ ] Inputs de busca passam por validação Zod
- [ ] Filtros `contains` escapam wildcards `%` e `_`
- [ ] `orderBy` dinâmico usa whitelist de colunas
- [ ] Queries ficam em repositórios, não em controladores

### Autorização

- [ ] Rota protegida com `middlewareDeAutenticacao`
- [ ] Rotas multi-empresa usam `middlewareEmpresaAtiva`
- [ ] Ação exige `middlewareDeAutorizacao` com permissão correta
- [ ] Parâmetros de query (`incluirInativos`, etc.) não bypassam RBAC
- [ ] Serviço valida `companyId` e ownership do recurso

### Dados sensíveis

- [ ] Endpoints públicos não expõem dados desnecessários
- [ ] Webhooks validam secret/autenticidade
- [ ] Uploads exigem autenticação
- [ ] Secrets (API keys, JWT) não vão para o frontend

### Concorrência

- [ ] Numeração sequencial é atômica (lock, sequence ou retry em unique violation)
- [ ] Operações financeiras usam transação Prisma

---

## 9. Referências internas

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/infraestrutura/autenticacao/middleware-de-autenticacao.ts` | Valida JWT + tokenVersion |
| `src/infraestrutura/autenticacao/middleware-empresa-ativa.ts` | Valida X-Company-Id |
| `src/infraestrutura/autenticacao/middleware-de-autorizacao.ts` | Checa permissão no banco |
| `src/modulos/permissoes/repositorio-permissoes.ts` | Consulta permissões efetivas |
| `src/compartilhado/banco-dados/cliente-prisma.ts` | Instância singleton do Prisma |
| `prisma/schema.prisma` | Schema e constraints (unique, FK) |

---

*Documento gerado por auditoria estática do código. Recomenda-se validação manual e testes de penetração antes de deploy em produção.*
