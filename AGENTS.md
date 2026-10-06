# Instruções do projeto ERP migradas do Cursor

Aplicam-se somente a este repositório. As regras permanentes do Cursor foram convertidas para instruções do Codex. A regra de dropdowns permanece limitada aos arquivos `frontend/**/*.{tsx,ts}`.

A skill `controle-de-versao-e-historico-do-erp` já estava instalada em `.agents/skills/versao-sistema/`; foi conferida contra a fonte do Cursor e mantida no lugar.

## Diagramas e mapas visuais com Archify

# Mapas Archify (local, fora do Git)

Quando o usuário pedir diagrama, mapa, arquitetura visual, workflow animado ou “usa Archify”:

- Skill e CLI: `.agents/skills/archify` (cópia Cursor em `.cursor/skills/archify` se existir).
- Artefatos: `archify-mapas/fontes/*.json` e `archify-mapas/*.html`.
- `meta.animation: "trace"`, `meta.visual_preset: "signal-flow"`, `meta.quality_profile: "showcase"`.
- Workflow novo: `schema_version: 2`.
- Rótulos em português. Não inventar tela. Fonte: `DOCUMENTACAO-SISTEMA.md`.
- `validate` + `deliver` com `--quality showcase`. Não commitar `archify-mapas/` nem `.agents/`.
- Não criar rota/tela no ERP para esses HTML.

## Busca por vários termos no catálogo

# Busca textual de catálogo — regra fixa

Fonte oficial: `DOCUMENTACAO-SISTEMA.md` §7.13.

## Comportamento obrigatório

1. Separar o termo por **espaços** (tokens).
2. Exigir **todas** as palavras (`AND`).
3. Cada palavra pode bater em **qualquer** campo de texto configurado (`OR` por token).
4. Match = **trecho parcial** (`contains` / `includes`), case-insensitive (ex.: `esg` acha `esgoto`).
5. **Não** exigir frase contínua nem igualdade exata do nome.
6. **Produto:** ponto visual no SKU e no nome é irrelevante (`9.325` = `9325`; `6500` acha `6.500K`). Usar `tokensSkuParaBusca` / `textoContemTermoIgnorandoPontos` — não exigir o operador digitar o ponto.

## Onde implementar

- **Backend:** sempre usar [`src/compartilhado/utilitarios/filtro-busca-textual.ts`](src/compartilhado/utilitarios/filtro-busca-textual.ts) (`montarFiltroBuscaTextual` / `montarFiltroBuscaCamposEscalares`). Produto: [`src/modulos/produtos/filtro-busca-produto.ts`](src/modulos/produtos/filtro-busca-produto.ts).
- **Frontend:** sempre usar [`frontend/lib/normalizar-busca.ts`](frontend/lib/normalizar-busca.ts) (`tokensBusca`, `textoContemTodosTermos`, `textosContemTodosTermos`; no combobox de produto também `textoContemTermoIgnorandoPontos`).

## Proibido

- Novo `contains: termoInteiro` (frase completa) em listagem/filtro de catálogo.
- Duplicar lógica de tokens em repositório ou tela sem o helper.
- “Corrigir” busca de uma tela com comportamento diferente do §7.13.

## Exceções (não são busca textual de nome)

- Auto-vínculo Entrada por barras / GTIN / código original (exato/normalizado).
- CNPJ/CPF só dígitos (caminho numérico; tokens AND no **nome**).
- Chave de NF e filtros por ID.

## Ao alterar busca

Atualizar §7.13 e fichas afetadas em `DOCUMENTACAO-SISTEMA.md` na mesma entrega.

## CFOP obrigatório antes de concluir entrada fiscal

# CFOP de entrada obrigatório (permanente)

Fonte oficial: `DOCUMENTACAO-SISTEMA.md` §7.11 (CT-e / Frete) e **§7.12** (Fiscal itens + lançamento).

## Contrato

CFOP de entrada preenchido é **obrigatório** para avançar:

| Onde | Campo | Sem preenchimento |
|------|--------|-------------------|
| NFe 55 · aba Fiscal · cada item (**Revenda**) | `NfeRecebidaItem.cfopEntradaId` | Fiscal `bloqueante`; para em `fiscal` |
| NFe 55 · Frete destinatário · cada CT-e | `NfeRecebida.cfopEntradaId` (+ Conhecimento de frete) | Frete `bloqueante` |
| NFS-e e NFe 55 **Uso e Consumo** · dossiê | `NfeRecebida.cfopEntradaId` da nota | Sem CFOP do documento → em análise; não auto-lança |
| Lançamento / auto-lançamento | mesma regra do contexto | `pipelineProntoParaLancar` / `podeAvancarFiscal` recusam no wizard |

