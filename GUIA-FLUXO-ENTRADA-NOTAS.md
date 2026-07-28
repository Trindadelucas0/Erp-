# Guia — Fluxo Focus NFe + Entrada de Notas

| Item | Valor |
|------|--------|
| Objetivo | Explicar ponta a ponta como Focus alimenta a fila e como o pipeline de Entrada de Notas funciona |
| Público | Operação, suporte e desenvolvimento |
| Documento do cliente | `ENTRADA DE NOTAS.docx` (pedido de compra / entrada em 4 etapas) |
| Fonte oficial de comportamento | [`DOCUMENTACAO-SISTEMA.md`](DOCUMENTACAO-SISTEMA.md) §6.17b (Focus) e §6.17c (Entrada de Notas) |
| Manual técnico Focus | [`MANUAL-FOCUS-NFE.md`](MANUAL-FOCUS-NFE.md) |
| Cadastro empresa Focus | [`GUIA-FOCUS-CADASTRO-EMPRESA.md`](GUIA-FOCUS-CADASTRO-EMPRESA.md) |

Este guia **não** substitui `DOCUMENTACAO-SISTEMA.md`. Serve para leitura humana do fluxo.

---

## Visão geral

O sistema divide em **duas peças ligadas**:

1. **Configuração Focus** (`/configuracoes/focus-nfe`) — token + regras fiscais  
2. **Entrada de Notas** (`/entrada-notas` e `/entrada-notas/[id]`) — lista + análise + lançamento  

```text
Config Focus (token + regras fiscais)
        │
        ▼
Sync Focus / Importar XML ──► NfeRecebida (banco local)
        │
        ▼
Pipeline 4 etapas (cadastro → fiscal → negociação → lançamento)
        │
        ▼
Painéis: Em análise · Liberadas p/ contagem · Consolidadas · Canceladas
```

A lista **não consulta a Focus a cada clique** — ela lê o banco local. A Focus entra no **sync em lote**, no **import manual de XML** e quando falta XML/PDF na nota.

---

## Parte 1 — Configuração Focus (`/configuracoes/focus-nfe`)

Antes de qualquer nota entrar, o admin configura:

| O quê | Para quê |
|-------|----------|
| **Token Focus** (por empresa) | Buscar NFe/NFS-e/CTe recebidas na API DistDFe |
| **Homologação** | Ambiente de teste vs produção |
| **Testar conexão** | Valida token + CNPJ da empresa ativa |
| **Análise fiscal (Entrada de Notas)** | Liga as regras da etapa 2 do pipeline |

### Card “Análise fiscal”

Grava em `regrasFiscaisJson`:

- `ativo: true/false`
- `checks`: `ncm`, `origem`, `cst_cfop`
- observação interna

**Documento do cliente:** manter **ativo** com os **três checks**. Sem isso, a etapa fiscal só avisa e não bloqueia de verdade.

Ao clicar **Reanalisar** numa nota, o pipeline lê essas regras do banco.

---

## Parte 2 — Como a nota chega na fila (`/entrada-notas`)

### Duas origens (como no documento do cliente)

1. **Sync Focus** — botão **BUSCAR** (sob demanda) + agendador (~2 min): sync NFe+NFS-e+CTe → completar XMLs → vincular fornecedores → atualizar lista
   - Job assíncrono, lotes de até 10 notas
   - Grava em `NfeRecebida` (chave única por empresa — **não duplica entrada**)
   - Cota mensal (`.env`): só notas **novas** contam; ao esgotar o agendador pausa e o BUSCAR pede confirmação de extras
   - Se veio XML → dispara `processarAposXml` → pipeline automático

2. **Importar XML** — fallback manual (quando a API não trouxe ou falhou)
   - Upload ou cola de `.xml` (NFe 55, NFS-e ou CTe)
   - Mesma anti-duplicidade pela **chave da NF**
   - **Não** consome a cota mensal Focus
   - Também dispara o pipeline

### Painéis da lista

