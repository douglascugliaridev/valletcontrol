# WalletControl

Aplicação de **controle financeiro pessoal**: receitas, despesas e valores a receber
(devedores), organized em um **relatório mensal** com resumo, filtros, decomposição
por categoria/cartão, **parcelamento**, **cartões de crédito** e **regras recorrentes**.

Projetado para uso pessoal em rede local (celular e desktop na mesma rede) e também
publicado na Vercel.

> **Nota sobre o nome:** o projeto já foi chamado de `ValletControl`. O rename para
> `WalletControl` foi aplicado em código, assets, repositório, role/banco do Postgres,
> container Docker, dados de seed, nomes de projeto **e domínios** Vercel. O slug antigo
> `valletcontrol-*.vercel.app` permanece apenas como alias de compatibilidade dos mesmos
> deployments — ver [14.1](#141-deploy).

---

## Sumário

1. [O que o sistema faz](#1-o-que-o-sistema-faz)
2. [Stack](#2-stack)
3. [Arquitetura](#3-arquitetura)
4. [Estrutura do monorepo](#4-estrutura-do-monorepo)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Regras de negócio](#6-regras-de-negócio)
7. [Endpoints da API](#7-endpoints-da-api)
8. [Contrato de erro](#8-contrato-de-erro)
9. [Autenticação e segurança](#9-autenticação-e-segurança)
10. [Isolamento por usuário e RLS](#10-isolamento-por-usuário-e-rls)
11. [Front-end](#11-front-end)
12. [Seed e importação de planilhas](#12-seed-e-importação-de-planilhas)
13. [Configuração e ambiente](#13-configuração-e-ambiente)
14. [Como rodar](#14-como-rodar)
15. [Comandos](#15-comandos)
16. [Testes](#16-testes)
17. [Gaps conhecidos](#17-gaps-conhecidos)

---

## 1. O que o sistema faz

**Autenticação.** Cadastro e login com e-mail e senha, sessão via JWT.

**Dashboard mensal.** Seletor de mês/ano com virada de ano automática, resumo com
Receitas / Despesas / Saldo / A receber, tabela de lançamentos e decomposição por
categoria ou cartão.

**Lançamentos.** Três tipos — `receita`, `despesa` e `devedor` — com valor em centavos,
descrição, mês/ano de competência, vencimento opcional e status de pago.

**Parcelamento.** Um lançamento pode ser criado com N parcelas distributed em meses
consecutivos, começando numa parcela intermediária. Parcelas formam um grupo e podem
ser editadas ou excluídas em série ou individualmente.

**Cartões.** CRUD de cartões (bandeira, últimos 4 dígitos, cor, logo da bandeira,
marcador de padrão). O cartão funciona como **bucket de classificação** da despesa e
como método de pagamento do devedor.

**Regras recorrentes.** Uma regra descreve um lançamento que se repete todo mês a
partir de um mês/ano inicial (salário, aluguel, assinatura). Ela entra no relatório
mensal como linha sintética, sem duplicar dados.

---

## 2. Stack

| Camada                | Tecnologia                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- |
| Monorepo              | pnpm workspaces + Turborepo 2.11                                                       |
| Linguagem             | TypeScript 5.9 em modo `strict`                                                        |
| Web                   | Next.js 16.3.5 (App Router) + React 19.3                                               |
| Estado/cache no front | TanStack Query 5.81                                                                    |
| Estilo                | Tailwind CSS 4.3 (config CSS-first, sem `tailwind.config.js`)                          |
| Tema                  | `next-themes` 0.4.6 (classe `dark` no `<html>`)                                        |
| API                   | NestJS 11.2 sobre **Express** (`@nestjs/platform-express`)                             |
| Banco                 | PostgreSQL + Prisma 7.10 com _driver adapter_ (`@prisma/adapter-pg` + `pg`)            |
| Autenticação          | JWT via `@nestjs/jwt` + `passport-jwt`; hash de senha com `node:crypto` **scrypt**     |
| Validação             | `class-validator` (DTOs na borda HTTP) + **Zod 4** e regras puras em `packages/shared` |
| Lint/format           | ESLint 10 + `typescript-eslint` + Prettier 3.6                                         |
| Testes                | Jest 30 (API) e Vitest 5 (domínio compartilhado)                                       |
| Deploy                | Vercel — `walletcontrol-api` e `walletcontrol-frontend`                                |

**Requisitos:** Node `>= 22.12.0` e pnpm `>= 10` (o projeto fixa `pnpm@10.26.0`).

---

## 3. Arquitetura

### 3.1 Monorepo

```
valletcontrol/                    (raiz — ver nota de rename no topo)
├── apps/
│   ├── api/                      @walletcontrol/api    — NestJS + Prisma
│   └── web/                      @walletcontrol/web    — Next.js
└── packages/
    ├── shared/                   @walletcontrol/shared — domínio puro
    └── config/                   tsconfig + eslint compartilhados (sem package.json)
```

`turbo.json` define as tarefas `build`, `dev`, `lint`, `typecheck`, `test`, `test:unit`
e `clean`. `build`, `lint`, `typecheck` e `test` dependem de `^build`, ou seja, o pacote
dependente só roda depois que suas dependências foram compiladas. `.env` e `tsconfig.json`
são `globalDependencies`, e as variáveis de ambiente usadas estão declaradas em `globalEnv`
para que o cache do Turbo seja invalidado quando elas mudam.

### 3.2 API — arquitetura hexagonal

Cada módulo segue quatro camadas, e a dependência aponta sempre para dentro:

```
ui/                 controller + dto/        ← HTTP: rotas, validação de borda, status
  ↓
application/
  ├── use-cases/                            ← orquestração e regra de negócio aplicada
  └── ports/                                ← interfaces abstratas (contrato de saída)
  ↓
infrastructure/                             ← Prisma repositories + enum mappers
```

Regras-chave dessa organização:

- **Controllers e use cases nunca importam Prisma.** Só os repositories em
  `infrastructure/` tocam o client gerado.
- **Toda operação de repositório recebe `ownerId`.** O `ownerId` vem do token JWT
  (via `@CurrentUser()`), nunca do body da requisição — é o que garante o isolamento
  por usuário no nível da aplicação.
- **Ports são classes abstratas** injetadas via `providers` do módulo Nest:

  | Port                          | Implementação                   |
  | ----------------------------- | ------------------------------- |
  | `UserRepositoryPort`          | `PrismaUserRepository`          |
  | `PasswordHasherPort`          | `ScryptPasswordHasher`          |
  | `TokenServicePort`            | `JwtTokenService`               |
  | `CardRepositoryPort`          | `PrismaCardRepository`          |
  | `RecurringRuleRepositoryPort` | `PrismaRecurringRuleRepository` |
  | `TransactionRepositoryPort`   | `PrismaTransactionRepository`   |

- **Enums em duas grafias.** O domínio fala minúsculo (`despesa`, `contas_fixas`) e o
  banco guarda MAIÚSCULO (`DESPESA`, `CONTAS_FIXAS`). A conversão fica isolada em
  `infrastructure/enum-mapper.ts` de cada módulo, com _fallback_ seguro
  (`?? 'OUTROS'` / `?? 'outros'`) para nunca quebrar uma escrita.

### 3.3 Domínio compartilhado

`packages/shared` é TypeScript puro, sem dependência de framework, publicado com `tsup`
(ESM + CJS + `.d.ts`). É a **fonte da verdade das regras**, consumida pela API e também
pelo front (que valida antes de enviar, para dar feedback imediato).

```
packages/shared/src/
├── domain/
│   ├── enums.ts            enums, listas, labels pt-BR, CATEGORY_TO_TYPE
│   ├── money.ts            centavos, Intl BRL, classe Money
│   ├── transaction.ts      entidades e tipos de query/sumário
│   ├── card.ts             bandeiras e helpers
│   ├── recurring-rule.ts   entidade e predicados de recorrência
│   ├── recurrence.ts       addMonths / expandRecurrence
│   ├── rules.ts            ⭐ validação de negócio, resumo, parcelas
│   ├── schemas.ts          espelho Zod das entradas
│   └── user.ts             usuário e contratos de auth
└── api/contract.ts         contratos HTTP compartilhados
```

---

## 4. Estrutura do monorepo

```
apps/api/
├── prisma/
│   ├── schema.prisma             datasource, 4 models, 3 enums
│   ├── prisma.config.ts          Prisma 7: URL vem daqui, não do schema
│   ├── migrations/                7 migrações + migration_lock.toml
│   ├── seed.ts                    seed idempotente
│   ├── logos/                     havan.png, itaucard.png, nubank.png
│   └── scripts/import-spreadsheet.ts   importador de .xlsx (CLI)
├── src/
│   ├── main.ts                    bootstrap, prefixo global, ValidationPipe, CORS
│   ├── app.module.ts              ConfigModule, PrismaModule, APP_GUARD
│   ├── generated/prisma/          client Prisma 7 gerado (versionado)
│   ├── common/
│   │   ├── auth/                  jwt.strategy, guard, decorators
│   │   ├── config/                configuração tipada com fail-fast
│   │   ├── errors/                AppError e subclasses
│   │   ├── exceptions/            GlobalExceptionFilter
│   │   └── prisma/                PrismaService (adapter) + module
│   ├── modules/
│   │   ├── auth/                  register, login, me
│   │   ├── cards/                 CRUD de cartões
│   │   ├── recurring-rules/       CRUD de regras recorrentes
│   │   ├── transactions/          relatório mensal + CRUD
│   │   └── health/                health check público
│   └── test/                      fixtures compartilhadas pelos specs

apps/web/
├── app/
│   ├── layout.tsx                 root layout + metadata (único Server Component)
│   ├── providers.tsx              QueryClientProvider + ThemeProvider
│   ├── globals.css                @theme claro/escuro (Tailwind v4)
│   ├── icon.png                   app icon
│   ├── page.tsx                   redireciona / -> /dashboard ou /login
│   ├── (auth)/auth-shell.tsx      layout compartilhado de login/register
│   ├── login/ · register/         autenticação
│   ├── dashboard/                 relatório mensal
│   └── settings/                  cartões + regras recorrentes
├── components/
│   ├── ui/index.tsx               Button, Card, Input, Select, Badge, Modal, …
│   ├── logo.tsx · theme-toggle.tsx · month-selector.tsx
│   ├── filters-bar.tsx · filters.types.ts
│   ├── summary-cards.tsx · category-breakdown.tsx · transactions-table.tsx
│   ├── transaction-form.tsx       criação/edição com parcelas
│   ├── cards-manager.tsx · recurring-rules-manager.tsx
│   └── card-logo.tsx
├── lib/
│   ├── api.ts                     client fetch, sessão, ApiError
│   ├── hooks.ts                   hooks TanStack Query
│   ├── format.ts · display.ts · cn.ts
└── public/                        walletcontrol-logo.png, walletcontrol-mark.png
```

---

## 5. Modelo de dados

Datasource `postgresql`; o client é gerado por `prisma-client` para
`apps/api/src/generated/prisma`. No Prisma 7 a URL **não** fica no schema — vem de
`prisma.config.ts`, que carrega `../../.env` e depois `apps/api/.env` (o segundo tem
precedência).

### 5.1 Diagrama

```
                 ┌──────────┐
                 │  users   │
                 └────┬─────┘
      ┌─────────────────┼──────────────────┬────────────────────┐
      │ ON DELETE       │ ON DELETE        │ ON DELETE          │
      │ CASCADE         │ CASCADE          │ CASCADE            │
      ▼                 ▼                  ▼                    │
┌──────────────┐  ┌───────────────┐  ┌──────────────────┐        │
│ transactions │  │    cards      │  │ recurring_rules  │        │
└──────┬───────┘  └───────────────┘  └──────────────────┘        │
       │                                                        │
       │ cardId          ── ON DELETE SET NULL ──┐              │
       │ recurringRuleId ── ON DELETE SET NULL ──┼──────────────┘
       │ installmentGroupId (sem FK, chave lógica)
       ▼
```

Três decisões de modelagem merecem destaque:

1. **`installmentGroupId` não é chave estrangeira.** É um `String?` sem FK, apenas
   indexado. O grupo de parcelas é uma noção de aplicação: apagar o grupo inteiro ou
   propagar um patch para ele são operações em massa (`updateMany`/`deleteMany` com
   `where: { installmentGroupId, ownerId }`). Um FK exigiria uma tabela `installment_group`.
2. **`Transaction.category` é anulável, `RecurringRule.category` não.** A anulabilidade
   é a expressão do _bucket_ de despesa (ver [6.2](#62-regra-do-bucket-categoria-ou-cartão)).
   Uma regra recorrente nunca é "de cartão", então não precisa de nulabilidade.
3. **`dueDate` é `@db.Date`**, não timestamp, e o repositório converte para
   `new Date(Date.UTC(y, m - 1, d))` ao gravar e para `yyyy-mm-dd` ao ler — evita
   deslocamento de um dia por fuso horário.

### 5.2 Models

**`User`** → `users`

| Campo                     | Tipo       | Observação                            |
| ------------------------- | ---------- | ------------------------------------- |
| `id`                      | `String`   | `@id @default(cuid())`                |
| `name`                    | `String`   | obrigatório                           |
| `email`                   | `String`   | `@unique`                             |
| `passwordHash`            | `String`   | nunca sai da camada de infraestrutura |
| `createdAt` / `updatedAt` | `DateTime` | `@default(now())` / `@updatedAt`      |

Índices: `@@index([email])` (o `@unique` já cria `users_email_key`).

**`Transaction`** → `transactions`

| Campo                     | Tipo              | Observação                                          |
| ------------------------- | ----------------- | --------------------------------------------------- |
| `id`                      | `String`          | `cuid()`                                            |
| `ownerId`                 | `String`          | FK `users.id` **CASCADE**                           |
| `description`             | `String`          | 1–200 chars (validado na aplicação)                 |
| `amountCents`             | `Int`             | **centavos**, sempre `> 0`                          |
| `type`                    | `TransactionType` | `RECEITA` \| `DESPESA` \| `DEVEDOR`                 |
| `category`                | `Category?`       | **anulável** — `null` = despesa bucketed por cartão |
| `paymentMethod`           | `PaymentMethod?`  | só para `DEVEDOR`                                   |
| `cardId`                  | `String?`         | FK `cards.id` **SET NULL**                          |
| `dueDate`                 | `DateTime?`       | `@db.Date`                                          |
| `month`                   | `Int`             | 1–12, competência                                   |
| `year`                    | `Int`             | competência                                         |
| `isPaid`                  | `Boolean`         | `@default(false)`                                   |
| `recurringRuleId`         | `String?`         | FK `recurring_rules.id` **SET NULL**                |
| `installmentGroupId`      | `String?`         | chave lógica da série de parcelas                   |
| `createdAt` / `updatedAt` | `DateTime`        |                                                     |

Índices compostos, escolhidos para as consultas reais do relatório:
`@@index([ownerId, year, month])` (filtro do mês), `@@index([ownerId, dueDate])`
(ordenação por vencimento) e `@@index([installmentGroupId])` (operações em série).

**`Card`** → `cards`

| Campo       | Tipo        | Observação                               |
| ----------- | ----------- | ---------------------------------------- |
| `id`        | `String`    | `cuid()`                                 |
| `ownerId`   | `String`    | FK CASCADE                               |
| `name`      | `String`    | rótulo livre, ex.: "Meu Nubank"          |
| `brand`     | `CardBrand` | `NUBANK` \| `ITAUCARD` \| `OTHERS`       |
| `last4`     | `String?`   | exatamente 4 dígitos quando presente     |
| `color`     | `String?`   | hex `#rgb` ou `#rrggbb`                  |
| `logoUrl`   | `String?`   | preenchido automaticamente pela bandeira |
| `isDefault` | `Boolean`   | `@default(false)`                        |

Índice: `@@index([ownerId, name])`. A listagem ordena por `isDefault desc, name asc`.

**`RecurringRule`** → `recurring_rules`

| Campo         | Tipo              | Observação                                             |
| ------------- | ----------------- | ------------------------------------------------------ |
| `id`          | `String`          | `cuid()`                                               |
| `ownerId`     | `String`          | FK CASCADE                                             |
| `description` | `String`          |                                                        |
| `amountCents` | `Int`             | centavos `> 0`                                         |
| `type`        | `TransactionType` |                                                        |
| `category`    | `Category`        | **obrigatório**                                        |
| `startMonth`  | `Int`             | 1–12 — **imutável após a criação**                     |
| `startYear`   | `Int`             | **imutável após a criação**                            |
| `monthsAhead` | `Int?`            | `null` = sem prazo (ver [6.9](#69-regras-recorrentes)) |
| `isActive`    | `Boolean`         | `@default(true)`                                       |

Índice: `@@index([ownerId, isActive])`. Listagem ordena por
`isActive desc, startYear asc, startMonth asc`.

### 5.3 Enums

| Enum (banco)      | Valores                                          |
| ----------------- | ------------------------------------------------ |
| `TransactionType` | `RECEITA`, `DESPESA`, `DEVEDOR`                  |
| `Category`        | `CONTAS_FIXAS`, `OUTROS`, `RECEITA`, `DEVEDORES` |
| `PaymentMethod`   | `NUBANK`, `ITAUCARD`                             |
| `CardBrand`       | `NUBANK`, `ITAUCARD`, `OTHERS`                   |

`Category` já teve `NUBANK` e `ITAUCARD`; a migration
`20260919223000_despesa_bucket_cartao` converteu essas categorias em `cardId` e recriou
o enum. Essa é a origem histórica da regra de bucket.

### 5.4 Migrações

| Migração                                   | O que faz                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20200101000000_baseline`                  | placeholder `SELECT 1;` — marca um banco já existente como baselinado                                                                                  |
| `20260919165908_init`                      | enums iniciais, `users` e `transactions` (com `category NOT NULL`), FK e índices                                                                       |
| `20260919213035_add_cards_recurring_rules` | enum `CardBrand`, colunas `cardId`/`recurringRuleId`, tabelas `cards` e `recurring_rules`                                                              |
| `20260919223000_despesa_bucket_cartao`     | **backfill**: cria cartões padrão por dono (idempotente), deixa `category` anulável, converte `NUBANK`/`ITAUCARD` → `cardId`, recria o enum `Category` |
| `20260920090000_add_card_logo_url`         | `cards.logoUrl`                                                                                                                                        |
| `20260920162236_add_installment_group`     | `transactions.installmentGroupId` + índice, com backfill que agrupa por (dono, descrição sem prefixo `i/N`, valor, tipo) quando há 2+ ocorrências      |
| `20260927000000_enable_rls`                | habilita Row Level Security e cria policies (ver [seção 10](#10-isolamento-por-usuário-e-rls))                                                         |

As migrations de backfill são **idempotentes** (`WHERE NOT EXISTS`, `DROP POLICY IF EXISTS`),
para poderem ser aplicadas com segurança sobre bancos que já tinham os dados.

---

## 6. Regras de negócio

Esta seção é a referência canônica. Todas as regras vivem em `packages/shared/src/domain`
e são aplicadas pela API; o front revalida parte delas para dar feedback imediato.

### 6.1 Vocabulário

| Conceito              | Enum              | Significado                                            |
| --------------------- | ----------------- | ------------------------------------------------------ |
| `receita`             | `TransactionType` | entrada de dinheiro                                    |
| `despesa`             | `TransactionType` | saída de dinheiro                                      |
| `devedor`             | `TransactionType` | valor a **receber** de terceiros                       |
| `contas_fixas`        | `Category`        | despesa recorrente previsível (aluguel, luz, internet) |
| `outros`              | `Category`        | despesa avulsa                                         |
| `receita`             | `Category`        | categoria de entradas                                  |
| `devedores`           | `Category`        | categoria de valores a receber                         |
| `nubank` / `itaucard` | `PaymentMethod`   | por onde o devedor vai pagar                           |

O mapeamento **categoria → tipo** é fixo e centraliza a coerência do formulário:

| Categoria      | Tipo obrigatório |
| -------------- | ---------------- |
| `contas_fixas` | `despesa`        |
| `outros`       | `despesa`        |
| `receita`      | `receita`        |
| `devedores`    | `devedor`        |

`devedor` é o único tipo que carrega `paymentMethod`, e `devedores` é a única categoria
que aceita `paymentMethod`.

### 6.2 Regra do bucket: categoria **ou** cartão

Esta é a regra central do sistema de despesas. Uma despesa pertence a **exatamente um**
bucket de classificação:

```
bucket = CATEGORIA  (contas_fixas | outros)     → category = '...', cardId = null
      OU
bucket = CARTÃO     (nubank | itaucard | outros) → category = null,  cardId = '<id>'
```

Nunca os dois, nunca nenhum. No banco isso se manifesta como `category` anulável: quando
`category IS NULL`, a classificação vem do cartão. É por isso que `Category` historicamente
tinha valores de bandeira, e a migration `20260919223000` converteu os dados existentes
para essa representação.

### 6.3 Validação de transação

`validateTransactionInput(input)` em `packages/shared/src/domain/rules.ts`. As regras
rodam **nesta ordem** e a primeira que falha interrompe (o erro carrega um
`DomainErrorCode`):

| #   | Condição                                                            | `DomainErrorCode`            | Mensagem                                                                               |
| --- | ------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `month` não inteiro ou fora de 1–12                                 | `INVALID_MONTH`              | `Mês inválido: {month}. Esperado 1-12.`                                                |
| 2   | `year` não inteiro ou fora de 1900–2200                             | `INVALID_YEAR`               | `Ano inválido: {year}.`                                                                |
| 3   | `amountCents` não é inteiro seguro ou `≤ 0`                         | `INVALID_AMOUNT`             | `Valor inválido: … Deve ser um inteiro de centavos positivo.`                          |
| 4   | `category === null` **e** (não é `despesa` **ou** não tem `cardId`) | `CATEGORY_REQUIRED`          | `Toda transação exige uma categoria (ou um cartão, para despesas).`                    |
| 5   | `category !== null` e `type ≠ CATEGORY_TO_TYPE[category]`           | `CATEGORY_TYPE_MISMATCH`     | `Tipo "{type}" incompatível com a categoria "{category}" (esperado "{expectedType}").` |
| 6   | `despesa` com `category` **e** `cardId`                             | `CATEGORY_CARD_CONFLICT`     | `Uma despesa deve pertencer a uma categoria fixa OU a um cartão, não a ambos.`         |
| 7   | `devedor` sem `paymentMethod`                                       | `PAYMENT_METHOD_REQUIRED`    | `Transações do tipo "devedor" exigem um método de pagamento (cartão).`                 |
| 8   | tipo diferente de `devedor` com `paymentMethod`                     | `PAYMENT_METHOD_NOT_ALLOWED` | `Método de pagamento "{pm}" só é permitido para transações do tipo "devedor".`         |
| 9   | `paymentMethod` com categoria cujo tipo não é `devedor`             | `PAYMENT_METHOD_NOT_ALLOWED` | `Categoria "{category}" não permite método de pagamento. Use a categoria "devedores".` |

A regra 4 é o que garante que `category: null` só pode aparecer no caso "despesa com
cartão" — nem receita nem devedor podem ficar sem categoria.

### 6.4 Coerência entre método de pagamento e bandeira

`validateCardPaymentConsistency({ paymentMethod, cardBrand })` roda logo após a validação
anterior, no create e no update. Mapeia bandeira → método esperado:

| Bandeira do cartão | Método esperado                                       |
| ------------------ | ----------------------------------------------------- |
| `nubank`           | `nubank`                                              |
| `itaucard`         | `itaucard`                                            |
| `outros`           | `null` — **sempre rejeita** se houver `paymentMethod` |

Duas tolerâncias deliberadas: se não houver `paymentMethod`, ou se não houver
`cardBrand` (cartão usado só como etiqueta de bucket), a função retorna sem reclamar.
Quando há divergência, o erro é `CARD_METHOD_MISMATCH`.

### 6.5 Dinheiro

Valores são sempre **centavos inteiros** no banco e no domínio. Ponto flutuante só
aparece nas bordas de entrada/saída do usuário.

```ts
toCents(reais) = Math.round(reais * 100);
toReais(cents) = cents / 100;
```

A classe `Money` encapsula isso de forma imutável (`Money.fromCents`, `Money.fromReais`,
`zero`, `add`, `subtract`, `isPositive`, `isNegative`, `isZero`, `toString`), lançando
`RangeError` em entradas não inteiras / não finitas. A formatação usa um único
`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`, o que garante
`R$ 1.234,56` em qualquer tela. No front, `lib/format.ts` espelha essas conversões e
`parseReaisToCents` aceita tanto `"R$ 1.234,56"` quanto `"1234.56"`.

### 6.6 Cálculo do resumo mensal

`calculateSummary(transactions)` é uma função **pura** sobre a lista do mês. Devolve
`TransactionSummary` com seis campos:

```
totalIncomeCents   = Σ amountCents  para type == receita
totalExpenseCents  = Σ amountCents  para type == despesa
balanceCents       = totalIncomeCents − totalExpenseCents
totalDebtorsCents  = Σ amountCents  para type == devedor
paidDebtorsCents   = Σ amountCents  para type == devedor && isPaid
unpaidDebtorsCents = Σ amountCents  para type == devedor && !isPaid
```

**Decisão de negócio central: `devedor` não entra no saldo.** Um valor a receber não é
dinheiro disponível, então `balanceCents` é sempre receitas − despesas. Devedores têm
seu próprio par (`paid` / `unpaid`) porque o que importa ali é _quanto ainda falta
receber_, não o impacto no caixa. Por isso o card "A receber" no dashboard mostra
`pago X · pendente Y`.

A função faz exaustividade de tipos em tempo de compilação (`tx.type satisfies never`):
um `type` novo no enum gera erro de compilação até que o `switch` seja atualizado.
Um tipo desconhecido em tempo de execução lança `Tipo de transação desconhecido: …`.

### 6.7 Parcelas

Ao criar um lançamento com mais de uma parcela, a API **materializa N transações reais**
(no plural, no mesmo request) — não há linha "parcelado" pendente.

**Quantidade de parcelas.** O teto é `MAX_INSTALLMENTS = 240` (20 anos), e não há mais
limite artificial de 12. Esse número é a fonte única da verdade: o `recurrenceSchema` (zod),
o `RecurrenceDto` da API e o `<Input max>` do formulário leem a mesma constante, de modo que
o front nunca aceita um valor que a API rejeitaria. A regra pura `expandRecurrence` não
impõe teto — a validação fica nas bordas.

**Expansão.** `expandRecurrence(config)` em `domain/recurrence.ts`:

```
addMonths(month, year, amount):
  total     = year * 12 + (month - 1) + amount
  nextYear  = floor(total / 12)
  nextMonth = (total % 12) + 1
```

`addMonths` é a base da virada de ano: nunca produz mês 0 nem 13.

```
expandRecurrence({ startMonth, startYear, installments, startFrom = 1 }):
  count = installments − startFrom + 1
  para i em [0, count):
    installment = startFrom + i
    { month, year } = addMonths(startMonth, startYear, i)
    → { month, year, installment }
```

Validações (lançam `RangeError`): `installments` inteiro `≥ 1`; `startFrom` inteiro
`≥ 1`; e `startFrom ≤ installments`.

_Exemplo canônico:_ `{ startMonth: 11, startYear: 2026, installments: 12, startFrom: 4 }`
→ 9 instâncias (`4/12` … `12/12`), meses `[11,12,1,2,3,4,5,6,7]`, anos
`[2026, 2026, 2027 × 7]`. É o caso "comprei um celular em novembro, parcelei em 12,
já paguei 3".

**Descrição serializada.** `buildInstallmentDescription(base, installment, total)`
produz `` `${installment}/${total} ${base}` `` — `1/12 Celular`, `12/12 Celular`.
Quando é uma única parcela, a descrição original é preservada sem prefixo.

**Grupo.** Se houver mais de uma instância, um `randomUUID()` é gerado e gravado em
`installmentGroupId` de todas as parcelas. Lançamento sem recorrência **não** recebe grupo.

**Demais campos na expansão.** `dueDate`, `amountCents`, `type`, `category`,
`paymentMethod` e `cardId` são **copiados para todas as parcelas**; `month` e `year`
mudam conforme a expansão. Cada parcela é validada individualmente
(`validateTransactionInput` + `validateCardPaymentConsistency`) **antes** de qualquer
escrita — uma série inválida inteira é rejeitada, sem resíduo no banco.

A resposta é um array ordenado por mês de referência (`year` → `month` → `dueDate`).

### 6.8 Edição e exclusão em série

**Edição** (`PATCH /transactions/:id` com `applyToAll: true`):

```
SERIES_FIELDS = description, amountCents, type, category, paymentMethod, cardId, dueDate
INDIVIDUAL    = month, year, isPaid
```

Se `applyToAll` e a transação tiver `installmentGroupId`, o patch é filtrado para
`SERIES_FIELDS` e:

1. o registro existente é mesclado com o patch e **validado**;
2. `updateMany({ installmentGroupId, ownerId }, seriesPatch)`;
3. a transação é relida e devolvida.

Caso contrário (sem grupo, ou patch só com `month`/`year`/`isPaid`), o fluxo é
**individual**: merge + validação + `update` de uma linha.

**Regra de negócio:** o mês, o ano e o status de pagamento são **sempre individuais**.
Parcelas de um celular têm vencimentos e pagamentos distintos; propagar `isPaid` para
todas marcaria como pagas as que ainda não venceram. O front reflete isso com o texto
"Mês, ano e status de pagamento continuam individuais em cada parcela."

**Exclusão** (`DELETE /transactions/:id?scope=one|series`): `scope=series` com
`installmentGroupId` apaga o grupo inteiro via `deleteMany`; qualquer outro valor de
`scope` apaga só a linha. O front pede a confirmação do escopo em um modal.

### 6.9 Regras recorrentes

Uma regra é uma **descrição declarativa** de um lançamento que se repete, não um
gerador de dados. Ela não cria transações.

**Materialização no relatório.** `ListMonthlyReportUseCase` carrega as regras do dono e,
para cada uma:

```
shouldMaterializeRule(rule, month, year):
  se !rule.isActive                              → false
  startsAfter = year > rule.startYear
            || (year === rule.startYear && month >= rule.startMonth)
  se !startsAfter                                → false
  se rule.monthsAhead é null                     → true     (sem prazo)
  end = addMonths(startMonth, startYear, monthsAhead - 1)
  → year < end.year || (year === end.year && month <= end.month)
```

**Horizonte (`monthsAhead`).** Por padrão a regra **não tem prazo**: `monthsAhead` é
`null` e ela vale de `startMonth/startYear` em diante, indefinidamente. É o certo para a
maioria das contas fixas (aluguel, energia, internet), que não têm data de término.

Quando preenchido, `monthsAhead` limita a regra aos próximos N meses **contando o mês
inicial**: `1` gera só o mês de início, `12` fecha um ano exato. A aritmética passa por
`addMonths`, então a virada de ano é automática (início em novembro com `monthsAhead: 4`
cobre nov, dez, jan e fev). O teto é `MAX_MONTHS_AHEAD = 600`, lido tanto pelo DTO da API
quanto pelo formulário, para o front nunca aceitar o que a API rejeita.

A coluna é nullable de propósito: as regras já existentes ficam com `null` e **não mudam
de comportamento** com esta migração. O campo é editável depois (`PATCH` com
`monthsAhead` muda o horizonte; `null` explícito volta para "sem prazo").

```
coveredByRule(transactions, ruleId, month, year):
  transactions.some(t => t.recurringRuleId === ruleId && t.month === month && t.year === year)
```

`coveredByRule` garante **idempotência**: se o usuário já materializou manualmente o
lançamento daquele mês (uma transação real apontando para a regra), a linha sintética não
é duplicada.

**Linha sintética.** Quando materializada, a regra entra no relatório com:

| Campo                     | Valor                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| `id`                      | `` `${rule.id}:${month}:${year}` `` (id sintético, não é `cuid`) |
| `paymentMethod`           | `null`                                                           |
| `dueDate`                 | `null`                                                           |
| `isPaid`                  | `false`                                                          |
| `createdAt` / `updatedAt` | da própria regra                                                 |

**O detalhe mais importante:** a linha sintética entra em `calculateSummary` mas **não é
retornada em `report.transactions`**. Ou seja, ela muda o total de receitas/despesas/a
receber do mês, mas não aparece como linha clicável na tabela.

_Por quê?_ Se a linha fosse retornada, o usuário veria "Salário" na lista e poderia
tentar marcar como pago, editar ou excluir um id que não existe no banco — um bug
garantido. Mantendo a linha sintética confinedida ao resumo, a projeção para o mês
continua correta e a lista só contém transações reais, que são editáveis.

A linha também respeita os filtros: `matchesQuery` compara `search` (case-insensitive
em `description`), `type`, `category` e `isPaid`, de forma idêntica às transações reais.

**Imutabilidade do início.** `startMonth`/`startYear` não existem em `RecurringRuleUpdate`
nem em `UpdateRecurringRuleDto` — a data de início é definida na criação e nunca muda.
Isso evita que uma regra já projetada para meses passados produza valores incoerentes.

### 6.10 Cartões

**Cartão é etiqueta + bucket + método de pagamento.** Criar um cartão não gera
transações; ele é apenas referenciado.

**Normalização no create/update:** `name.trim()`, `last4?.trim() ?? null`,
`color?.trim() ?? null`, `logoUrl?.trim() ?? null`, `isDefault ?? false`.

**Logo por bandeira (derivada, sempre coerente).** O arquivo da bandeira é lido do bundle
(`prisma/logos/{nubank,itaucard}.png`, com fallback para `apps/api/dist/prisma/logos/`
no layout Vercel) e a URL pública `/{API_PREFIX}/cards/logos/{brand}` é gravada em
`logoUrl`. A regra é: **`logoUrl` é sempre o caminho derivado da bandeira atual do cartão**,
verificado por `ensureBrandLogo` na criação, na leitura (`findByIdAndOwner`/`findAllByOwner`)
e no update. Qualquer divergência é reescrita e persistida.

Isso importa porque cartões criados antes de `13a0ba3` guardavam
`/api/uploads/{uuid}.png`, caminhos do upload em runtime que **não existem mais** (não há
rota `/api/uploads`, e o `uploads/` saiu do versionamento). A versão anterior só preenchia
`logoUrl` quando estava vazio (`if (row.logoUrl) return row`), então um cartão com path
legado ficava com imagem quebrada para sempre — era a causa de a logo de um cartão não
bater com a bandeira. Como o upload em runtime deixou de ser um caminho válido, o `PATCH`
descarta `logoUrl` do patch e deixa `ensureBrandLogo` decidir.

O endpoint serve o PNG com `Cache-Control: public, max-age=31536000, immutable`, e
`CardLogo` cai no ícone genérico quando a imagem falha ao carregar — antes ele devolvia
`null` e deixava um círculo vazio, porque quem decidia o fallback testava o `logoUrl`
(verdadeiro mesmo com arquivo morto) em vez do carregamento.

`havan.png` existe no diretório mas **não** é resolvido por `readBrandLogo` (só
`nubank` e `itaucard` são), então `GET /cards/logos/havan` responde 404 — o arquivo está
versionado como reserva.

**Bandeira `OTHERS` não tem logo** e, por [6.4](#64-coerência-entre-método-de-pagamento-e-bandeira),
não pode ser usada como `paymentMethod` de devedor. `ensureBrandLogo` grava `null` nesse
caso, o que devolve o cartão ao ícone genérico.

### 6.11 Isolamento por usuário

Toda consulta de repository recebe `ownerId` e o inclui no `where`. `findByIdAndOwner`,
`updateByIdAndOwner` e `deleteByIdAndOwner` usam `findFirst`/`deleteMany` com
`{ id, ownerId }` — então um id de outro usuário simplesmente **não é encontrado**
(404), nunca "atualizado" nem "vazado". Os specs cobrem isso explicitamente
(casos "retorna NotFound quando a transação não pertence ao dono").

`ownerId` nunca vem do body: é extraído do token pelo decorator `@CurrentUser()`.

### 6.12 Projeção de datas

`dueDate` é coluna `DATE`, mas trafega como string `yyyy-mm-dd` no contrato:

```
gravação:  toDbDueDate("2026-09-30") → new Date(Date.UTC(2026, 8, 30))
leitura:   toIsoDate(Date)            → date.toISOString().slice(0, 10)
```

Construir em **UTC** é o que impede o off-by-one clássico: em `America/Sao_Paulo`,
`new Date(2026, 8, 30)` (meio-dia local) gravado como `DATE` seria truncado para o dia
29 em algumas combinações de driver.

---

## 7. Endpoints da API

Prefixo global = `API_PREFIX` (padrão `api`), definido em `main.ts` via
`app.setGlobalPrefix(...)`. **16 rotas.** Tudo exige `Authorization: Bearer <token>`,
exceto o que tem `@Public()`.

### 7.1 Auth — `/api/auth`

| Método | Rota             | Auth    | Body          | Sucesso                                           |
| ------ | ---------------- | ------- | ------------- | ------------------------------------------------- |
| `POST` | `/auth/register` | pública | `RegisterDto` | `201` `{ user, tokens }`                          |
| `POST` | `/auth/login`    | pública | `LoginDto`    | `200` `{ user, tokens }`                          |
| `GET`  | `/auth/me`       | JWT     | —             | `200` `{ id, name, email, createdAt, updatedAt }` |

`RegisterDto`: `name` 2–80, `email` válido até 160, `password` 8–128 **e** com regex
`/^(?=.*[a-zA-Z])(?=.*\d)/` ("A senha deve conter letras e números.").
`LoginDto`: `email` normalizado com `@Transform(trim + toLowerCase)`, `password` 1–128.

A resposta de auth é `{ user, tokens: { accessToken } }`. **Não há refresh token** — o
JWT expira e o usuário faz login de novo. `passwordHash` nunca é serializado: o
`PrismaUserRepository.toDomain` o remove, e o `LoginUseCase` ainda o descarta por
destructuring antes de devolver.

### 7.2 Cards — `/api/cards`

| Método   | Rota                  | Auth        | Detalhe                                                                             |
| -------- | --------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `POST`   | `/cards`              | JWT         | `CreateCardDto` → `201`                                                             |
| `GET`    | `/cards`              | JWT         | `200` `Card[]` ordenado por `isDefault desc, name asc`                              |
| `GET`    | `/cards/logos/:brand` | **pública** | PNG, `Cache-Control: immutable`; `404` se bandeira não permitida ou arquivo ausente |
| `PATCH`  | `/cards/:id`          | JWT         | `UpdateCardDto` (todos opcionais) → `200`                                           |
| `DELETE` | `/cards/:id`          | JWT         | `204`                                                                               |

`CreateCardDto`: `name` 1–60, `brand` precisa ser `CardBrand` **e** estar em `CARD_BRANDS`,
`last4` opcional com `/^\d{4}$/`, `color` opcional com `/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`,
`isDefault` opcional booleano (coerção por `@Transform(toBool)`, que trata
`"true"`/`"false"`). **`CreateCardDto` não aceita `logoUrl`** — a logo é responsabilidade
da bandeira, resolvida no servidor.

### 7.3 Recurring rules — `/api/recurring-rules`

| Método   | Rota                   | Auth | Detalhe                          |
| -------- | ---------------------- | ---- | -------------------------------- |
| `POST`   | `/recurring-rules`     | JWT  | `CreateRecurringRuleDto` → `201` |
| `GET`    | `/recurring-rules`     | JWT  | `200` `RecurringRule[]`          |
| `PATCH`  | `/recurring-rules/:id` | JWT  | `UpdateRecurringRuleDto` → `200` |
| `DELETE` | `/recurring-rules/:id` | JWT  | `204`                            |

`CreateRecurringRuleDto`: `description` 1–200, `amountCents` int `≥ 1`, `type` em
`TRANSACTION_TYPES`, `category` **obrigatório** em `CATEGORIES`, `startMonth` 1–12,
`startYear` 2000–2200, `isActive` opcional. `UpdateRecurringRuleDto` aceita apenas
`description`, `amountCents`, `type`, `category`, `isActive` — ver
[6.9](#69-regras-recorrentes).

### 7.4 Transactions — `/api/transactions`

| Método   | Rota                                  | Auth | Detalhe                                                       |
| -------- | ------------------------------------- | ---- | ------------------------------------------------------------- |
| `GET`    | `/transactions/monthly`               | JWT  | `ListMonthlyReportQueryDto` → `MonthlyReport`                 |
| `POST`   | `/transactions`                       | JWT  | `CreateTransactionDto` → `201` `{ transactions[] }`           |
| `PATCH`  | `/transactions/:id`                   | JWT  | `UpdateTransactionDto` (+ `applyToAll`) → `200` `Transaction` |
| `DELETE` | `/transactions/:id?scope=one\|series` | JWT  | `204`                                                         |

**Relatório mensal.** `month` e `year` são opcionais e caem no mês/ano corrente
(avaliados no carregamento do módulo). Filtros opcionais: `search` (1–200),
`type`, `category`, `isPaid`. A ordenação é `dueDate asc, createdAt asc`; `search` usa
`contains` com `mode: 'insensitive'`.

Resposta:

```ts
interface MonthlyReport {
  month: Month;
  year: number;
  transactions: Transaction[]; // só transações reais
  summary: TransactionSummary; // inclui as linhas sintéticas das regras
}
```

**Recorrência no create.** `CreateTransactionDto.recurrence` (opcional, validado com
`@ValidateNested`) traz `installments` (int, 1–240) e `startFrom` (opcional, 1–240),
sujeito ao validador de classe `StartFromWithinInstallments`, que rejeita
`startFrom > installments` com a mensagem `Parcela inicial não pode ser maior que o
total de parcelas.`

**`applyToAll`.** No `PATCH`, `applyToAll: true` dispara a propagação em série
([6.8](#68-edição-e-exclusão-em-série)). O controller converte com
`applyToSeries = dto.applyToAll === true`.

**`toTransactionUpdate` usa `!== undefined`, não `in`.** Detalhe deliberado: com
`useDefineForClassFields`, o `class-transformer` materializa todos os campos declarados,
então `'x' in dto` seria sempre `true` e todo campo ausente viraria `null` — um update
parcial zeraria `cardId`, `paymentMethod` e `dueDate`. Usando `!== undefined`, só entram
chaves presentes, e um `null` explícito (enviado de propósito) é preservado, permitindo
**limpar** esses campos.

### 7.5 Health — `/api/health`

| Método | Rota      | Auth        | Resposta                                      |
| ------ | --------- | ----------- | --------------------------------------------- |
| `GET`  | `/health` | **pública** | `{ status: "ok", timestamp: "2026-09-29T…" }` |

Única rota sem use case: está declarada direto em `AppModule.controllers`.

---

## 8. Contrato de erro

O `GlobalExceptionFilter` normaliza toda exceção em `ErrorResponse`
(tipo compartilhado em `packages/shared/src/api/contract.ts`):

```ts
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  domainCode?: string; // só em DomainValidationError
}
```

Ordem de resolução:

| Origem                  | Status                | `error`                                                       | Observação                                         |
| ----------------------- | --------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| `DomainValidationError` | `422`                 | `UnprocessableEntity`                                         | inclui `domainCode`                                |
| `AppError`              | 404 / 409 / 401 / 403 | `kind` (`NOT_FOUND`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`) | mapeado por `kind`                                 |
| `HttpException` do Nest | original              | original                                                      | preserva o array de mensagens do `class-validator` |
| qualquer outra          | `500`                 | `InternalServerError`                                         | loga stack no servidor                             |

Erros `≥ 500` são logados com método, URL e stack via `Logger.error`.

`DomainErrorCode` (`packages/shared`): `INVALID_MONTH`, `INVALID_YEAR`, `INVALID_AMOUNT`,
`PAYMENT_METHOD_REQUIRED`, `PAYMENT_METHOD_NOT_ALLOWED`, `CATEGORY_TYPE_MISMATCH`,
`CATEGORY_REQUIRED`, `CATEGORY_CARD_CONFLICT`, `MONTH_YEAR_REQUIRED`,
`INVALID_CREDENTIALS`, `EMAIL_ALREADY_IN_USE`, `CARD_METHOD_MISMATCH`.

O front usa `domainCode` apenas para diagnóstico: `ApiError` carrega `status`,
`message` e `domainCode`, e `authErrorMessage(err, fallback)` escolhe entre a mensagem
em português da API, uma mensagem de falha de rede (que sugere verificar se o
dispositivo está na mesma rede) ou o fallback.

### 8.1 `ValidationPipe` global

`main.ts` registra `new ValidationPipe({ whitelist: true, transform: true,
transformOptions: { enableImplicitConversion: false }, forbidNonWhitelisted: true })`.

- `whitelist` remove propriedades não declaradas no DTO;
- `forbidNonWhitelisted` **rejeita** a requisição se vier campo extra (422);
- `enableImplicitConversion: false` desliga a coerção implícita — a conversão de query
  string é explícita via `@Type(() => Number)`, evitando que `"abc"` vire `NaN` em
  silêncio.

---

## 9. Autenticação e segurança

### 9.1 Fluxo

```
POST /auth/register | /auth/login
  → valida DTO (class-validator)
  → use case normaliza email (trim + toLowerCase)
  → PrismaUserRepository busca por email
  → ScryptPasswordHasher.verify (só se o usuário existir)
  → JwtTokenService.sign({ sub: user.id, email })
  → 200/201 { user, tokens: { accessToken } }

requisições seguintes
  → Authorization: Bearer <accessToken>
  → JwtStrategy valida assinatura e expiração
  → validate(payload) → { userId, email }
  → @CurrentUser() injeta no handler
  → repository usa ownerId
```

### 9.2 Guard global

`JwtAuthGuard` (`AuthGuard('jwt')`) é registrado como `APP_GUARD` em `app.module.ts`,
ou seja, **aplica-se a todas as rotas por padrão**. Ele consulta
`Reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])`: se a rota (ou a classe
do controller) tem `@Public()`, o guard retorna `true` sem consultar o Passport. É o
padrão _deny-by-default_ — esquecer de proteger uma rota nova é impossível, só o
oposto acontece.

`@CurrentUser()` extrai `request.user` e, se ausente, lança
`CurrentUser decorator usado sem guard de autenticação.` — falha barulhenta em vez de
`ownerId: undefined` chegando ao banco.

### 9.3 Hash de senha — scrypt

`ScryptPasswordHasher` usa apenas `node:crypto`, sem dependência nativa:

| Parâmetro   | Valor                                             |
| ----------- | ------------------------------------------------- |
| algoritmo   | `crypto.scrypt`                                   |
| `N` (custo) | `1 << 14` = **16384** (recomendação OWASP)        |
| `r`         | 8                                                 |
| `p`         | 1                                                 |
| `keylen`    | 64 bytes                                          |
| `maxmem`    | 64 MB                                             |
| salt        | `randomBytes(16)` por hash                        |
| formato     | `scrypt$` + `saltHex` + `$` + `keyHex` (3 partes) |

A verificação faz `split('$')`, recusa qualquer coisa que não tenha exatamente 3 partes
com prefixo `scrypt`, deriva com o mesmo custo e compara com
`crypto.timingSafeEqual` — **comparação em tempo constante**, sem vazamento por tempo.
Como o comprimento da chave derivada é lido do hash armazenado
(`expected.length || KEY_LENGTH`), o formato tolera chaves de tamanhos diferentes.

`BCRYPT_SALT_ROUNDS` aparece na configuração e no `.env`, mas **não é consumido pelo
hasher** — é herança de nomenclatura. O custo real é o `N = 16384` fixo no código.

O `prisma/seed.ts` replica exatamente o mesmo algoritmo e formato, de modo que a senha
do usuário demo funciona igual em qualquer ambiente.

### 9.4 Anti-enumeração de contas

`LoginUseCase` é deliberadamente indistinguível nos dois casos de falha:

- e-mail inexistente → `UnauthorizedError('Email ou senha inválidos.')`
- senha errada → **a mesma** mensagem

E, quando o usuário não existe, `hasher.verify` **não é chamado** — o tempo de resposta
não revela se o e-mail está cadastrado. A única exceção de mensagem é o
`ConflictError('Email já cadastrado.')` no registro, que é necessário para dar
feedback de UX e não revela nada (a pessoa acabou de digitar o e-mail).

---

## 10. Isolamento por usuário e RLS

Há **duas camadas** de isolamento, independentes.

**Camada 1 — aplicação (ativa).** Todo repository recebe `ownerId` do JWT e o inclui no
`where`. É o que está em produção e o que os 54 testes da API exercitam.

**Camada 2 — RLS no Postgres** (migration `20260927000000_enable_rls`). Habilita Row
Level Security em `users`, `transactions`, `cards` e `recurring_rules` e cria policies
apenas para o role `authenticated`, baseadas em `auth.uid()`:

| Tabela            | Policy                | Operação | Condição                                 |
| ----------------- | --------------------- | -------- | ---------------------------------------- |
| `users`           | `users_read_own`      | `SELECT` | `auth.uid()::text = id`                  |
| `users`           | `users_update_own`    | `UPDATE` | `auth.uid()::text = id` (+ `with check`) |
| `users`           | `users_delete_own`    | `DELETE` | `auth.uid()::text = id`                  |
| `cards`           | `cards_own`           | `ALL`    | `ownerId = auth.uid()::text`             |
| `transactions`    | `transactions_own`    | `ALL`    | `ownerId = auth.uid()::text`             |
| `recurring_rules` | `recurring_rules_own` | `ALL`    | `ownerId = auth.uid()::text`             |

Detalhes importantes:

- **Não há policy de `INSERT` em `users`.** O cadastro de conta só acontece pela API.
- **RLS habilitada, não `FORCE`**, e a API conecta como role com `BYPASSRLS` — então o
  **comportamento da API não muda**. A RLS existe para proteger um eventual _Data API /
  PostgREST_ (Supabase) exposto sobre o mesmo banco, onde o `auth.uid()` vem do JWT do
  cliente em vez do header da API.
- As policies são criadas **somente se `auth.uid()` existir** no banco. Em um PostgreSQL
  sem Supabase, a migration apenas habilita RLS e emite um `RAISE NOTICE`.
- Cada policy é precedida de `DROP POLICY IF EXISTS`, tornando a migration idempotente.

---

## 11. Front-end

### 11.1 Rotas

| Rota         | Comportamento                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | Client component que faz `router.replace('/dashboard')` se há token, senão `/login`. Renderiza `null` — há um flash de página vazia no hard load. |
| `/login`     | Formulário de e-mail/senha → `POST /auth/login` → grava sessão → `/dashboard`                                                                     |
| `/register`  | Formulário de nome/e-mail/senha → `POST /auth/register` → grava sessão → `/dashboard`                                                             |
| `/dashboard` | Relatório mensal completo                                                                                                                         |
| `/settings`  | Gerenciadores de cartões e regras recorrentes                                                                                                     |

`app/layout.tsx` é o **único Server Component** do app. Todo o restante é
`'use client'`. O metadata vive só aqui:

```ts
title: { default: 'WalletControl — Controle financeiro pessoal', template: '%s · WalletControl' }
```

O `<html>` tem `lang="pt-BR"` e `suppressHydrationWarning` (obrigatório para o
`next-themes`, que escreve a classe antes da hidratação).

### 11.2 Guarda de autenticação

Client-side, no `useEffect`: sem token no `localStorage` → `router.replace('/login')`,
enquanto isso um `Spinner` em tela cheia. Não existe `middleware.ts` nem verificação no
servidor — a segurança real está na API (o guard global rejeita qualquer requisição sem
JWT). O front lê o nome do usuário do `localStorage` via `getStoredUser()` e **nunca
chama `GET /auth/me`**.

### 11.3 Sessão

`lib/api.ts` gerencia o token sem cookie e sem `httpOnly`:

```ts
const TOKEN_KEY = 'walletcontrol.token';
const USER_KEY = 'walletcontrol.user';
```

> A chave mudou de `valletcontrol.*` para `walletcontrol.*` no rename. Quem tinha
> sessão salva no navegador precisa **entrar de novo** uma vez — não há migração
> transparente das chaves.

`api<T>(path, options)` é o único caminho de requisição:

1. `auth` padrão `true` → anexa `Authorization: Bearer <token>` se houver token;
2. `Content-Type: application/json` só quando o body **não** é `FormData` (para o
   browser montar o boundary do multipart);
3. `204` → retorna `undefined` (compatível com os deletes);
4. corpo não-JSON → `null`, e um `!res.ok` vira `ApiError(status, message, domainCode)`;
5. `ApiError` distingue falha HTTP de `TypeError` (falha de rede), que é o que permite a
   mensagem "não foi possível conectar ao servidor" no `authErrorMessage`.

`API_ORIGIN` é derivado de `API_URL` removendo o sufixo `/api`, e `resolveAssetUrl(path)`
transforma as URLs relativas de logo (`/api/cards/logos/nubank`) em absolutas — é o que
permite que o front na LAN carregue logos servidas pela API.

### 11.4 Dados com TanStack Query

```
reportKey(params)         = ['transactions', 'monthly', params]
cardsKey                  = ['cards']
recurringRulesKey         = ['recurring-rules']
```

`params` inteiro é embutido na key do relatório, então cada combinação de filtro é uma
entrada de cache própria. `defaultOptions.queries`: `staleTime: 30_000`, `retry: 1`,
`refetchOnWindowFocus: false`.

| Hook                                                      | Tipo     | Invalida no sucesso                            |
| --------------------------------------------------------- | -------- | ---------------------------------------------- |
| `useMonthlyReport(params)`                                | query    | —                                              |
| `useCards()`                                              | query    | —                                              |
| `useRecurringRules()`                                     | query    | —                                              |
| `useCreateTransaction()`                                  | mutation | `['transactions']`                             |
| `useUpdateTransaction()`                                  | mutation | `['transactions']`                             |
| `useDeleteTransaction()`                                  | mutation | `['transactions']`                             |
| `useCreateCard()` / `useUpdateCard()` / `useDeleteCard()` | mutation | `['cards']`                                    |
| `useCreateRecurringRule()` / `useUpdate…` / `useDelete…`  | mutation | `['recurring-rules']` **e** `['transactions']` |

As três mutations de regra invalidam também `['transactions']` porque alterar uma regra
muda a projeção do resumo mensal — sem isso, o card de receitas ficaria defasado.

`monthlyParams()` envia `isPaid` quando `!== undefined` (inclusive `false`) — é o que faz
o filtro "Pendentes" funcionar; omitir o `false` faria o front pedir "todos".

### 11.5 Dashboard

- **Header** — logo, nome, primeiro nome do usuário, alternador de tema, atalho para
  Configurações e Sair.
- **MonthSelector** — `move(delta)` monta `new Date(year, month - 1 + delta, 1)`, o que
  dá virada de ano automática; o rótulo usa `formatMonthYear` com `capitalize` para
  "Setembro 2026".
- **SummaryCards** — 4 tiles: Receitas (`emerald`), Despesas (`rose`), Saldo (vermelho
  se negativo) e A receber (`amber`, com detalhe `pago X · pendente Y`). Skeletons
  durante o carregamento.
- **FiltersBar** — busca com **debounce de 350 ms** (via `setTimeout` com ref,
  sincronizado de volta por `useEffect`); selects de tipo, categoria e pago/pendente
  disparam imediatamente. **A lista de categorias depende do tipo**:
  `CATEGORIES.filter(c => CATEGORY_TO_TYPE[c] === filters.type)`, e trocar o tipo
  **reseta a categoria** para `undefined`. Botão "Limpar" desabilitado quando não há
  filtro.
- **TransactionsTable** — botão circular de pago/pendente (fica `line-through` quando
  pago), badges de tipo e de categoria **ou** chip de cartão (quando `category` é nula,
  resolve o cartão via `cardId`), vencimento, valor com sinal, editar e excluir. Sem
  paginação: o mês inteiro filtrado é renderizado em uma lista.
- **CategoryBreakdown** — agrega **no cliente** (a API não devolve breakdown):
  `key = t.category ?? t.cardId ?? 'sem-categoria'`, ordena decrescente e desenha barras
  com `width = (cents / total) * 100` (com `total` mínimo 1 para evitar divisão por zero).
- **TransactionForm** — o formulário mais denso do app; ver [11.6](#116-formulário-de-transação).
- **Modal de exclusão** — muda conforme a transação ter `installmentGroupId`: nesse caso
  oferece "Apenas esta parcela" **e** "Todas as parcelas"; senão, confirmação simples.

### 11.6 Formulário de transação

O estado local é um `Draft` de **strings** (o input de valor é texto livre em pt-BR) e
é convertido para o payload só no `submit`.

**Regras aplicadas na UI, espelhando o domínio:**

- Trocar o **tipo** limpa `paymentMethod`, `cardId` e recoloca a primeira categoria
  válida do novo tipo.
- Escolher o **bucket da despesa** (`onExpenseBucketChange`) faz tudo de uma vez: se o
  valor é um id de cartão, grava `cardId` **e** `category: 'outros'` (que será
  normalizado para `null` no submit); senão grava `category` e limpa `cardId`. Isso é a
  UI CDL da regra de bucket.
- Escolher um **cartão** (`onCardChange`) preenche `paymentMethod` automaticamente via
  `cardToPaymentMethod(brand)`.
- No `submit`, `category` é forçada a `null` quando é despesa com `cardId`, e
  `paymentMethod` é `null` para qualquer tipo diferente de `devedor`.
- Erros client-side: descrição vazia, valor inválido, devedor sem método, mais de 12
  parcelas, `startFrom < 1`, `startFrom > installments`.

**Parcelas.** Os campos "Parcelas" e "Iniciar na parcela" só aparecem na **criação**
(parcelas não podem ser adicionadas depois). O rótulo do botão é calculado para dizer
exatamente o que vai acontecer:

```
1 parcela ...................................... "Criar"
N parcelas, começando na 1 ..................... "Criar 12 lançamentos"
N parcelas, começando na K ..................... "Criar 9 lançamentos (4/12 a 12/12)"
```

`recurrence` só é enviado no body quando `installments > 1`; `startFrom` só quando `> 1`.

**Edição em série.** Se a transação tem `installmentGroupId`, o topo do modal ganha um
seletor de duas opções — "Apenas esta parcela" / "Todas as parcelas" — com o aviso de que
mês, ano e status de pagamento permanecem individuais. O valor vira `applyToAll`.

### 11.7 Tema e estilos

`globals.css` usa a abordagem CSS-first do Tailwind v4: `@import 'tailwindcss'` e um
bloco `@theme` com tokens em **tríades HSL sem o wrapper `hsl()`** (convenção shadcn
que faz os modificadores de opacidade tipo `bg-primary/15` funcionarem). O modo escuro
redefine as mesmas variáveis dentro de `.dark`, e
`@custom-variant dark (&:where(.dark, .dark *))` faz o variant ser dirigido por classe.

`next-themes` com `attribute="class"`, `defaultTheme="system"` e `enableSystem`
(persiste na chave padrão `theme`). O `ThemeToggle` renderiza um placeholder
`<div className="size-9" />` até montar, evitando divergência de ícone entre servidor e
cliente; oferece apenas alternância claro/escuro, sem opção de "voltar ao sistema".

O design system está em `components/ui/index.tsx`: `Button` (5 variants × 3 tamanhos),
`Card`, `CardHeader`, `CardTitle`, `Label`, `Input`, `Select` (com `ChevronDown`
posicionado), `Badge` (4 tons), `Skeleton`, `Spinner` e `Modal`. O `Modal` fecha no
`Escape`, trava o `scroll` do `body`, funciona como bottom-sheet no mobile
(`items-end sm:items-center`) e **não** usa focus trap nem portal.

`cn()` combina `clsx` + `tailwind-merge`, permitindo sobrescrever classes do componente
ao passar `className`.

---

## 12. Seed e importação de planilhas

### 12.1 Seed — `pnpm db:seed`

Executa `tsx prisma/seed.ts`. Carrega `../../.env` e `apps/api/.env`, exige
`DATABASE_URL` e é **idempotente** (tudo por `upsert`, com ids sintéticos derivados do
id do usuário).

**Usuário:** `demo@walletcontrol.app` / senha `senha-segura-123`, nome "Usuário Demo",
com hash scrypt gerado no mesmo formato da produção.

**2 cartões:** Nubank (final `4321`, cor `#8b5cf6`, `isDefault: true`) e Itaucard
(final `9876`, cor `#f59e0b`). As logos de bandeira são instaladas após o create.

**10 transações**, todas no mês/ano corrente, cobrindo todos os buckets e combinações:

| #   | Descrição        | Valor    | Tipo    | Categoria      | Cartão                        | Venc. | Pago |
| --- | ---------------- | -------- | ------- | -------------- | ----------------------------- | ----- | ---- |
| 1   | Salário          | 4.500,00 | receita | `receita`      | —                             | 5     | sim  |
| 2   | Freela projeto X | 1.200,00 | receita | `receita`      | —                             | 15    | não  |
| 3   | Aluguel          | 1.800,00 | despesa | `contas_fixas` | —                             | 10    | sim  |
| 4   | Conta de luz     | 320,00   | despesa | `contas_fixas` | —                             | 12    | sim  |
| 5   | Internet         | 120,00   | despesa | `contas_fixas` | —                             | 20    | não  |
| 6   | Mercado          | 540,00   | despesa | `null`         | Nubank                        | 3     | sim  |
| 7   | Combustível      | 280,00   | despesa | `null`         | Itaucard                      | 25    | sim  |
| 8   | Pizza com amigos | 180,00   | despesa | `outros`       | —                             | 22    | não  |
| 9   | Compra Notebook  | 3.500,00 | devedor | `devedores`    | — (`paymentMethod: ITAUCARD`) | 27    | não  |
| 10  | Venda Xbox       | 900,00   | devedor | `devedores`    | — (`paymentMethod: NUBANK`)   | 30    | sim  |

> **Renomeação:** o e-mail do seed mudou de `demo@valletcontrol.app` para
> `demo@walletcontrol.app`. Como o seed faz `upsert` **por e-mail**, rodar o seed de novo
> cria um usuário **novo** e deixa o antigo no banco — sem órfãos, já que as transações,
> cartões e regras linked são removidas por `ON DELETE CASCADE`.
>
> Em vez de apagar e recriar (o que perderia as 40 transações do demo), renomeie o e-mail
> no lugar, preservando tudo — as FKs apontam por `id`:
>
> ```sql
> UPDATE users SET email = 'demo@walletcontrol.app', "updatedAt" = now()
>  WHERE email = 'demo@valletcontrol.app';
> ```

### 12.2 Importador de planilhas — `import:spreadsheet`

CLI independente (`tsx scripts/import-spreadsheet.ts`, usa **ExcelJS**), para tratar a
planilha de controle financeiro real.

```bash
# dry-run (padrão) — só mostra o plano
pnpm --filter @walletcontrol/api import:spreadsheet -- --file planilha.xlsx

# grava de verdade
pnpm --filter @walletcontrol/api import:spreadsheet -- --file planilha.xlsx --apply --email voce@exemplo.com --confirm

# desfaz
pnpm --filter @walletcontrol/api import:spreadsheet -- --rollback imports/spreadsheet-<ts>.json --confirm
```

Características:

- **Dry-run por padrão.** Nada é escrito sem `--apply` **e** `--confirm`.
- **Shift de −1 mês.** `shiftMonth(m, y, -1)` com `zeroBased = year * 12 + (month - 1) + amount`.
  As abas (`JAN`…`DEZ`) representam o mês em que a conta **vence**, e o sistema
  registra no mês de **competência**.
- **Layout fixo por aba** (linhas 5–22 para despesas, 27+ para devedores, 28 para receita),
  mapeando colunas para bucket:
  - colunas 2,3,4 → `CONTAS_FIXAS`
  - colunas 5,6,7 → despesa com `category: null` + cartão Nubank
  - colunas 8,9,10 → despesa com `category: null` + cartão Itaucard
  - colunas 11,12,13 → `OUTROS`
  - linha 28, colunas 2/3 → receita
  - linhas 27+, colunas 11/12/13 → devedores, com sub-seções detectadas por
    `^Devedores Nubank` / `^Devedores Itau` e fim em `TOTAL`
- **Parcelas.** `parseInstallment` casa `^(\d+)-(\d+)\s+(.+)$`, normaliza para `i/N base`
  e agrupa por `installment:<base>:<cents>:<type>:<bucket>`, atribuindo um UUID por chave.
- **Pago.** Aceita `x`, `sim`, `true`, `1`, `pago`, `paga`, `yes`, `y`, `✓`
  (case-insensitive). **Receitas são sempre `isPaid: true`**.
- **Valores.** Aceita número ou string; remove `R$`; se há `,` e não `.`, troca `,` por
  `.`, senão remove `,`; `amountCents = Math.round(amount * 100)`.
- Ignora linhas sem descrição, com descrição `TOTAL`, ou com valor `null`/`<= 0`.
- **Uma única transação SQL** para todas as escritas (`$transaction`, `maxWait 10s`,
  `timeout 120s`).
- **Manifest de rollback** em `imports/spreadsheet-<timestamp>.json` com
  `createdTransactionIds` e `createdCardIds` — o `--rollback` apaga exatamente esses ids.
- Respeita `DATABASE_SSL_REJECT_UNAUTHORIZED=false` (remove `sslmode` da URL e desliga
  a verificação do certificado).

---

## 13. Configuração e ambiente

### 13.1 Variáveis

`.env` fica na **raiz** do monorepo (a API carrega `../../.env` e depois
`apps/api/.env`, que tem precedência). `.env.example` é o modelo commitado.
`apps/web/.env.local` sobrescreve a URL da API para o ambiente local.

| Variável                           | Obrigatória | Padrão                      | Descrição                                                                       |
| ---------------------------------- | ----------- | --------------------------- | ------------------------------------------------------------------------------- |
| `NODE_ENV`                         | não         | `development`               |                                                                                 |
| `API_PORT`                         | não         | `3001`                      | `PORT` tem precedência                                                          |
| `API_PREFIX`                       | **sim**     | —                           | prefixo global de rotas (padrão prático: `api`)                                 |
| `DATABASE_URL`                     | **sim**     | —                           | `postgresql://…`                                                                |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | não         | —                           | `false` remove `sslmode` e desliga a verificação do certificado                 |
| `JWT_SECRET`                       | **sim**     | —                           | em produção: `openssl rand -base64 32` em secret manager                        |
| `JWT_EXPIRES_IN`                   | não         | `7d`                        |                                                                                 |
| `BCRYPT_SALT_ROUNDS`               | não         | `10`                        | **não consumido** pelo hasher (ver [9.3](#93-hash-de-senha--scrypt))            |
| `ALLOWED_ORIGINS`                  | não         | `http://localhost:3000`     | lista separada por vírgula, usada no CORS                                       |
| `NEXT_PUBLIC_API_URL`              | não         | `http://localhost:3001/api` | só no **front-end**: base das chamadas e da resolução de URLs relativas de logo |

`configuration.ts` é **fail-fast**: `required()` lança
`Variável de ambiente obrigatória ausente: X` no boot, e `int()` lança em valor não
inteiro, em vez de silenciosamente usar `NaN`.

`turbo.json` declara todas essas variáveis em `globalEnv`, para que mudar qualquer uma
invalide o cache das tarefas.

### 13.2 `DATABASE_URL` e o rename

O role, o banco e o container Docker usam **`walletcontrol`**. O `DATABASE_URL` é:

```
DATABASE_URL=postgresql://walletcontrol:walletcontrol@localhost:5433/walletcontrol?schema=public
```

O rename foi feito com `ALTER ... RENAME`, que move a entrada no catálogo e **preserva os
dados** (não é drop/recreate). Duas peculiarities do Postgres nessa operação:

- `ALTER DATABASE` exige estar conectado a **outra** base (não à que está renomeando).
- `ALTER ROLE ... RENAME` falha com `session user cannot be renamed` se você estiver
  autenticado como a própria role. Num banco sem superusuário `postgres`, a saída é criar
  uma role temporária superusuária, renomear por ela e removê-la em seguida.

O `pg_hba.conf` do container confia em `local` e em `127.0.0.1/32`, mas o acesso vindo do
host cai na regra `host all all all scram-sha-256` — então a senha **é** validada de fora do
container, mesmo que `docker exec psql` (socket) nunca a exercite. Para testar credencial de
verdade, conecte a partir do host.

> **A `DATABASE_URL` da Vercel é uma Secret cifrada** e este repositório não tem acesso ao
> valor em claro. Se o banco de produção também se chamar `valletcontrol`, renomeá-lo exige
> o valor atual dessa variável e acesso de superusuário ao servidor — ver
> [13.4](#134-migrações-aplicadas).

### 13.3 CORS

`app.enableCors({ origin: config.get('cors.allowedOrigins'), credentials: true })`.
Para acesso pela rede local, inclua o IP da máquina na lista
(ex.: `http://192.168.1.18:3000`).

### 13.4 Migrações aplicadas

A divergência que existia aqui foi resolvida: `prisma migrate status` responde
**“Database schema is up to date!”**. As três migrações que faltavam foram aplicadas com
`prisma migrate deploy`:

| Migração                                         | Observação                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `20200101000000_baseline`                        | marcador, só executa `SELECT 1;`                                 |
| `20260927000000_enable_rls`                      | idempotente; cria policies apenas se o schema `auth` existir     |
| `20260930120000_add_recurring_rule_months_ahead` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "monthsAhead" INTEGER` |

`migrate deploy` é o caminho seguro aqui, e não `migrate dev`: o `dev` reconstrói o banco
inteiro a partir do schema e perderia dados. Vale notar que `20260927000000_enable_rls` só
cria policies se o schema `auth` existir (Supabase Auth); no Postgres local ele apenas
habilita RLS, sem policies, e a API segue funcionando porque a role `walletcontrol` é
superusuário (superusuários ignoram RLS).

---

## 14. Como rodar

```bash
# 0. pré-requisitos
node -v   # >= 22.12.0
pnpm -v   # >= 10

# 1. dependências
pnpm install

# 2. configurar
cp .env.example .env
# edite DATABASE_URL, API_PREFIX, JWT_SECRET e NEXT_PUBLIC_API_URL

# 3. banco: gerar o client, migrar e popular
pnpm --filter @walletcontrol/api prisma:generate
pnpm db:migrate
pnpm db:seed

# 4. subir API e web (dois terminais, ou `pnpm dev` para os dois)
pnpm dev:api    # http://localhost:3001/api
pnpm dev:web    # http://localhost:3000
```

Acesse `http://localhost:3000` e entre com `demo@walletcontrol.app` /
`senha-segura-123` (após o seed).

**Acesso pela rede local (celular):** suba a API com o Bind em `0.0.0.0`, aponte
`NEXT_PUBLIC_API_URL` (em `apps/web/.env.local` **e** na env da Vercel) para o IP da
máquina, e adicione a origem em `ALLOWED_ORIGINS`. Se a conexão falhar, a mensagem de
erro do login sugere exatamente essa verificação.

### 14.1 Deploy

| Projeto                  | Root Directory | Observações                                                                                                                                                                                                                      |
| ------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `walletcontrol-api`      | raiz do repo   | Vercel detecta NestJS. `installCommand`, `buildCommand` e `outputDirectory` são definidos **no painel da Vercel** — `apps/api/vercel.json` fica **inerte**, porque o `rootDirectory` é a raiz e não existe `vercel.json` na raiz |
| `walletcontrol-frontend` | `apps/web`     | Next.js com `output: 'standalone'` e `transpilePackages: ['@walletcontrol/shared']`; sem override de `buildCommand`                                                                                                              |

> **Renomear pacotes exige atualizar o painel da Vercel.** O `buildCommand` da API cita
> `@walletcontrol/shared` e `@walletcontrol/api` explicitamente, e o painel tem precedência
> sobre o `vercel.json`. Um rename de pacote sem essa atualização falha com
> `No projects matched the filters` — foi o que quebrou o primeiro deploy pós-rename.

O `buildCommand` da API (definido no painel) é:

```
pnpm --filter @walletcontrol/shared build &&
pnpm --filter @walletcontrol/api build &&
mkdir -p apps/api/dist/prisma/logos && cp apps/api/prisma/logos/*.png apps/api/dist/prisma/logos/
```

O último passo existe porque as logos são lidas do **bundle** em runtime (não há upload
em disco — ver `13a0ba3`), e o `dist` do Nest não inclui arquivos que não são TypeScript.

A env `NEXT_PUBLIC_API_URL` do frontend precisa apontar para a URL pública da API.
Como é uma variável `NEXT_PUBLIC_*`, ela é **embutida no bundle no build** — trocar o
valor exige um novo deploy, não basta reiniciar.

> **Os domínios públicos agora são `walletcontrol-*`.** Renomear um projeto na Vercel não
> renomeia o domínio `*.vercel.app` já emitido, e o alias automático novo
> (`<projeto>-panizza.vercel.app`) fica atrás de `ssoProtection`
> (`all_except_custom_domains`). A saída foi **reivindicar o slug novo como domínio do
> próprio projeto** (`POST /v10/projects/{id}/domains`), que a Vercel aceita e marca como
> `verified` — sem precisar comprar domínio. Estado atual:
>
> | Serviço  | URL pública em uso                          | Legado (mesmo deploy)                       |
> | -------- | ------------------------------------------- | ------------------------------------------- |
> | Frontend | `https://walletcontrol-frontend.vercel.app` | `https://valletcontrol-frontend.vercel.app` |
> | API      | `https://walletcontrol-api.vercel.app/api`  | `https://valletcontrol-api.vercel.app/api`  |
>
> O slug antigo foi mantido como alias para não quebrar links salvos. A API da Vercel
> recusou transformar o alias legado em redirect (`Invalid redirect property`), então ele
> continua servindo o mesmo deployment em vez de redirigir.

> **`ALLOWED_ORIGINS` da API precisa acompanhar o domínio do frontend.** Migrar o domínio
> sem atualizar essa env produz um preflight `204` **sem** `access-control-allow-origin`: o
> status é sucesso e a falha só aparece no navegador, como falha de CORS. Como a env é
> cifrada, a forma de auditar sem lê-la é sondar a origem —
>
> ```bash
> curl -si -X OPTIONS https://walletcontrol-api.vercel.app/api/auth/login \
>   -H "Origin: https://walletcontrol-frontend.vercel.app" \
>   -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" \
>   | grep -i access-control-allow-origin
> ```
>
> Ausência do header = origem não liberada. Em produção a lista é só o domínio do
> frontend; localmente, `.env` traz `localhost:3000`, `localhost:3002` e o IP da LAN.

---

## 15. Comandos

Todos da raiz, via Turborepo:

| Comando                         | O que faz                            |
| ------------------------------- | ------------------------------------ |
| `pnpm dev`                      | sobe api e web em watch              |
| `pnpm dev:api` / `pnpm dev:web` | sobe um só                           |
| `pnpm build`                    | compila shared → api → web           |
| `pnpm test`                     | testes de todos os pacotes           |
| `pnpm test:api`                 | só os testes da API                  |
| `pnpm lint`                     | ESLint com as configs compartilhadas |
| `pnpm typecheck`                | `tsc --noEmit` em todos              |
| `pnpm format`                   | Prettier                             |
| `pnpm db:migrate`               | `prisma migrate dev`                 |
| `pnpm db:seed`                  | `prisma db seed`                     |
| `pnpm db:studio`                | Prisma Studio                        |
| `pnpm clean`                    | limpa builds e `node_modules`        |

Comandos só da API (`pnpm --filter @walletcontrol/api …`):

| Script               | O que faz                                                                           |
| -------------------- | ----------------------------------------------------------------------------------- |
| `prisma:generate`    | gera o client em `src/generated/prisma`                                             |
| `prisma:deploy`      | `prisma migrate deploy` (produção)                                                  |
| `test:cov`           | Jest com cobertura                                                                  |
| `import:spreadsheet` | importador de `.xlsx` (ver [12.2](#122-importador-de-planilhas--importspreadsheet)) |

### 15.1 Verificação completa

```bash
pnpm build && pnpm test && pnpm lint && pnpm typecheck
```

Estado atual: **4/4 tarefas** de `build`, `test`, `lint` e `typecheck` passando.

---

## 16. Testes

**67 testes no total, todos passando.**

### 16.1 API — Jest, 8 suítes / 54 testes

| Suíte                                     | Testes | Cobre                                                                                                                                                                                                                                |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create-transactions.use-case.spec.ts`    | 16     | validação de negócio ponta a ponta do create, escopo por `ownerId`, expansão de recorrência (incluindo `startFrom`), bucket cartão-vs-categoria, coerência método/bandeira, cartão de outro dono, atribuição de `installmentGroupId` |
| `update-transaction.use-case.spec.ts`     | 12     | update individual e em série, `NotFound` para transação de outro dono, propagação mantendo `month`/`year`/`isPaid` individuais, rejeição de série inválida antes de propagar, fallback para update individual                        |
| `register.use-case.spec.ts`               | 5      | normalização de e-mail, emissão de token, `Conflict` sem chamar `create`, login remove o hash, **anti-enumeração** (mesma mensagem para usuário inexistente)                                                                         |
| `scrypt-password-hasher.spec.ts`          | 5      | formato `scrypt$salt$key`, verificação correta/incorreta, rejeição de formato malformado, salts distintos, comparação em tempo constante                                                                                             |
| `transaction.dto.spec.ts`                 | 4      | `toTransactionUpdate` — o mapeamento de patch e a proteção contra `null` acidental (ver [7.4](#74-transactions--apitransactions))                                                                                                    |
| `delete-transaction.use-case.spec.ts`     | 4      | escopo `one` vs `series`, transação sem grupo                                                                                                                                                                                        |
| `list-monthly-report.use-case.spec.ts`    | 3      | injeção de regras no resumo, `coveredByRule` (idempotência), filtros aplicados                                                                                                                                                       |
| `recurring-rule-horizon.use-case.spec.ts` | 5      | `monthsAhead` repassado no create, ausente tratado como "sem prazo", `PATCH` com valor e com `null`, `404` para regra de outro dono                                                                                                  |

Os specs usam mocks dos ports e as fixtures de `apps/api/src/test/`
(`card.fixtures.ts`, `transaction.fixtures.ts`) — nenhum toca banco real.

### 16.2 Domínio — Vitest, 2 arquivos / 25 testes

`packages/shared/src/domain/rules.spec.ts` (18 testes), em três blocos:

- `validateTransactionInput` — 12 casos, um por regra de [6.3](#63-validação-de-transação),
  verificando **o `DomainErrorCode` exato**, não só que lança;
- `calculateSummary` — 1 caso com 5 transações fixando os seis totais e confirmando que
  devedor não entra no saldo;
- `validateCardPaymentConsistency` — 5 casos: métodos correspondentes, métodos cruzados,
  bandeira `outros`, e as duas tolerâncias (sem método / sem cartão).

`packages/shared/src/domain/recurring-rule.spec.ts` (7 testes) fixa a semântica de
`shouldMaterializeRule` de [6.9](#69-regras-recorrentes): sem prazo gera de `startMonth`
em diante; `monthsAhead: 1` gera só o inicial; `3` conta o inicial e para no terceiro;
`12` fecha um ano exato; a virada de novembro→fevereiro; e regra inativa nunca gera, mesmo
dentro do horizonte.

O front não tem suíte de testes: `pnpm test` roda `tsc --noEmit` no pacote web, e a
configuração do Jest existe mas não há arquivo `*.test.*`/`*.spec.*` no app.

---

## 17. Gaps conhecidos

Registrados para não surpreender quem for mexer no código:

1. **Divergência de faixa de ano.** A regra pura aceita `1900–2200`; o Zod
   (`yearSchema`) e os DTOs aceitam `2000–2200`. Um ano entre 1900 e 1999 passaria pelo
   domínio e seria barrado na borda. Divergir em `rules.ts` e `schemas.ts` é a correção
   natural.
2. **`MONTH_YEAR_REQUIRED`, `INVALID_CREDENTIALS` e `EMAIL_ALREADY_IN_USE`** estão
   declarados em `DomainErrorCode` mas **nunca lançados** — o fluxo real usa
   `ConflictError`/`UnauthorizedError`. São dead code no union type.
3. **Zod não cobre tudo.** `transactionInputSchema` não valida a coerência
   `type × category` além do caso `devedor × receita`, nem `category: null` fora de
   "despesa com cartão". A fonte da verdade é `validateTransactionInput` no servidor; o
   Zod é a camada de feedback rápido, não a garantia.
4. **`transactionInputSchema` permite `isPaid` default `false`**. O descasamento de limites
   de parcelas que existia aqui foi resolvido: o teto de 240 era hardcoded em três lugares
   e o front ainda barrava em 12. Agora `MAX_INSTALLMENTS` é a fonte única, lida pelo
   `recurrenceSchema` (zod), pelo `RecurrenceDto` e pelo formulário.
5. **`isDefault` do cartão nunca é lido.** O checkbox em Configurações diz "selecionado
   por padrão no form de transação", mas `TransactionForm` inicia com `cardId: ''` e
   não consulta `card.isDefault`. Ou o form passa a respeitar a flag, ou o texto do
   checkbox deve mudar.
6. **`CategoryBreakdown` mistura receitas e despesas no mesmo total**, porque agrupa por
   `t.category ?? t.cardId` sem filtrar por tipo. A barra "Por categoria" pode mostrar
   uma categoria de despesa dominada por receitas. O filtro por tipo na barra resolveria.
7. **Recorrência sem teto na regra pura.** `expandRecurrence` aceita
   `installments = 10_000`; quem limita a 240 é o Zod e o DTO. Uma chamada interna sem
   DTO geraria 10 mil transações.
8. **Sem paginação.** O relatório devolve e a tabela renderiza o mês inteiro filtrado.
   Suficiente para uso pessoal, não para dezenas de milhares de lançamentos.
9. **Guard de auth só no client.** Sem `middleware.ts` e sem `GET /auth/me` no boot: a
   segurança real é a API, mas há um flash de página vazia em `/` e em `/dashboard` sem
   token. Uma checagem no servidor eliminaria o flash.
10. **Token sem refresh.** JWT de 7 dias e, expirado, o usuário volta para o login sem
    nenhuma renovação silenciosa.
11. **`havan.png` é reserva morta.** O arquivo está versionado e é copiado no build,
    mas `readBrandLogo` só resolve `nubank` e `itaucard` — `GET /cards/logos/havan`
    responde 404. Ou o mapper passa a incluir `havan`, ou o arquivo sai do repositório.
12. **Cache do `useMonthlyReport` com params embutido na key.** Combinações diferentes
    de filtro viram entradas distintas do cache. Em uso normal (poucos filtros, sem
    alternância rápida) é o comportamento desejado, mas alternar filtro/tipo/categoria
    rapidamente acumula entradas até o `gcTime` padrão expirar.
13. **Peer dependencies desatualizadas.** `pnpm install` reporta conflitos de peer entre
    `eslint@10` e plugins do `eslint-config-next` (que esperam `^9`), e entre
    `ts-jest@29` e `@babel/core@8`. São avisos, não erros — build, lint, typecheck e
    test passam. Vale um upgrade coordenado de `eslint-config-next` / `ts-jest`.
14. **Migrações pendentes localmente.** `prisma migrate status` acusa
    `20200101000000_baseline` e `20260927000000_enable_rls` como não aplicadas no banco
    de desenvolvimento. A `baseline` é um placeholder para bancos já existentes
    (resolva com `prisma migrate resolve --applied 20200101000000_baseline`); a da RLS
    pode ser aplicada com `pnpm db:migrate` quando você quiser habilitar a camada 2 de
    isolamento.