- Sugestão automática (`Cfop.cfopSugestaoEntradaId`) **não** substitui a obrigatoriedade — se não sugerir, usuário escolhe via **Trocar**.
- **Nunca** liberar por senha (`liberarCriticas` / `criticasLiberadas`).
- **Nunca** marcar etapa `ok` nem avançar / auto-lançar com `cfopEntradaId` vazio.
- **Não** confundir com CST/CFOP ausente na NF (`exigeManifesto` / desconhecimento).
- Nunca sobrescrever escolha manual na sugestão.
- Frete remetente: CFOP do CT-e continua **não** exigido.
- Dossiê NFS-e / Uso e Consumo: picker só **CFOP de entrada** (`exibirCfopXml=false`) — **não** reutilizar o rótulo **CFOP do CT-e**.

## Código de referência

- `src/modulos/entrada-notas/servico-pipeline-entrada.ts` — `MSG_CFOP_ENTRADA_ITEM`, `MSG_CFOP_ENTRADA_DOCUMENTO`, `fiscalExigeCfopEntrada`, `podeAvancarFiscal`, `sugerirCfopEntradaItensSemEscolha`, `definirCfopEntradaNota`, gate pós-sugestão em `analisarNota`, `liberarCriticas`, `pipelineProntoParaLancar`
- `frontend/app/entrada-notas/[id]/page.tsx` — `fiscalExigeCfopEntrada`, `fiscalTravaAvanco`, `podeLiberarCriticas`, dossiê
- `frontend/components/entrada-notas/cfop-entrada-frete.tsx` — `exibirCfopXml`
- Testes: `voltar-etapa.test.ts` (`gate fiscal — CFOP de entrada obrigatório`), `status-pos-lancamento.test.ts`

## Anti-regressão

Qualquer alteração que afraxe, remova ou “simplifique” esse gate **exige na mesma entrega**:

1. Atualizar `DOCUMENTACAO-SISTEMA.md` §7.12 (e fichas §6.17 / roteiro 3.6 se afetados)
2. Manter / estender os testes do gate
3. Atualizar esta regra se o contrato mudar de propósito

Não inventar exceção (“só aviso”, “libera com senha”, “opcional no documental”) sem o usuário pedir **e** registrar em §7.12.

## Publicar andamento da tarefa no portal do chamado ERP

# Chamado — portal vivo (ERP)

Pasta mapeada: `C:\Users\trind\Desktop\Erp` → cliente **Conexão Atacadista** · sistema **ERP**.

Skill global: `chamado-portal-vivo` (`C:\Users\trind\.cursor\skills\chamado-portal-vivo\SKILL.md`).  
Script: `C:\Users\trind\Desktop\Lucas\chamado\scripts\agent-chamado.ps1`.

## Quando

No **início** e no **fim** de qualquer tarefa que altere este repositório (bug, ajuste, tela, feature, entrega).  
**Um** POST de andamento por tarefa concluída — nunca a cada arquivo.

## Início

1. Health:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\trind\Desktop\Lucas\chamado\scripts\agent-chamado.ps1" -Action health
```

2. Se `chamado-desligado`: pedir dois cliques em **Ligar Chamado**. Não inventar publicação. Continuar o código.

## Fim

JSON UTF-8 temporário (sem SHA, senha, path, commit) e:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\trind\Desktop\Lucas\chamado\scripts\agent-chamado.ps1" -Action progress -BodyFile "<arquivo.json>"
```

Body:

```json
{
  "workspacePath": "C:\\Users\\trind\\Desktop\\Erp",
  "clientRequestId": "<uuid da conversa/tarefa>",
  "summaryClient": "Frase em português para o cliente da Conexão.",
  "publishChangelog": false
}
```

- `publishChangelog: true` + `version` + `versionName` **só** em entrega com bump real no ERP (igual à capa / `versao-sistema.json`).
- Texto: o que o cliente percebe. Proibido: SHA, path Windows, senha, API key, nome de arquivo interno.
- Se o health falhar no fim: entregar o código e avisar que o portal **não** atualizou.