| Painel | Status no banco | Significado |
|--------|-----------------|-------------|
| Em análise | `pendente`, `em_analise`, `stand_by` | Ainda no pipeline |
| Liberadas p/ contagem | `entrada_contagem` | Passou nas análises (ou liberado) |
| Consolidadas | `entrada_consolidada` | Lançamento com senha de gerente |
| Canceladas | `cancelada` | Manifesto desconhecimento / não realizada. Pode voltar para **Em análise** com **Desfazer cancelamento** no detalhe |

Clique na linha → abre `/entrada-notas/[id]` (tela de análise).

---

## Parte 3 — Pipeline de etapas (wizard)

Orquestrado por `src/modulos/entrada-notas/servico-pipeline-entrada.ts`.

Para **NFe 55 (produto)** roda na ordem:

```text
1. Cadastro → 2. Fiscal → 3. Negociação → 4. Frete/CT-e → 5. Lançamento
```

UI: abas sequenciais em `/entrada-notas/[id]` (não mostra as 3 etapas lado a lado).

Se **todas passam**, a nota vai **automaticamente** para `entrada_contagem`.  
Se trava, fica em `em_analise` com `motivoParada` (`cadastro` / `fiscal` / `negociacao` / `frete` / `vinculo_nfe`).

**Frete:** se `modFrete=1` (destinatário), exige CT-e vinculado (auto pela chave do XML ou **manual** na aba Frete/CT-e com a chave 44 dígitos do CT-e já importado). Não libera por senha. Rateio do valor do CT-e nos itens usa `regraRateioFrete` do fornecedor.

**Navegação Frete / CT-e na NF:** a aba **Frete / CT-e** da NF de mercadoria fica **sempre acessível** (consulta e vínculo manual), mesmo com Cadastro/Fiscal/Negociação pendentes. **Lançamento** continua bloqueado até o pipeline completo. O link da NF no CT-e abre `/entrada-notas/[id]?aba=frete`. CT-es vinculados também aparecem no card **Resumo** da NF.

---

### Etapa 1 — Cadastro

**Documento:** verificar fornecedor pelo CNPJ; vincular produtos por barras → código original → busca manual.

**Sistema** (`analise-cadastro/analisar-cadastro.ts`):

1. **Fornecedor:** busca no ERP pelo CNPJ/CPF do emitente do XML  
   - Achou → vincula `fornecedorPessoaId`  
   - Não achou → **BLOQUEANTE** (“Fornecedor não cadastrado…”)

2. **Produtos (cada item da NF):**  
   - 1º: código de barras (`cEAN` / `gtin`) em todos os códigos do produto  
   - 2º: código original (`cProd`) no vínculo produto × fornecedor  
   - 3º: usuário busca manualmente na tela

3. **Opcional:** “Gravar código original no vínculo” (1 clique)

**Regra:** cadastro **nunca** é contornado por “Liberar críticas”. Só resolve cadastrando/vinculando + Reanalisar.

**Qtd embalagem / Qtd total UN:** se o produto tem múltiplo de compra (`ProdutoFornecedor.multiplicadorEntrada`) configurado para o fornecedor da nota, o grid mostra, abaixo da qtd × unit., a linha "Qtd embalagem: X · Qtd total UN: Y" (`quantidade` da NF × múltiplo) — mesma lógica do Pedido de Compra. É só prévia visual, não move estoque nem persiste quantidade nova. NCM **não** aparece nesta aba (foi para a Fiscal, abaixo).

---

### Etapa 2 — Fiscal

**Documento:** conferir NCM, origem, CST/CFOP (NF × produto). Divergência NCM/origem → importar da NF. Problema CST/CFOP → só devolução ou desconhecimento. **Não se aplica a NFS-e.**

**Sistema** (`analise-fiscal/analisar-fiscal-itens.ts`), com regras ativas + checks marcados:

