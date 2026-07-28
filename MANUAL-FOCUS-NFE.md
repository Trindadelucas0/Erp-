# Manual — Focus NFe (NFe 55 + NFS-e + CTe Recebidas / Entrada de Notas)

> Documentação oficial: https://doc.focusnfe.com.br/reference/introducao  
> NFe recebidas: https://doc.focusnfe.com.br/reference/nfe-recebidas  
> CTe recebidas: https://doc.focusnfe.com.br/reference/consultar_ctes_recebidas  
> Autenticação: https://doc.focusnfe.com.br/reference/autenticacao  
> Painel: https://app.focusnfe.com.br  
> **Cadastro da empresa na Focus (passo a passo):** [`GUIA-FOCUS-CADASTRO-EMPRESA.md`](GUIA-FOCUS-CADASTRO-EMPRESA.md)

---

## O que é

O ERP usa a API Focus para documentos **recebidos** (emitidos por terceiros **contra o CNPJ** da empresa):

- **NFe modelo 55** (produto) — DistDFe / `GET /v2/nfes_recebidas`
- **NFS-e nacional** (serviço) — `GET /v2/nfsens_recebidas`
- **CTe** (conhecimento de transporte) — `GET /v2/ctes_recebidas`

**Não** usa emissão de NFe/NFS-e/CTe nesta integração. MDF-e fica de fora.

A tela **Entrada de Notas** (`/entrada-notas`) lista os três tipos na mesma fila (coluna **Tipo**: NFe / NFS-e / CTe).  
Clique na nota → `/entrada-notas/[id]` (pipeline).  
- NFe 55: cadastro + fiscal + negociação → se ok, `entrada_contagem` (estoque).  
- NFS-e: só cadastro do prestador → liberação documental (`entrada_contagem`, **sem** movimento de estoque/itens).
- CTe: só cadastro do emitente (transportadora) → liberação documental (igual NFS-e).

---

## Configurar o token (passo a passo)

### 1. Conta Focus — token certo