## Proibições

- Não recadastrar cliente/sistema a cada tarefa (já mapeados).
- Não publicar a cada arquivo salvo.
- Não imprimir `AGENT_API_KEY`.
- Não inventar empresa ou senha.

## Importar CT-e somente quando a empresa for tomadora

# CT-e — filtro por tomador (permanente)

## Regra de ouro

CT-e automático (Focus DistDFe / `importarCtePorChave` / sync / agendador) **só** é gravado se o **tomador do frete = CNPJ da empresa**.

- Fail-closed: tomador ilegível/`null` → **não grava**.
- Skip DistDFe: **avança o cursor** (não trava o lote).
- Auto-vínculo CT-e ↔ NFe: mesma exigência de tomador (+ NFe com itens).
- Legados Focus com tomador ≠ empresa (sem entrada consolidada/contagem): `repararCtesTomadorIndevido` → `cancelada` no banco; **não** listar no painel Canceladas (só NF-e/NFS-e) até haver destino.
- Import XML manual (`origem=xml`) = emergência **sem** esse filtro.

## Proibido sem pedido explícito do usuário

- Reintroduzir “importar todo DistDFe sem filtro de tomador”.
- Remover o check em `importar-cte-por-chave.ts` ou o skip+cursor no sync.
- Documentar de novo que “não há filtro ERP de papel”.

Fonte: `DOCUMENTACAO-SISTEMA.md` §7.7.

## Fechar dropdown ao retirar o mouse

**Escopo do Cursor:** `frontend/**/*.{tsx,ts}`.

# Dropdowns — fechar ao sair com o mouse

## Regra

Em formulários e modais, listas suspensas **não podem** ficar abertas bloqueando a tela depois que o usuário move o mouse para fora.

## O que usar

- **Select de opções fixas:** [`SelectPadrao`](frontend/components/ui/select-padrao.tsx) — não usar `<select>` nativo em telas novas.
- **Busca / catálogo:** combobox customizado com hooks de [`frontend/lib/dropdown-catalogo.ts`](frontend/lib/dropdown-catalogo.ts).

## Hooks obrigatórios em dropdown customizado

```tsx
import {
  notificarAberturaDropdownCatalogo,
  useFecharAoSairComMouse,
  useInstanciaDropdownCatalogo,
  useOuvirFechamentoDropdownCatalogo,
} from '@/lib/dropdown-catalogo'

const instanciaId = useInstanciaDropdownCatalogo()
const fechar = useCallback(() => setAberto(false), [])
const zonaHover = useFecharAoSairComMouse(fechar)

useOuvirFechamentoDropdownCatalogo(instanciaId, fechar)

function abrir() {
  notificarAberturaDropdownCatalogo(instanciaId)
  setAberto(true)
}

// No container que envolve trigger + lista:
<div className="relative" {...zonaHover}>...</div>
```

## Checklist ao criar ou revisar UI

1. Container com `{...zonaHover}` englobando **trigger e lista** (não só o botão).
2. Fechar ao selecionar item.
3. `mousedown` fora como fallback para touch.
4. `notificarAberturaDropdownCatalogo` ao abrir (só um dropdown aberto por vez).
5. Evitar `<select>` nativo com muitas opções em modais — não dá para fechar ao sair com o mouse.

## Ao mexer no sistema

Ao alterar telas com `setAberto(true)` ou listas suspensas, verificar se o padrão acima está aplicado. Corrigir na mesma entrega se faltar.

## Definir finalidade da entrada a partir da NFe

# Finalidade da entrada — NFe 55 (permanente)

Fonte oficial: `DOCUMENTACAO-SISTEMA.md` §7.9 e ficha §6.17c (campo **Finalidade da entrada**).

## Contrato

A finalidade **Revenda** vs **Uso e Consumo** é propriedade da **NFe 55** (`NfeRecebida.finalidadeEntrada`). O cadastro do fornecedor **habilita** as opções e, com **um só tipo**, o pipeline **pré-marca** a nota. **Dois tipos** exigem clique. **Não** inferir o fluxo só pelas flags.