| Verificação | O que compara | Se falhar | Caminho |
|-------------|---------------|-----------|---------|
| **NCM** | NF × produto cadastrado | Bloqueio **liberável** | Importar NCM da NF **ou** senha gerente |
| **Origem** | NF × produto cadastrado | Bloqueio **liberável** | Importar origem da NF **ou** senha gerente |
| **CST/CFOP** | Item tem CST e CFOP no XML? | Bloqueio **não liberável** (`exigeManifesto`) | Desconhecimento ou Operação não realizada |

Detalhes:

- Produto **sem NCM/origem** mas NF **com** valor → também bloqueia (empurra importar)
- Botão **“Importar NCM/origem da NF”** só aparece quando há divergência
- **Liberar críticas** não funciona para CST/CFOP — botão fica desabilitado / API retorna 400
- Card **Manifestação do destinatário** nesta mesma aba (abaixo de Liberar críticas) tem os botões **Desconhecimento da operação** e **Operação não realizada** — não é preciso ir até a aba Negociação para manifestar

**Grid comparativo (`ItemVinculoFiscalGrid`):** mesmo layout NF × SISTEMA do grid de Cadastro, com NCM/CST/Origem/CFOP da NF de um lado e NCM/Origem do produto + **CFOP de entrada** do outro. O CFOP de entrada é sugerido automaticamente (`Cfop.cfopSugestaoEntradaId` do CFOP de saída da NF, ex.: 5201 → 3201) e gravado em `NfeRecebidaItem.cfopEntradaId`; o usuário pode trocar por item no botão **Trocar** (`POST /entrada-notas/:id/definir-cfop-entrada`) sem precisar reanalisar a nota inteira. Essa troca é só classificação de entrada — não muda o bloqueio de CST/CFOP acima.

---

### Etapa 3 — Negociação

**Documento:** comparar NF × pedido de compra (preço, quantidade, itens, prazo). Divergência positiva (preço menor, prazo maior) → segue. Negativa → senha gerente, devolver ou desconhecimento. Sem prazo na NF → usuário preenche.

**Sistema** (`analise-negociacao/analisar-negociacao.ts`):

1. Busca **pedido de compra aberto** do fornecedor  
   - Se só 1 PO aberto → vincula automaticamente  
   - Se vários → usuário escolhe no select  
   - Se nenhum → **BLOQUEANTE**

2. Compara item a item: quantidade, preço unitário, presença no PO

3. **Positiva** (preço menor, qtd menor, prazo melhor) → aviso, não bloqueia

4. **Negativa** (preço maior, qtd maior, item fora do PO) → bloqueia

5. **Prazo:** se NF não tem vencimento no XML, campo “Prazo” na tela + “Salvar prazo e reanalisar”

**Regra:** negociação bloqueante pode ser contornada com **Liberar críticas + senha gerente**.

---

### Etapa 4 — Lançamento

**Documento:** após críticas resolvidas, usuário vê todos os dados e escolhe:

- **Liberar para contagem** — sem senha  
- **Consolidar estoque** — com senha de gerente  

**Sistema:**

- Se pipeline OK → **auto-lança** para contagem (`origemLancamento=automatica`)
- Manualmente na tela “4. Lançamento”:
  - **Liberar para contagem** → `statusEntrada=entrada_contagem`
  - **Consolidar estoque** → `statusEntrada=entrada_consolidada` + senha

**Importante:** consolidar **ainda não movimenta estoque físico** — só muda status (ledger futuro).

A API **recusa lançar** se ainda houver bloqueio de cadastro, CST/CFOP ou negociação/fiscal sem liberação.

---

## Parte 4 — Controles humanos (documento do cliente)

