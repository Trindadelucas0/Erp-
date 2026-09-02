# Migração — Planos financeiros (Santri → ERP)

Carga one-shot dos planos financeiros da planilha **PLANOS FINANCEIROS.xls** para a empresa **Conexão Atacadista** no servidor.

## O que sobe no git

| Arquivo | Papel |
|---------|--------|
| `dados/planos-financeiros.json` | 158 planos validados (grupos + subgrupos; cabeçalhos `1` e `2` ignorados) |
| `scripts/importar-planos-financeiros.ts` | Importação no banco (dry-run / `--aplicar`) |

A VPS **não** lê `.xls` — só o JSON após `git pull`.

## Reextrair do XLS (no PC, se a planilha mudar)

```powershell
python scripts/migracao-planos-financeiros/extrair-xls-para-json.py "C:\Users\trind\Downloads\PLANOS FINANCEIROS.xls"
```

Commitar `dados/planos-financeiros.json` na mesma entrega.

## Deploy na VPS (produção)

Na raiz `~/PROJETOS/Erp-`, depois de `git pull` e `npm install`:

```bash
# Conferir (não grava)
npm run migrar:planos-financeiros

# Gravar na Conexão Atacadista (CNPJ 34221243000171)
npm run migrar:planos-financeiros -- --aplicar
```

Não precisa `pm2 restart` — só grava no PostgreSQL.

### Overrides

```bash
npm run migrar:planos-financeiros -- --listar-empresas
npm run migrar:planos-financeiros -- --company-id UUID --aplicar
npm run migrar:planos-financeiros -- --arquivo /caminho/outro.json --aplicar
```

## Regras da importação

- **Substituição:** planos no banco que **não** estão na planilha são **removidos** (subgrupos antes dos grupos).
- Cabeçalhos de categoria (`1`, `2`) **não** entram — só `1.1`, `1.1.1`, `2.1`, `2.1.1`, etc.
- Código na planilha: cria ou atualiza nome e flags.
- Vínculos de fornecedor nos planos removidos somem (cascade). Títulos/contas que usavam o plano ficam com plano vazio (set null).
- Falha de validação no JSON: aborta antes de gravar.

## Conferir na UI

Configurações → Financeiro → Planos Financeiros (Receitas / Despesas).