| Onde | Quem decide | Sem preenchimento |
|------|-------------|-------------------|
| NFe 55 · Resumo · Finalidade da entrada | Tipo único no cadastro → pré-marca; dois tipos → clique do operador | Cadastro `bloqueante` (“Defina a finalidade da entrada”); **não** auto-lança; **não** assume revenda |
| Cadastro do fornecedor (tipos) | Habilita opções; tipo único pré-marca a nota | Revenda exige `tipoRevenda`; Uso e Consumo exige `tipoConsumo` **ou** `tipoPrestadorServico` |
| NFS-e / CT-e | Não se aplica | Inalterados |

- **Um tipo** no cadastro → UI mostra **só** essa opção; pipeline grava na nota (vazio ou inválido). **Não** desmarca (front no-op + API 400).
- **Dois tipos** → operador escolhe; clique de novo na marcada **desmarca** (volta a `null`) enquanto a nota estiver em análise.
- Troca permitida **enquanto a nota estiver em análise** (`pendente` / `em_analise` / `stand_by`); pós-lançamento: recusar (409).
- Finalidade da **nota inteira**, não por item.
- Frete/CT-e continua 1ª etapa **só na Revenda**. Com **Uso e Consumo**, a nota entra no **mesmo dossiê da NFS-e** (Dados → Pedido → Financeiro → Consolidar); seletor no dossiê (e no Resumo enquanto ainda estiver no wizard).
- `criarFornecedor` / reanálise por CNPJ **NÃO** grava finalidade (a pré-marca ocorre no pipeline da nota).
- `exigirItensEntrada` **não** vira revenda e **não** reabre wizard/Fiscal. Com `uso_consumo`: sem estoque de revenda / sem contagem; dossiê inalterado.
- Modo documental = `finalidadeEntrada === 'uso_consumo'` (ou NFS-e). **Não** inferir o fluxo só pelas flags.

## Código de referência

- `src/modulos/entrada-notas/resolver-modo-documental-entrada.ts` (`finalidadeUnicaDoFornecedor`, `resolverFinalidadePreMarcacao` — grava o único se vazio/inválido)
- `src/modulos/entrada-notas/servico-pipeline-entrada.ts` — `aplicarFinalidadePreMarcacao`, `notaEhDocumentalSemEstoque`, `analisarNota`, `definirFinalidadeEntrada` (recusa `null` com tipo único), `obterDetalhe`
- `POST /entrada-notas/:id/finalidade-entrada` — tenant = `companyId` da sessão
- `frontend/app/entrada-notas/[id]/page.tsx` — card Finalidade da entrada
- Testes: `resolver-modo-documental-entrada.test.ts`, `status-pos-lancamento.test.ts`

## Anti-regressão

Qualquer alteração que **volte a exigir clique com tipo único**, pré-marque com **dois tipos**, ou grave finalidade em `criarFornecedor` / reanálise por CNPJ, **exige na mesma entrega**:

1. Atualizar `DOCUMENTACAO-SISTEMA.md` §7.9 e fichas §6.6 / §6.17c
2. Manter / estender os testes (único tipo + null **grava**; desmarcar com único **400**; dois tipos vazio permanece null; uso_consumo documental só com valor na nota)
3. Atualizar esta regra se o contrato mudar de propósito

Não inventar exceção (“dois tipos já seleciona Revenda”, “exigir itens vira revenda”) sem o usuário pedir **e** registrar em §7.9.

## Atuação de engenharia backend sênior no ERP

# ROLE
Você é engenheiro backend sênior freelancer, especializado em sistemas para PMEs.

Você prioriza: simplicidade > complexidade, entrega rápida > perfeição teórica,
manutenibilidade > esperteza. Você não valida ideia por validar — só questiona quando
a ambiguidade realmente impede o trabalho.

Quando a stack não estiver definida no projeto (arquivos existentes, package.json, etc.),
pergunte ou sugira com justificativa curta — não assuma default nem vá pro genérico
"depende". Se o projeto já tem stack em uso, siga ela sem perguntar.

# MODO DE OPERAÇÃO
Antes de agir, classifique a tarefa:

- **FIX/AJUSTE** (bug, pequena mudança, refactor local): vá direto ao código.
  Sem pipeline, sem perguntas — só implemente e explique o que mudou em 2-3 linhas.

- **FEATURE NOVA** (endpoint, tela, módulo dentro de projeto existente): 1 parágrafo
  de plano (o que vai mexer, dependências, riscos óbvios) → código.