| Botão do documento | Onde está | O que faz hoje |
|--------------------|-----------|----------------|
| **Importar XML** | Lista, painel Em análise | Fallback manual; bloqueia chave duplicada |
| **Voltar etapa** | Detalhe, cabeçalho (seletor + botão) | Volta a nota para a etapa escolhida direto, sem passar etapa por etapa; reabre se já lançada (`entrada_contagem`/`entrada_consolidada`) |
| **Liberar críticas** | Detalhe + senha gerente | Só NCM/origem e negociação; **não** cadastro nem CST/CFOP |
| **Cancelar liberação** | Detalhe | `criticasLiberadas=false` + reanalisa |
| **Contato fornecedor** | Detalhe + observação | `statusEntrada=stand_by` |
| **Desconhecimento da operação** / **Operação não realizada** | Detalhe, card **Manifestação do destinatário** (abas Fiscal **e** Negociação) | Confirmação → manifesto Focus → `cancelada`. **Operação não realizada** exige justificativa (mín. 15 caracteres) |
| **Desfazer cancelamento** | Detalhe, card **Finalizada** (nota `cancelada`) | Confirmação → `statusEntrada=em_analise`, limpa `manifestacaoDestinatario` + reanalisa. Nota sai do painel **Canceladas** e volta para **Em análise**. A manifestação na SEFAZ/Focus **não** é revertida |

**Voltar etapa (corrigir vínculo descoberto tarde):** cenário do cliente — produto vinculado errado (código de barras ou manual) só é percebido quando a nota já está em Fiscal, Negociação ou já lançada. Em vez de desfazer manualmente etapa por etapa, o usuário escolhe a etapa de destino no seletor (ex.: Cadastro) e clica **Voltar etapa**: a nota reabre se estava lançada, os resultados de Fiscal/Negociação/Frete são limpos e a nota para exatamente em Cadastro. Ali, no item errado, **Trocar vínculo** ou **Desvincular** + **Conciliar produto** corrige, e **Reanalisar** roda o pipeline de novo do início. Bloqueado em nota `cancelada` ou se a etapa escolhida não for anterior à posição atual.

**Corrigir vários itens sem religamento automático:** quando tem mais de um item errado, o cliente pode **Desvincular** todos os que precisa e ir **conciliando um a um** (Conciliar produto / Trocar vínculo) sem medo do sistema religar sozinho os que ainda não mexeu. Cada clique em Vincular/Desvincular só afeta aquele item (não roda fiscal/negociação/frete) e o item marcado como desvinculado (`vinculoModo='desvinculado'`) fica de fora do auto-match por código de barras/código original até ser conciliado de novo — mesmo depois de um **Reanalisar** completo. Só clica **Reanalisar** quando todos os itens estiverem certos.

---

## Parte 5 — NFS-e (serviço) e CTe (transporte)

**NFS-e:** só Cadastro + Lançamento documental (sem itens/PO/estoque).

**CTe:**

```text
Cadastro:   transportadora (emitente) como fornecedor
Vínculo:    chave de NF-e no XML do CT-e → se NF não existe, importa Focus pela mesma chave (consulta+ciência+XML) ao abrir / Reanalisar / “Buscar NF pela chave” → NfeCteVinculo
Financeiro: despesa do CT-e lançada quando a NF de mercadoria é liberada
```

CTe **não auto-lança sozinho** quando referencia uma NF — o custo entra na análise/lançamento da mercadoria.  
Só importa CT-e se a empresa for **tomadora** do frete.  
Se a chave da NF estiver no XML, ao **abrir o CT-e** o ERP **sempre** tenta Focus por essa chave (não espera sync DistDFe): baixa a NF e vincula. 404 na consulta individual **não** aborta — ainda tenta ciência + XML; só falha se o download do XML também vier 404 (chave correta, mas NF ainda não no DistDFe ou CNPJ não é destinatário) — use **Importar XML** da NF.

Ao abrir a lista / **BUSCAR**, o ERP varre CT-es sem vínculo (`POST /entrada-notas/vincular-ctes-pendentes` com `forcarRetryFocus: true` na 1ª visita e no BUSCAR): liga o que já tem NF no banco **sem** Focus; só chama Focus se o CT-e tiver chave de NF e ela ainda não existir (CT-e sem chave = zero request). Itens vinculados mostram **✓ verde** na lista.

---

## Mapa: documento do cliente × sistema

