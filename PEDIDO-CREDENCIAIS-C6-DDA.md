# Pedido ao dono da conta C6 — credenciais de API (DDA)

**Para:** responsável pela conta PJ C6 da Conexão Atacadista  
**De:** equipe do ERP  
**Objetivo:** liberar a consulta de boletos DDA e o download do PDF no sistema.  
**Nesta etapa não vamos:** emitir boleto de cobrança, pagar boleto pelo banco nem movimentar saldo.

---

## 1. Conta que vamos conectar

| Campo | Valor |
| --- | --- |
| Banco | 336 — Banco C6 S.A. |
| Agência | 0001 |
| Conta corrente | 43779572-1 |
| CNPJ | 34.221.243/0001-71 |
| Nome | CONEXAO ATACADISTA |

Se algum dado estiver errado, responda antes de gerar a chave.

---

## 2. O que **não** precisa enviar

- Senha do internet banking
- Token / código do celular
- Saldo, extrato ou lista de boletos
- Dados de outras contas

---

## 3. O que precisa gerar e devolver

Enviar **por e-mail ou WhatsApp direto** para quem for configurar o ERP (não em grupo, não no git, não em print público).

1. **Client ID**
2. **Client Secret** (copiar na hora; o banco some com o valor depois)
3. Arquivo do certificado **`.crt`**
4. Arquivo da chave privada **`.key`**
5. Print ou lista das **permissões** marcadas na chave

O download do certificado muitas vezes é **uma única vez**. Guardar o zip em local seguro.

---

## 4. Tela “Parceiro” / chave parceira (o que apareceu agora)

O C6 **não gera** Client ID, Secret nem `.crt` antes de escolher um **parceiro**.  
Parceiro = software house **já cadastrada** no portal C6 Developers. A lista (JORGE ALBERTO, SANTA CATARINA INFORMATICA, AOSAFE, etc.) são **outras empresas**.

**Não selecionar nenhum nome dessa lista.** Isso entregaria a chave da conta Conexão para um sistema que não é o nosso.

O ERP próprio **ainda não está** nessa lista. Ordem correta:

1. Cadastrar a empresa do sistema em [https://developers.c6bank.com.br/](https://developers.c6bank.com.br/) (Cadastro), com produtos **pagamentos / DDA**.
2. Esperar o C6 homologar o parceiro (pode pedir e-mail, sandbox, gerente).
3. Voltar no Web Banking → **Nova chave** → no campo **Parceiro**, buscar o nome **dessa** empresa cadastrada.
4. Só então **Criar nova chave** — aí saem Client ID, Secret e o certificado (`.crt` + `.key`).

Se a Conexão for dona do ERP (sistema interno), o cadastro no portal pode ser o próprio CNPJ `34.221.243/0001-71`. Se o ERP for de outra software house, cadastra o CNPJ **dela** — e é esse nome que aparece em Parceiro.

Não usar TecnoSpeed nem outro nome da lista, a menos que a integração passe por esse produto (não é o caso deste ERP).

---

## 5. Como gerar a chave (depois do parceiro existir na lista)

Usar o login **responsável da conta PJ**.

1. Entrar em [https://www.c6bank.com.br/web-banking/](https://www.c6bank.com.br/web-banking/)
2. Menu (três pontos) ao lado do nome da empresa
3. **Meu Perfil** → **Integrações via API**
4. **Nova chave**
5. Campo **Parceiro**: buscar só a empresa do ERP já homologada (não escolher outro da lista)
6. Em permissões, habilitar:
   - **consulta DDA / pagamentos** (boletos emitidos *contra* o CNPJ)
   - **PDF do boleto**
7. **Não basta** marcar só “Boleto de Cobrança” — isso é *emitir* boleto para cliente, não listar o que temos a pagar
8. Aceitar os termos e criar a chave
9. Copiar Client ID e Client Secret
10. Baixar o certificado (`.crt` + `.key`)

---

## 6. Se a tela Integrações via API não aparecer

Responder só isto: **“Não aparece Integrações via API.”**

Aí o próximo passo é o **gerente C6** liberar API nesta conta PJ. O ERP não consegue desbloquear isso.

---

## 7. Checklist de devolução

- [ ] Parceiro do ERP cadastrado em developers.c6bank.com.br e visível no campo Parceiro
- [ ] Chave criada **só** com esse parceiro (nenhuma outra empresa da lista)
- [ ] Client ID
- [ ] Client Secret
- [ ] Arquivo `.crt`
- [ ] Arquivo `.key`
- [ ] Permissões incluem consulta DDA + PDF (não só emissão de cobrança)
- [ ] Envio por canal privado
