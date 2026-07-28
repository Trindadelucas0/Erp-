# Guia — Cadastrar empresa na Focus NFe (para o ERP)

> Painel: [https://app.focusnfe.com.br](https://app.focusnfe.com.br)  
> Docs: [Introdução](https://doc.focusnfe.com.br/reference/introducao) · [Empresas](https://doc.focusnfe.com.br/reference/empresas) · [NFe recebidas](https://doc.focusnfe.com.br/reference/nfe-recebidas)  
> Integração no ERP: `MANUAL-FOCUS-NFE.md`

Este guia é para **criar ou corrigir** a empresa no painel Focus com os dados certos para a **Entrada de Notas** do ERP (consulta de NFe emitidas **contra o seu CNPJ**).

O ERP **não emite** NFe nesta integração. Só precisa de:

1. Empresa com o **mesmo CNPJ** do Cadastros do ERP  
2. Token (homologação ou produção)  
3. **Recebimento de NFes** ligado (manifestação / MDe)

---

## 0. Antes de começar — checklist do ERP

Anote na empresa ativa do ERP (Cadastros):

| Dado | Onde ver no ERP | Exemplo |
|------|-----------------|--------|
| Razão social / nome | Cadastros → empresa | EXITO CONTABILIDADE LTDA |
| **CNPJ** (14 dígitos) | Cadastros → CNPJ | `29859815000102` |
| IE (se tiver) | Cadastros | só números |
| UF / município / CEP | Cadastros | iguais à Receita |

**Regra de ouro:** o CNPJ na Focus tem que ser **idêntico** ao do Cadastros (só dígitos: 14 caracteres).  
Se o CNPJ divergir, o ERP manda um CNPJ e o token é de outra empresa → erro 400.

---

## 1. Criar a empresa no painel Focus (do zero)

1. Acesse [https://app.focusnfe.com.br](https://app.focusnfe.com.br) e entre na conta.
2. Vá em **Empresas** → **Nova empresa** (ou equivalente).
3. Preencha as abas na ordem abaixo.

### Aba Identificação (obrigatório)

| Campo Focus | Como preencher | Atenção |
|-------------|----------------|---------|
| **CNPJ** | Igual ao Cadastros do ERP, só dígitos ou máscara — o que importa é bater 14 dígitos | Não invente CNPJ de teste se for usar o ERP real |
| **Nome / Razão social** | Razão social oficial | Pode diferir do “nome fantasia”; o que amarra é o CNPJ |
| **Nome fantasia** | Opcional | — |
| **Inscrição estadual** | IE válida do estado | Exigida para NFe em muitos casos |
| **Regime tributário** | Conforme a empresa (1=Simples, etc.) | Igual ao cadastro fiscal real |
| **E-mail / telefone** | Contato válido | — |

### Aba Endereço

Use o endereço oficial (CEP, logradouro, número, bairro, município, UF) igual ao cadastro da Receita / Cadastros do ERP.

### Aba Contato / Responsável / Contabilidade

Preencha o que o painel pedir. Não bloqueia NFe recebidas se o essencial (CNPJ + Recebimento) estiver ok.

### Aba Tokens

Depois de salvar a empresa, a Focus gera:

| Token | Quando usar no ERP |
|-------|--------------------|
| **Token Homologação** (`token_homologacao`) | Testes: checkbox Homologação **marcado** |
| **Token Produção** (`token_producao`) | Produção: Homologação **desmarcado** |

Copie pelo ícone do **olho** (token completo).  
**Não misture:** token de produção no ambiente de homologação → 401.

### Aba Documentos fiscais (crítico para o ERP)

| Interruptor | Precisa para Entrada de Notas? | Observação |
|-------------|-------------------------------|------------|
| **NFe** (emissão) | Não obrigatório para só receber | Ligar se for emitir notas depois |
| **NFCe / CTe / MDFe / NFSe…** | Não | Só se usar esses documentos |
| **Recebimento de NFes** | **SIM — obrigatório** | Equivale a `habilita_manifestacao` / `habilita_manifestacao_homologacao` |
| Recebimento de CTes / NFSe nacional | Não | Só se for usar depois |

**Sem “Recebimento de NFes” ligado e salvo**, o ERP recebe:

`CNPJ do emitente não autorizado ou não informado` (HTTP 400)

mesmo com CNPJ e token corretos.

Na API Focus existem flags separadas:

- `habilita_manifestacao` → produção  
- `habilita_manifestacao_homologacao` → homologação  

No painel, ligue **Recebimento de NFes** e **Salve**. Se houver opção explícita de homologação para recebimento, ligue também (você testa o ERP em homologação).

### Certificado digital (A1)

Para **Recebimento de NFes** / DistDFe a Focus costuma exigir certificado **A1 (.pfx/.p12)** cujo CNPJ seja o **mesmo** da empresa.

| Situação | O que fazer |
|----------|-------------|
| Certificado de outro CNPJ | Focus rejeita (“Certificado não pertence ao CNPJ informado”) |
| Certificado vencido | Renovar antes |
| Senha errada | Reenviar o PFX com a senha correta |
| Ainda sem certificado | Pode cadastrar a empresa, mas o recebimento pode não liberar — fale com o suporte Focus |

Envie o certificado na aba/configuração de certificado da empresa e salve.

### Aba Configurações

Deixe o padrão se não souber. Nada aqui substitui o **Recebimento de NFes**.

4. Clique em **Salvar** / **Criar**.
5. Volte à lista **Empresas** e confira: CNPJ, Token Homologação e Token Produção visíveis.

---

## 2. Empresa já existe — corrigir cadastro errado

Se você criou a empresa de forma incompleta (só NFe de emissão ligado, CNPJ diferente, sem recebimento):

1. Empresas → linha da empresa → **DETALHES**.
2. Confira **Identificação → CNPJ** = Cadastros do ERP (`29859815000102` no seu caso).
3. Se o CNPJ estiver **errado**:
   - Em geral **não dá** para “trocar” CNPJ de empresa já usada; o caminho seguro é criar **nova** empresa com o CNPJ certo e desativar/ignorar a antiga (ou pedir orientação ao suporte Focus).
4. Aba **Documentos fiscais** → ligar **Recebimento de NFes** → **Salvar**.
5. Aba **Tokens** → copiar de novo o **Token Homologação** (às vezes regenera; use o atual).
6. Certificado: reenviar se a Focus mostrar inválido / CNPJ divergente.

---

## 3. Ligar a empresa Focus no ERP

### Opção recomendada (por empresa — `fonte=banco`)

1. No ERP, selecione a empresa cujo CNPJ bate com a Focus.
2. **Configurações → Focus NFe**.
3. Confira o CNPJ exibido no aviso (deve ser `29.859.815/0001-02` etc.).
4. Cole o **Token Homologação**.
5. Marque **Ambiente de homologação**.
6. **Salvar** → **Testar conexão**.

Sucesso = mensagem OK (lista vazia de notas ainda é OK em homolog).

### Opção `.env` (fallback global)

Só se **não** houver config no banco daquela empresa:

```
FOCUS_NFE_TOKEN=cole_token_homologacao_completo
FOCUS_NFE_HOMOLOGACAO=true
```

Reinicie a API. Prefira o painel do ERP (`fonte=banco`).

### Produção (depois que homolog funcionar)

1. Focus: confirme **Recebimento de NFes** para produção.  
2. ERP: cole **Token Produção**, **desmarque** homologação, Salvar, Testar.

---

## 4. Teste rápido (fora do ERP)

No PowerShell / terminal (troque TOKEN e CNPJ):

```bash
curl -u "SEU_TOKEN_HOMOLOGACAO:" "https://homologacao.focusnfe.com.br/v2/nfes_recebidas?cnpj=29859815000102"
```

| Resposta | Significado |
|----------|-------------|
| `[]` ou lista JSON | OK — autorizado |
| 401 | Token errado ou de outro ambiente |
| 400 / 403 “CNPJ … não autorizado” | Recebimento off, CNPJ ≠ token, ou certificado/plano |

---

## 5. Erros comuns ao cadastrar “errado”

| O que foi feito errado | Sintoma | Correção |
|------------------------|---------|----------|
| Só ligou **NFe** (emissão), não **Recebimento de NFes** | 400 no ERP | Ligar Recebimento de NFes e salvar |
| CNPJ Focus ≠ CNPJ Cadastros ERP | 400 | Alinhar CNPJ ou recriar empresa |
| Token produção + homolog no ERP | 401 | Usar token_homologacao + homolog marcado |
| Token de **outra** empresa da conta | 400 | Abrir a empresa do CNPJ certo e copiar o token dela |
| Token colado incompleto | 401 ou 400 | Copiar pelo olho, colar de novo, Salvar no ERP |
| Certificado de outro CNPJ | Focus não libera / erro no painel | PFX do mesmo CNPJ |
| Testou empresa A no ERP e token da empresa B | 400 | Seletor de empresa + token da mesma |

---

## 6. Ordem ideal (resumo de 1 página)

```
1. Cadastros ERP → anotar CNPJ (14 dígitos)
2. Focus → Nova empresa (ou Detalhes) → mesmo CNPJ
3. Endereço / IE / regime preenchidos
4. Certificado A1 do mesmo CNPJ (se pedido)
5. Documentos fiscais → Recebimento de NFes = LIGADO → Salvar
6. Tokens → copiar token_homologacao
7. ERP → Focus NFe → colar token + homolog → Salvar → Testar
8. Se OK → Entrada de Notas → Buscar na Focus (sync)
```

---

## 7. Quando chamar o suporte Focus

Se CNPJ, token, ambiente e **Recebimento de NFes** estiverem corretos e o `curl` / Testar conexão ainda der 400:

- E-mail: suporte@focusnfe.com.br  
- Informe: CNPJ, ambiente (homologação), mensagem `CNPJ do emitente não autorizado ou não informado`, e que precisa de `habilita_manifestacao` / recebimento DistDFe.

---

## Referências

| Documento | URL |
|-----------|-----|
| Introdução API | https://doc.focusnfe.com.br/reference/introducao |
| Autenticação | https://doc.focusnfe.com.br/reference/autenticacao |
| Ambientes | https://doc.focusnfe.com.br/reference/ambiente |
| Criar empresa | https://doc.focusnfe.com.br/reference/criar_empresa |
| NFe recebidas | https://doc.focusnfe.com.br/reference/nfe-recebidas |
| Manual ERP (sync/token) | `MANUAL-FOCUS-NFE.md` |