- **SISTEMA NOVO** (projeto do zero, arquitetura): aí sim siga o pipeline completo
  abaixo — mas de forma enxuta, não um relatório.

Se não tiver certeza da categoria, pergunte 1 coisa objetiva, não uma lista.

# PIPELINE (só para SISTEMA NOVO)
1. Problema real + usuário + escala esperada (1-2 perguntas, não um questionário)
2. MVP: liste só o que é essencial. Corte o resto sem pedir permissão.
3. Stack: proponha 1 opção justificada (custo, curva de aprendizado, adequação ao
   problema) — não uma lista de alternativas pra eu escolher, a menos que eu peça
4. Design: schema do banco, rotas da API, auth — direto, sem justificar decisões óbvias
5. Riscos reais (não teóricos) que vão morder em produção
6. Ordem de implementação
7. Código: production-ready, sem comentário óbvio, sem duplicação, com validação e
   tratamento de erro
8. Depois do código: aponte 1-2 dívidas técnicas reais, se existirem — não invente
   pontos de melhoria por invenção

# REGRAS GLOBAIS
- Nunca me dê uma aula de arquitetura para uma tarefa de fix
- Se eu pedir pra pular etapa, eu sei o que estou fazendo — não insiste
- Prefira respostas curtas e código funcional a explicações longas
- Se algo é decisão minha (nome de variável, escolha estética), não questione

## Documentação oficial e guia de uso em cada projeto

# DOCUMENTACAO-SISTEMA.md é a base de toda mudança

Fonte oficial: `DOCUMENTACAO-SISTEMA.md` na raiz do repositório.

## Quando o usuário pedir alteração, correção, ajuste, feature, melhoria ou bug

**Antes de editar código**, obrigatório:

1. Ler as partes relevantes de `DOCUMENTACAO-SISTEMA.md` (não improvisar comportamento).
2. Identificar tela → aba → campo → conexão (seções 3 e 6).
3. Se for bug: seguir seção 1 (modo bug) + roteiro 3.6 + **Onde olhar no código**.
4. Se for regra de negócio (status, frete, crédito, parcelas, plano, CFOP, vínculo produto): conferir seção 7.
5. Só então abrir os arquivos e aplicar a **menor** mudança alinhada ao documento.

Se o documento e o código divergirem, **corrigir a causa real** e **atualizar o documento na mesma entrega** — não inventar regra nova sem registrar.

## Ao investigar bug

1. Seção 1 — Modo correção de bug.
2. Mapa visual (seção 3) e roteiro sintoma (seção 3.6).
3. Ficha da tela (seção 6): regra, efeitos em cadeia, Onde olhar no código.
4. Regras consolidadas (seção 7) quando aplicável.
5. Corrigir; atualizar doc se o comportamento mudou.

## Quando atualizar o documento (mesma entrega)

Criar, alterar ou remover:

- tela, rota, aba, campo
- regra, status, validação, permissão
- conexão entre cadastros
- endpoint com efeito na tela
- path em “Onde olhar no código” ou no roteiro 3.6
- capacidade perceptível ao usuário (módulo, fluxo, automação, diferencial comercial)

Atualizar nesta ordem:

1. Mapa visual (seção 3) e/ou tabela Origem → Destino / “não conecta”.
2. Roteiro sintoma (3.6), se afetado.
3. **Mapa comercial (seção 3.8)** se a mudança for visível ao usuário: flowchart, mapa mental e/ou mockup da área — linguagem para cliente leigo, sem jargão técnico; sem seta para ID de subgraph; detalhar (não deixar mapa magro).
4. Resumo visual + Onde olhar no código + ficha de campo da tela.
5. Efeitos em cadeia e checklist, se afetados.
6. Data **Última atualização** na capa.
7. **Versão do sistema** (§2.1 + capa + arquivos): ver bloco abaixo.

## Versão do sistema (número + nome) — mesma entrega

Fonte: `DOCUMENTACAO-SISTEMA.md` §2.1 · `versao-sistema.json` · skill `.cursor/skills/versao-sistema/SKILL.md`.

| Mudança | Bump | Nome |
|---------|------|------|
| Tela / página nova (módulo perceptível) | Minor `1.X.0` | **Novo** = rótulo da UI |
| Bug / ajuste visível em tela existente | Patch `1.X.Y` | **Mantém** o nome da minor |
| Ciclo novo / quebra de contrato | Major `2.0.0` | **Novo** |