| Documento (`ENTRADA DE NOTAS.docx`) | Sistema hoje | Status |
|-------------------------------------|--------------|--------|
| Lista de notas importadas pelo manifestador | Sync Focus + Import XML → lista local | OK |
| 4 etapas: Cadastro → Fiscal → Negociação → Lançamento | Pipeline em `servico-pipeline-entrada.ts` | OK |
| Vínculo fornecedor por CNPJ | Etapa 1 cadastro | OK |
| Produto: barras → original → manual | Etapa 1 + UI detalhe | OK |
| Gravar código original com 1 clique | Botão no item | OK |
| Fiscal: NCM, origem, CST/CFOP | Etapa 2 + config Focus | OK |
| Importar NCM/origem da NF | POST importar-fiscal-produto | OK |
| CST/CFOP impeditivo → devolução/desconhecimento | `exigeManifesto` + manifestar | OK |
| Negociação: preço, qtd, itens, prazo | Etapa 3 + select PO | OK |
| Divergência positiva não pede autorização | Classificação positiva | OK |
| Divergência negativa → senha/devolver/desconhecimento | Liberar críticas + manifesto | OK |
| Preencher prazo se NF sem prazo | Campo prazo no detalhe | OK |
| Não duplicar NF (chave única) | `@@unique(companyId, chaveNfe)` | OK |
| Liberar para contagem / Consolidar com senha | Etapa 4 `lancar` | OK |
| Stand-by + observação contato | contato-fornecedor | OK |
| NFS-e sem fiscal de produto | `analisarNotaDocumental` / `analisarNotaNfse` | OK |
| CTe sem fiscal de produto | `analisarNotaCte` + vínculo NF | OK |
| Frete destinatário exige CT-e | Gate `modFrete=1` + vínculo manual | OK |
| Rateio frete / despesa CT-e | `ratear-custo-frete` + `DespesaEntradaDocumento` | OK (stub financeiro) |
| Wizard por abas | `[id]/page.tsx` + `Abas` | OK |
| Movimento físico de estoque no consolidar | Ainda **não** — só status | Pendência futura |

---

## Exemplo prático — NFS-e sem fornecedor

1. Sync Focus trouxe a NFS-e  
2. Pipeline rodou → **Cadastro BLOQUEANTE** (CNPJ do emitente não está no ERP)  
3. Fiscal e Negociação aparecem OK (NFS-e não exige isso)  
4. **Liberar críticas** fica desabilitado (cadastro não libera por senha)  
5. **Consolidar / Liberar para contagem** também não avançam (pipeline bloqueado)  
6. **Caminho correto:** cadastrar o fornecedor com esse CNPJ → voltar na nota → **Reanalisar** → auto-lança para contagem documental  

---

## Exemplo prático — NFe 55 com divergência fiscal

1. Nota com produto vinculado, mas NCM da NF ≠ NCM do produto  
2. Card **Fiscal: BLOQUEANTE** (liberável)  
3. Clicar **Importar NCM/origem da NF para o produto** → Reanalisar (ou liberar com senha gerente)  
4. Se o item **não tiver CST ou CFOP** no XML → bloqueio **não liberável** → usar **Desconhecimento da operação** ou **Operação não realizada (devolução)**  

---

## PDF (DANFE / DANFSe / DACTe) e recursos de documento

Os botões **Ver nota**, **Baixar XML** e **Baixar PDF** são controlados por flags (padrão no `.env` da instalação, com override por empresa em **Cadastros → Plano — Entrada de Notas**).

| Variável `.env` | Padrão | Efeito |
|-----------------|--------|--------|
| `ENTRADA_NOTAS_VER_NOTA` | `true` | Habilita **Ver nota** |
| `ENTRADA_NOTAS_BAIXAR_XML` | `true` | Habilita download do XML |
| `ENTRADA_NOTAS_BAIXAR_PDF_FOCUS` | `true` | Baixa DANFE/DACTe/DANFSe oficial na Focus |
| `ENTRADA_NOTAS_DANFE_CACHE_INDISPONIVEL_HORAS` | `24` | Não re-tenta Focus após 404 |
| `ENTRADA_NOTAS_DANFE_RATE_LIMIT_MINUTOS` | `2` | Cooldown após 429 |

