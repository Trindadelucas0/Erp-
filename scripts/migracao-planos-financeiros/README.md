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

- Códigos `1` e `2` (categoria) **não** entram — só `1.1`, `1.1.1`, `2.1`, `2.1.1`, etc.
- Código já existente: atualiza nome e flags; **não** apaga planos que não estão no JSON.
- Código novo: cria na ordem grupo → subgrupo.
- Falha de validação no JSON: aborta antes de gravar.

## Conferir na UI

Configurações → Financeiro → Planos Financeiros (Receitas / Despesas).