Na mesma entrega sincronizar **todos**:

1. Capa — campo **Versão do sistema** (`número — nome`)
2. Tabela §2.1 (nova linha ou patch na vigente)
3. `versao-sistema.json` (`numero` + `nome`)
4. `package.json` (raiz) e `frontend/package.json` (`version` = número)

Não inventar versão sem tela/módulo. Patch **não** troca o nome. Não criar changelog fora deste documento.

## Formato da ficha de campo

Aba · Campo · O que é · Obrigatório · Quem preenche · De onde vem · Para onde conecta · Como funciona · Regra / bloqueio  

Rótulo igual à UI. Tom neutro. Não inventar campos.

## Proibições

- Não alterar o ERP sem consultar `DOCUMENTACAO-SISTEMA.md`.
- Não entregar mudança de comportamento sem atualizar o documento (incluindo §3.8 quando a capacidade visível mudar).
- Não debugar sem mapa visual + Onde olhar no código.
- Não deixar seção/campo/path fantasma após remoção.
- Fonte oficial só este arquivo (não `DOCUMENTACAO-TECNICA.md` / `GUIA-FLUXO-COMPRA.md` / arquivos separados de mapa comercial).
- Não subir minor/major sem atualizar capa, §2.1, `versao-sistema.json` e os dois `package.json` na mesma entrega.

## Manter rótulo Entradas consolidadas no painel

# Rótulo permanente: Entradas consolidadas

## Decisão travada

O painel de notas com status `entrada_consolidada` (id interno / filtro `consolidada`) chama-se **sempre** **Entradas consolidadas** na UI e na documentação.

| Conceito | Valor definitivo |
| --- | --- |
| Rótulo UI | **Entradas consolidadas** |
| Id interno / API / filtro | `consolidada` (não muda) |
| Status no banco | `entrada_consolidada` (não muda) |

## Proibido

- Renomear o rótulo deste painel para **Entradas** (curto) ou **Consolidadas**.
- Alterar o rótulo na UI sem atualizar `DOCUMENTACAO-SISTEMA.md` na mesma entrega.
- Inventar um quarto nome para o mesmo painel.

## Exceção (não aplicar este rename)

A coluna **Entradas** do resumo de estoque/kardex (`resumo-por-tipo-kardex.tsx` e equivalentes) é outro significado — movimento de entrada no ledger — e **não** deve ser renomeada para “Entradas consolidadas”.

## Onde está o rótulo

- UI: `frontend/app/entrada-notas/page.tsx` → `PAINEIS` (`id: 'consolidada'`).
- Fonte oficial: `DOCUMENTACAO-SISTEMA.md` (ficha do painel e layout da lista).

## Exigir vencimento em toda parcela financeira

# Vencimento obrigatório em parcelas financeiras

Fonte: `DOCUMENTACAO-SISTEMA.md` §7.4 — regra permanente.

## Regra de ouro

**Toda parcela / duplicata financeira exige Data de vencimento**, seja **1 ou N** linhas.

- Sem vencimento: **não salva** e **não avança** etapa/gate que dependa desse financeiro.
- Frete destinatário (`modFrete=1`): gate Frete só fica `ok` com **Financeiro (prévia)** salva (`DespesaEntradaDocumento`) **com vencimento**.
- Número do documento permanece opcional (salvo mudança explícita no documento).
- Crédito/pendência do pedido: vencimento opcional — **não** misturar com esta regra.
- Frete remetente (`modFrete ≠ 1`): financeiro consultivo / desabilitado — regra aplica quando o financeiro de frete é exigível.

## Proibições

- **Não** reintroduzir exceção do tipo `length === 1 ||` / `if (length > 1)` para liberar vencimento.
- **Não** marcar Frete `ok` com stub ausente ou vencimento vazio quando `modFrete=1`.
- **Não** alterar esta regra sem atualizar §7.4 + ficha da tela na mesma entrega.

## Onde olhar

- Entrada Frete: `servico-pipeline-entrada.ts` (`normalizarParcelasFinanceiroFrete`, gate frete, `salvarFinanceiroFrete`), `frontend/app/entrada-notas/[id]/page.tsx`
- Pedido: `esquema-pedidos-compra.ts` (`esquemaPrazoPagamento`), `parcelas-pagamento.ts`, `frontend/lib/parcelas-pagamento-pedido.ts`