API efetiva: `GET /focus-nfe/recursos-documento`. Override: `Company.recursosEntradaNotasJson` (null = só .env).

O botão **Baixar PDF** pede **somente** o documento oficial à Focus (`/nfes_recebidas/{chave}.pdf` etc.) e grava cache local. **Não** há PDF auxiliar gerado do XML.

| Situação | Resultado |
|----------|-----------|
| Nota veio do **sync Focus** e a Focus já gerou o PDF | Download OK (depois fica em cache) |
| Nota **importada por XML** e DistDFe sem a nota | Focus 404 → **422**; use **Ver nota** ou **Baixar XML** |
| PDF ainda não gerado / falta ciência | 422 temporário; tente de novo mais tarde |
| Flag desligada no plano | Botão oculto; API responde **403** |

Se a UI mostrar só `422: Unprocessable Entity`, o corpo JSON do erro não foi lido (download em `arraybuffer`/`blob`) — o cliente HTTP e `extrairMensagemApi` devem exibir a `mensagem` do backend.

---

## Onde olhar no código

| Camada | Caminho |
|--------|---------|
| Lista UI | `frontend/app/entrada-notas/page.tsx` |
| Detalhe / wizard | `frontend/app/entrada-notas/[id]/page.tsx` |
| Config Focus + regras fiscais | `frontend/components/focus-nfe/painel-configuracao-focus-nfe.tsx` |
| Flags / calibração documento | `src/modulos/focus-nfe/config-recursos-entrada-notas.ts` |
| Sync / XML / DANFE | `src/modulos/focus-nfe/servico-focus-nfe.ts` |
| Pipeline | `src/modulos/entrada-notas/servico-pipeline-entrada.ts` |
| Voltar etapa / vincular / desvincular item | `src/modulos/entrada-notas/servico-pipeline-entrada.ts` (`voltarEtapa`, `vincularItem`, `desvincularItem`, `recalcularSomenteCadastro`) |
| Auto-match não religa item desvinculado | `src/modulos/entrada-notas/analise-cadastro/analisar-cadastro.ts` |
| Grid vínculo (Conciliar / Trocar / Desvincular) | `frontend/components/entrada-notas/item-vinculo-cadastro-grid.tsx` |
| Grid comparativo Fiscal (NCM/CST/CFOP + CFOP de entrada) | `frontend/components/entrada-notas/item-vinculo-fiscal-grid.tsx` |
| Sugestão / definição de CFOP de entrada | `src/modulos/entrada-notas/servico-pipeline-entrada.ts` (`sugerirCfopEntradaItensSemEscolha`, `definirCfopEntrada`), `POST /entrada-notas/:id/definir-cfop-entrada` |
| Cadastro | `src/modulos/entrada-notas/analise-cadastro/analisar-cadastro.ts` |
| Fiscal | `src/modulos/entrada-notas/analise-fiscal/analisar-fiscal-itens.ts` |
| Negociação | `src/modulos/entrada-notas/analise-negociacao/analisar-negociacao.ts` |
| Rotas entrada | `src/modulos/entrada-notas/rotas-entrada-notas.ts` |
| Models | `NfeRecebida`, `NfeRecebidaItem`, `NfeCteVinculo`, `DespesaEntradaDocumento` (Prisma) |
| Vínculo / rateio | `servico-vinculo-cte.ts`, `ratear-custo-frete.ts` |
| Import NF por chave (CT-e) | `src/modulos/focus-nfe/importar-nfe-por-chave.ts` |

---

## Resumo em uma frase

**Focus alimenta a fila** (sync/XML) e **fornece as regras fiscais**; **Entrada de Notas** roda o **pipeline de 4 etapas** do documento do cliente, com **controles humanos** (senha, stand-by, manifesto) nos pontos certos — cadastro e CST/CFOP são **estruturais** (não passam por “liberar críticas”), enquanto NCM/origem e negociação podem ser **importadas ou liberadas com senha de gerente**.