1. Acesse [https://app.focusnfe.com.br](https://app.focusnfe.com.br).
2. Abra a **empresa** com o **mesmo CNPJ** do Cadastros no ERP (empresa ativa no seletor).
3. Copie o campo **`token_homologacao`** (não use `token_producao` enquanto testar em homologação).
4. Confirme no painel Focus → **Documentos fiscais**:
   - **Recebimento de NFes** (produto)
   - **Recebimento de NFSes do ambiente nacional** (serviço) — diferente de “Ambiente da NFSe Nacional” (emissão)
   - **Recebimento de CTes** (transporte), se disponível no painel

### 2. Ambientes

| Ambiente | URL base | Token no painel | Checkbox no ERP |
|----------|----------|-----------------|-----------------|
| Homologação | `https://homologacao.focusnfe.com.br` | `token_homologacao` | Homologação **marcado** |
| Produção | `https://api.focusnfe.com.br` | `token_producao` | Homologação **desmarcado** |

Auth: HTTP Basic — **usuário = token**, **senha vazia** (`curl -u 'TOKEN:'`).

**Importante:** token de produção **não** funciona no host de homologação (erro 401).

### 3. No ERP (recomendado — por empresa)

1. Selecione a **empresa correta** no topo (CNPJ deve bater com a Focus).
2. Admin → **Configurações → Focus NFe**
3. Confira o CNPJ exibido no aviso “Configuração desta empresa ativa”.
4. Colar **token_homologacao**, marcar homologação.
5. **Salvar** → **Testar conexão** (chama `GET /nfes_recebidas?cnpj=…`; lista vazia = OK).

Cada empresa do ERP tem seu próprio registro de token. Se trocar de empresa no seletor, salve o token de novo nessa empresa.

### 4. Via `.env` (fallback global)

Preferível: salvar no painel (item 3) → `fonte=banco`. O `.env` só vale quando a empresa ativa **não** tem config no banco.

```
# Par obrigatório — não misture token de um ambiente com flag do outro:
# homologação → token_homologacao + FOCUS_NFE_HOMOLOGACAO=true
# produção    → token_producao    + FOCUS_NFE_HOMOLOGACAO=false
FOCUS_NFE_TOKEN=seu_token
FOCUS_NFE_HOMOLOGACAO=true
FOCUS_NFE_LOG_VERBOSE=false
FOCUS_NFE_COTA_HABILITADA=true
FOCUS_NFE_COTA_MENSAL=100
FOCUS_NFE_CUSTO_EXTRA_CENTAVOS=10
# FOCUS_NFE_AGENDADOR=false  # desliga sync automático (~2 min)

# Recursos Ver nota / XML / PDF (padrão instalação; override por empresa em Cadastros)
# ENTRADA_NOTAS_VER_NOTA=true
# ENTRADA_NOTAS_BAIXAR_XML=true
# ENTRADA_NOTAS_BAIXAR_PDF_FOCUS=true    # DANFE/DACTe oficial na Focus
# ENTRADA_NOTAS_DANFE_CACHE_INDISPONIVEL_HORAS=24
# ENTRADA_NOTAS_DANFE_RATE_LIMIT_MINUTOS=2
```

Reinicie a API após mudar o `.env`. Logs com `fonte=env` indicam esse fallback — se o token do `.env` for de **produção** e alguém testar como se fosse homolog (ou o contrário), aparece 401/400 mesmo com CNPJ correto no Cadastros.

**Plano comercial (documento):** `GET /focus-nfe/recursos-documento` devolve a config efetiva (env + `Company.recursosEntradaNotasJson`). Detalhes em `GUIA-FLUXO-ENTRADA-NOTAS.md` (seção PDF e recursos).

### 5. Habilitar manifestação na Focus (obrigatório para NFe recebidas)

A [OpenAPI oficial](https://doc.focusnfe.com.br/reference/consultar_nfes_recebidas) documenta o **400** exatamente assim:

`{ "codigo": "requisicao_invalida", "mensagem": "CNPJ do emitente não autorizado ou não informado" }`

(e **403** `permissao_negada` / “CNPJ do emitente não autorizado.”).  
Isso **não** significa CNPJ digitado errado no ERP — significa que o CNPJ **não está autorizado a consultar NFe recebidas** naquela conta/ambiente.

Na API de empresas a Focus tem flags separadas:

| Flag API | Uso |
|----------|-----|
| `habilita_manifestacao` | Recebimento em **produção** |
| `habilita_manifestacao_homologacao` | Recebimento em **homologação** |

No painel: **Documentos fiscais → Recebimento de NFes** (ligar e salvar). Se testar com homologação no ERP, confira se o recebimento vale também para homologação.

Passos:

1. Focus → Empresas → **DETALHES** → **Documentos fiscais** → ligar **Recebimento de NFes**.
2. **Salvar** na Focus.
3. Re-copiar `token_homologacao` (olho) se quiser.
4. ERP → Focus NFe → Salvar (`fonte=banco`) → **Testar conexão**.

Sem isso, token + CNPJ + ambiente corretos ainda retornam **400/403**.

---

## Usar a Entrada de Notas

1. Liberar a página **Entrada de Notas** ao usuário (ou admin).
2. Abrir `/entrada-notas`.
3. Escolher o **painel**: Em análise · Liberadas p/ contagem · Consolidadas · Canceladas.
4. No painel **Em análise**: as notas entram **sozinhas** pelo agendador (~2 min). **BUSCAR** força sync imediato (NFe + NFS-e + CTe), completar dados, vincular fornecedores e atualizar a lista. CTe só entra se a empresa for **tomadora do frete**. A lista mostra **Tipo** (NFe / NFS-e / CTe), **emitente** e **destinatário** com validação **Nosso CNPJ** / **Outro destinatário** / **A confirmar**.
5. **Importar XML** — fallback se precisar; o ERP processa **um por vez** e aceita **NFe 55**, **NFS-e nacional** ou **CTe**. Bloqueia se a **chave** já teve entrada; CTe só se formos tomador.
6. Filtro **Emissão de/até** — padrão = **mês corrente**; só filtra a lista local. **Ver todas (sem data)** remove o filtro. A API Focus **não** filtra por data.
7. **Pesquisar na lista** / **Filtrar** — lê só o banco local (não martela a Focus).
8. **Abrir a nota** — clique na linha → análise + botões (Liberar críticas **com senha de gerente**, Contato, manifesto, lançamento).

**Cota Focus (API):** o agendador consome a API a cada ~2 min (lotes de 10). Desligar: `FOCUS_NFE_AGENDADOR=false` no `.env` e reiniciar a API. **BUSCAR** continua disponível.

**Cota comercial mensal (plano):** por empresa, limita quantas notas **novas** da Focus entram no mês (`FOCUS_NFE_COTA_MENSAL`, padrão 100). Notas já salvas (mesma chave) não contam e não rebaixam XML completo. Ao esgotar, o agendador **pausa**; o **BUSCAR** ainda reprocessa/vincula/atualiza a lista local e **pergunta** antes de liberar extras na Focus (`FOCUS_NFE_CUSTO_EXTRA_CENTAVOS`, padrão 10 = R$ 0,10). Barra de uso: **Configurações → Focus NFe**. Desligar bloqueio: `FOCUS_NFE_COTA_HABILITADA=false` ou `FOCUS_NFE_COTA_MENSAL=0`. Status: `GET /focus-nfe/cota`. Importar XML local **não** consome a cota.

Após **Liberar para contagem** (auto ou manual), a nota some de Em análise e aparece no painel **Liberadas p/ contagem**. Consolidar → painel Consolidadas. Manifesto/cancelar → Canceladas.

**Escopo do sync:** **NFe modelo 55** + **NFS-e nacional** + **CTe** recebidos contra o CNPJ da empresa.  
**Filtro CTe (tomador):** a Focus **não** diferencia tomador na listagem. O ERP só **persiste / baixa XML / gera entrada** de CTe quando o CNPJ da empresa é o **tomador do frete** (campo TOMADOR DO SERVIÇO no DACTe / `ide/toma` no XML). Frete pago pelo fornecedor (tomador = remetente) é ignorado no sync (cursor avança; log `sync_cte_ignorado_nao_tomador`). Importar XML de CTe segue a mesma regra (HTTP 400 se não formos tomador).  
Não entram: notas que a própria empresa **emitiu** (venda); MDF-e; NFS-e municipal fora do ambiente nacional; CTe em que a empresa não é tomadora.

| Controle na tela Em análise | Chama Focus? |
|-----------------------------|-------------|
| **BUSCAR** | Sim (sync) → `GET /nfes_recebidas`, `GET /nfsens_recebidas` **e** `GET /ctes_recebidas`; depois completar/vincular só no banco |
| Filtro Emissão de/até | Não — só banco local |
| **Pesquisar na lista** / **Filtrar** | Não — só banco local |
| **Importar XML** | Não — grava no ERP (NFe 55, NFS-e ou CTe) |

Após import/sync com XML o ERP **roda o pipeline automaticamente**. NFe 55: se travar (fornecedor, produto, PO, prazo), fica `em_analise`. NFS-e/CTe: só vínculo do emitente; sem estoque.

### NFe 55 vs NFS-e vs CTe

| Documento | O que é | Sync / import Entrada de Notas? |
|-----------|---------|----------------------------------|
| **NFe modelo 55** | Nota de **produto** (DistDFe / MDe) | Sim — `GET /v2/nfes_recebidas` + XML |
| **NFS-e nacional** | Nota de **serviço** (Ambiente Nacional) | Sim — `GET /v2/nfsens_recebidas` + XML; exige flag **Recebimento de NFSes do ambiente nacional** |
| **CTe** | Conhecimento de **transporte** | Sim — `GET /v2/ctes_recebidas` + XML; **só se a empresa for tomadora do frete**; pipeline documental |

Exemplo: XML com `<NFSe>` / `Id="NFS…"` (prestador de serviço) entra com **Tipo NFS-e**. XML com `<CTe>` / `Id="CTe…"` entra com **Tipo CTe**. Sem a flag na Focus, o sync de NFS-e/CTe pode falhar ou vir vazio — o sync de NFe 55 **não** é derrubado.

### Endpoints Focus — o que usar e o que não usar

| Endpoint Focus | Uso | Neste ERP |
|----------------|-----|-----------|
| `GET /v2/nfes_recebidas` | NFes **55** contra o CNPJ (DistDFe) | Sync Entrada de Notas |
| `POST .../nfes_recebidas/{chave}/manifesto` + XML | Ciência e XML completo (NFe) | Sync após listar |
| `GET /v2/nfsens_recebidas` (+ `/{chave}.xml`) | NFS-e nacionais recebidas | Sync Entrada de Notas |
| `GET /v2/ctes_recebidas` (+ `/{chave}.xml` / `.pdf`) | CTe recebidos | Sync Entrada de Notas |
| `POST /v2/nfe/importacao` | Importar XML de NFe **emitida** (cancelamento / CCe) | **Fora de escopo** — não integrar na Entrada |

Lista vazia com sync **OK** e `X-Total-Count: 0` em NFe = Focus sem DistDFe ainda (data início, certificado, outro consumidor de NSU). NFS-e/CTe zerados = flag de recebimento off ou sem documentos no período.

### Meta do cliente: NFe + NFS-e + CTe

O ERP busca os **três** tipos no botão **BUSCAR**. Se na tela só aparecer **NFS-e**:

1. Olhe a mensagem do job (ex.: `0 NFe (DistDFe vazio) · NFS-e … · 0 CTe`).
2. Na Focus (mesmo CNPJ, produção): ligar **Recebimento de NFes**, **NFS-e nacional** e **Recebimento de CTes**; certificado A1; DistDFe sem outro consumidor de NSU.
3. No ERP: Testar conexão → **BUSCAR** (e **Ver todas (sem data)** se o filtro de datas esconder notas).
4. Se ainda houver filtro manual, clique **Ver todas (sem data)**.

Checklist operacional Focus (produção):

| Item | Onde |
|------|------|
| Token `token_producao` | Painel Focus → empresa |
| Homologação **desmarcada** no ERP | Configurações → Focus NFe |
| Recebimento de NFes / `habilita_manifestacao` | Documentos fiscais |
| Recebimento de NFS-e nacional | Documentos fiscais |
| Recebimento de CTes | Documentos fiscais |
| Painel Focus lista NFe/CTe recebidas | Confirmar se DistDFe tem docs |

Logs: `sync_nfe_vazia` / `sync_cte_vazia` quando a Focus devolve `qtd=0` naquele tipo.

---

## Logs — o que está acontecendo

Prefixo: **`[focus-nfe]`**

```bash
# VPS
pm2 logs erp-api --lines 100 | findstr focus-nfe
```

Eventos típicos: `config_salva`, `teste_conexao_inicio`, `teste_conexao`, `sync_credenciais`, `job_criado`, `job_inicio`, `sync_pagina`, `sync_pagina_nfse`, `sync_pagina_cte`, `sync_nfe_vazia`, `sync_cte_vazia`, `sync_persistidas`, `job_fim`, `job_recusado_409`, `api_erro`, `import_xml`.

Logs incluem `fonte=banco|env`, `cnpj=********XXXX` (mascarado). **Nunca** loga token, Authorization ou XML completo.

`FOCUS_NFE_LOG_VERBOSE=true` → detalhe de cada HTTP.

---

## Diagnóstico de erros

| Código / sintoma | Causa | O que fazer |
|------------------|-------|-------------|
| **401** Access token inválido | Token errado ou de outro ambiente (ex.: token produção no host homolog) | Usar `token_homologacao` + homolog marcado (ou produção + desmarcado). Se `fonte=env`, alinhar `.env` ou salvar no banco |
| **400** / **403** CNPJ não autorizado | Flag de **Recebimento de NFes** off (em homolog: `habilita_manifestacao_homologacao`). Mensagem oficial da Focus. | Documentos fiscais → ligar Recebimento de NFes → Salvar; retestar |
| **404** em `/empresas` (teste antigo) | Endpoint errado (já corrigido) | Atualizar código; o teste agora usa `/nfes_recebidas` |
| **409** sync | Já há job na empresa | Esperar o job atual terminar |
| Lista vazia após sync OK | Focus `X-Total-Count: 0` (sem DistDFe / NFS-e / CTe ainda) | Conferir Recebimento NFe, NFS-e nacional e CTe + certificado + data início; Importar XML; suporte Focus |
| Só NFS-e aparece; NFe/CTe zerados | DistDFe NFe/CTe vazio na Focus (ERP já chama os 3 endpoints) | Mensagem do job avisa DistDFe; ligar Recebimento NFes/CTe; BUSCAR + Ver todas |
| Import XML de NFS-e / CTe | Aceito (tipo `nfse` / `cte`) | Pipeline só cadastro; sem estoque. CTe: 400 se empresa ≠ tomador. Se 400: XML ilegível / sem chave / não tomador |
| Usar `POST /nfe/importacao` para compras | Endpoint de **emissão**, não recebidas | Não usar — sync `/nfes_recebidas` + `/nfsens_recebidas` + `/ctes_recebidas` ou Importar XML |

---

## Fluxo do cliente (produto)

1. **Cadastro** — fornecedor por CNPJ; produto: barras → código original → busca manual  
2. **Fiscal** — confere NCM, origem e CST/CFOP (NF × produto); regras em `regrasFiscaisJson`  
3. **Negociação** — PO × NF (preço, qtd, itens, prazo); positiva = auto; negativa = humano  
4. **Lançamento** — auto = Liberar para contagem; humano = Consolidar (senha) ou Liberar contagem  

Botões humanos: Liberar críticas (**senha de gerente**), Cancelar liberação, Contato fornecedor (stand-by), Desconhecimento da operação.

---

## Regras fiscais (config)

Campo `ConfiguracaoFocusNfe.regrasFiscaisJson` — editável em **Configurações → Focus NFe** (card **Análise fiscal**), por empresa.

Default (novas configs / fallback de código):

```json
{
  "versaoSchema": 1,
  "ativo": true,
  "checks": ["ncm", "origem", "cst_cfop"],
  "observacao": "Confere NCM, origem e CST/CFOP (NF × produto). Divergência NCM/origem: importar da NF. CST/CFOP: bloqueia — desconhecimento ou devolução."
}
```

1. Salve o **token** da empresa (`fonte=banco`).
2. Confira **Ativar análise fiscal** + checks → **Salvar regras fiscais** (desligue só se quiser opt-out).
3. Na nota → **Reanalisar**.

Com `ativo: false` a análise **não bloqueia** (aviso “análise fiscal desligada”). Com `ativo: true`, divergência NCM/origem bloqueia (dá para importar da NF para o produto); CST/CFOP ausente na NF bloqueia — desconhecimento da operação ou devolução. API: `PUT /focus-nfe/regras-fiscais`. Código: `src/modulos/entrada-notas/analise-fiscal/`.

---

## Conformidade com a API oficial (auditoria)

Referência: [Introdução](https://doc.focusnfe.com.br/reference/introducao) · [Auth](https://doc.focusnfe.com.br/reference/autenticacao) · [Ambiente](https://doc.focusnfe.com.br/reference/ambiente) · [Consultar NFe recebidas](https://doc.focusnfe.com.br/reference/consultar_nfes_recebidas)

| Item da doc | Código ERP | Status |
|-------------|------------|--------|
| Basic Auth `token:` | `montarAuth` | OK |
| Homolog `homologacao.focusnfe.com.br/v2` | `URL_HOMOLOG` | OK |
| Produção `api.focusnfe.com.br/v2` | `URL_PROD` | OK |
| `GET /nfes_recebidas?cnpj=` (recebedor) | `listarNfesRecebidas` / `testarConexao` | OK |
| `versao` incremental + `X-Max-Version` | sync em `servico-focus-nfe` | OK |
| Página de até 100 notas | loop até `lista.length < 100` | OK |
| `pendente` / `pendente_ciencia` | query opcional no cliente | OK (não usados na sync padrão) |
| `POST .../manifesto` | `manifestar` | OK (API pronta; UI futura) |
| XML `.xml` / JSON `.json` | `baixarXml` / `consultarJson` | OK |
| `habilita_manifestacao(_homologacao)` | painel Focus (não no ERP) | Operacional — causa do 400 atual |
| Emissão NFe / CTe / NFSe | — | Fora de escopo (só recebidas) |
| `POST /nfe/importacao` (emissão) | — | Fora de escopo — não usar na Entrada |
| Webhooks / DANFe PDF | — | Não implementado (fase futura; sync por polling basta) |

HTTP **400** `CNPJ do emitente não autorizado…` em `/nfes_recebidas` = exemplo oficial OpenAPI para CNPJ sem manifestação — não indica bug de URL/auth no ERP. Lista **200** com `[]` = autorizado, sem documentos.

---

## O que foi feito no código

| Peça | Path |
|------|------|
| Cliente Focus + rate limit | `src/modulos/focus-nfe/cliente-focus-nfe.ts` |
| Mensagens 401/400 | `src/modulos/focus-nfe/mensagens-focus-nfe.ts` |
| Logs | `src/modulos/focus-nfe/logs-focus-nfe.ts` |
| Jobs / trava | `src/modulos/focus-nfe/fila-focus-nfe.ts`, `servico-focus-nfe.ts` |
| Rotas API | `/focus-nfe/*` em `rotas-focus-nfe.ts` |
| Models | `ConfiguracaoFocusNfe`, `FocusNfeJob`, `NfeRecebida` |
| Config UI | `/configuracoes/focus-nfe` |
| Lista / XML | `/entrada-notas` |
| Agendador (~2 min) | `agendador-focus-nfe.ts` — iniciado em `aplicacao.ts` (off: `FOCUS_NFE_AGENDADOR=false`) |
| Cota mensal comercial | `cota-focus-nfe.ts` + gate em `enfileirarSync` / sync (env `FOCUS_NFE_COTA_*`) |
| Recursos Ver nota / XML / PDF | `config-recursos-entrada-notas.ts` (env `ENTRADA_NOTAS_*`) |
| Manual | este arquivo |
| Doc sistema | `DOCUMENTACAO-SISTEMA.md` |

### Rotas ERP

| Método | Rota | Quem |
|--------|------|------|
| GET/POST | `/focus-nfe/config` | Admin |
| PUT | `/focus-nfe/regras-fiscais` | Admin (análise fiscal Entrada de Notas) |
| POST | `/focus-nfe/testar-conexao` | Admin (usa CNPJ da empresa ativa) |
| POST | `/focus-nfe/jobs/sincronizar` | Autenticado (202); body `liberarExtras` se cota esgotada |
| GET | `/focus-nfe/jobs/:id` | Autenticado |
| GET | `/focus-nfe/cota` | Autenticado (uso do mês vs cota) |
| GET | `/focus-nfe/nfe-recebidas` | Autenticado |
| GET | `/entrada-notas/:id` | Detalhe + itens + análise |
| POST | `/entrada-notas/:id/analisar` | (Re)roda pipeline |
| POST | `/entrada-notas/:id/vincular-item` | Vínculo manual |
| POST | `/entrada-notas/:id/liberar-criticas` | Avança com críticas |
| POST | `/entrada-notas/:id/lancar` | contagem \| consolidar (+ senha) |

---

## Ainda não nesta entrega (próximas fases)

- Movimentação real de estoque / contas a pagar no “Consolidar estoque” (hoje só status)
- Webhooks Focus
- Emissão de NFe
