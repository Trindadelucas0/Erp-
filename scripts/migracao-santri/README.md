# Migração Santri → Produtos

Scripts one-shot para importar o relatório **Relação de Produtos Analítico** (Santri ADM).

## Escopo

| Item | Decisão |
|------|---------|
| SKU | Mantém o Código Santri |
| Preço Santri | Vai para `precoCusto` (sugestão de **preço unitário** no pedido) |
| Estoque | Não migra |
| Código de barras | EAN-13/DUN-14; UPC-12 tenta virar EAN-13 com zero à esquerda |
| Múltiplo / código original | Só no vínculo `ProdutoFornecedor` (precisa `--fornecedor-id`) |

## Deploy na VPS (produção)

Os produtos **não** sobem sozinhos com o `git pull`. Depois do deploy do código:

```bash
cd ~/PROJETOS/Erp-
git pull
npm install

# Enviar o ODS (do PC): scp arquivo.zip lucasservidor:~/PROJETOS/Erp-/dados-santri.zip

npm run migrar:produtos-santri -- --listar-empresas
npm run migrar:completar-santri -- --listar-fornecedores --company-id UUID_EMPRESA

# Fase 1 (dry-run depois --aplicar)
npm run migrar:produtos-santri -- --arquivo ~/PROJETOS/Erp-/dados-santri.zip --company-id UUID_EMPRESA
npm run migrar:produtos-santri -- --arquivo ~/PROJETOS/Erp-/dados-santri.zip --company-id UUID_EMPRESA --aplicar

# Completar preço/EAN/vínculo
npm run migrar:completar-santri -- --arquivo ~/PROJETOS/Erp-/dados-santri.zip --company-id UUID_EMPRESA --fornecedor-id UUID_FORNECEDOR --modo-multiplo forcar-iguais --aplicar
```

Use os UUIDs listados **no banco da VPS** (não os da EMPRESA TESTE local).

## Completar campos (local / após Fase 1)

```powershell
npm run migrar:completar-santri -- --listar-fornecedores --company-id UUID
npm run migrar:completar-santri -- --arquivo "caminho.zip" --company-id UUID --fornecedor-id UUID --modo-multiplo forcar-iguais --aplicar
```

`--modo-multiplo`:

- `auto` — segue regra ERP; pula inválidos
- `forcar-iguais` — se o Santri quebrar a regra, vincula com und venda e múltiplo 1

## Só preços

```powershell
npm run migrar:precos-santri -- --arquivo "..." --company-id UUID --aplicar
```

## Fase 1 — catálogo (primeira carga)

```powershell
npm run migrar:produtos-santri -- --listar-empresas
npm run migrar:produtos-santri -- --arquivo "..." --company-id UUID --aplicar
```

## Fase 2 — vários fornecedores

1. Use o `depara-fase2-*.csv` gerado na Fase 1.
2. Preencha `fornecedorPessoaId`.
3. `npm run migrar:vinculos-santri -- --company-id UUID --depara ... --aplicar`

## Como validar no pedido

1. Abrir pedido com o **mesmo fornecedor** do vínculo.
2. Escolher o produto → preço unitário, código original e unidade.
3. Conferir código de barras na ficha do produto.
