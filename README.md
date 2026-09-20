# ValletControl

Aplicação de controle financeiro pessoal (receitas, despesas e devedores) com dashboard mensal, parcelas, cartões e regras recorrentes. Acessível pela rede local (celular e desktop).

## Stack

- **Web**: Next.js (App Router) + React 19 + TanStack Query v5 + Tailwind v4, tema claro/escuro automático via next-themes.
- **API**: NestJS (Express) + Prisma 7 + PostgreSQL 16, autenticação JWT.
- **Domínio compartilhado** (`packages/shared`): enums, labels pt-BR, regras de validação puras, recorrência e cálculo do resumo — usados pela API e também validados no front (zod).
- **Isolamento por usuário**: todos os repositórios da API recebem `ownerId` a partir do token JWT; cada usuário só enxerga os próprios dados.

Requisitos: Node >= 22.12, pnpm >= 10 (projeto usa `packageManager: pnpm@10.26.0`).

## Estrutura do monorepo

```
apps/
  api/     NestJS (módulos auth, cards, transactions, recurring-rules, health)
  web/     Next.js (páginas login, register, dashboard, settings)
packages/
  shared/  domínio (enums, labels, rules, recurrence, money) + contratos de API + schemas zod
  config/  tsconfig/eslint/prettier compartilhados
prisma/    (apps/api/prisma) schema, migrações e seed
docker-compose.yml  Postgres 16 em localhost:5433
```

A API usa **arquitetura hexagonal**: controller → use case → repositório Prisma. Endpoints vivem em `apps/api/src/modules/*`; regras de negócio puras em `packages/shared/src/domain`.

## Funcionalidades

### Autenticação
- Registro de conta (nome, e-mail e senha) e login — `POST /auth/register` e `POST /auth/login`.
- Sessão via JWT (`Bearer`), token de 7 dias, armazenado no `localStorage` (`valletcontrol.token`).
- `GET /auth/me` devolve o usuário autenticado.
- Guard no front é client-side (redireciona para `/login` sem token); na API exige Bearer em tudo, exceto `@Public()` (register, login, health).

### Dashboard (`/dashboard`)
- **Resumo mensal**: Receitas, Despesas, Saldo (vermelho se negativo) e "A receber" com detalhe `pago · pendente`.
- **Seletor de mês**: navegação com virada de ano automática (padrão: mês atual).
- **Tabela de transações**: toggle marcar como pago (linha fica `line-through`), badges de tipo/categoria/cartão, vencimento, método, editar e excluir.
- **Filtros**: busca por descrição (debounce 350ms), tipo, categoria (dependente do tipo) e pago/pendente, com "Limpar".
- **Decomposição por categoria/cartão**: barras com % do total e logo do cartão; bucket de cartão quando `category` é nula.
- Erros amigáveis: falha de rede sugere verificar se o dispositivo está na mesma rede e o servidor rodando.

### Transações
- Criar **receita**, **despesa** ou **devedor(a)** com: descrição, valor, mês/ano, vencimento (`dueDate`) opcional, checkbox "já pago".
- **Parcelas** (`installments`, form limita a 12) com **iniciar na parcela N** (`startFrom`); o botão mostra quantos lançamentos serão criados.
- Despesa com "categoria **ou** cartão" (nunca ambos, nunca nenhum).
- Devedor exige cartão + método de pagamento.
- Editar e excluir com modal que pergunta o escopo (ver "Parcelas e grupos").
- Marcar pago/pendente com um clique.

### Parcelas e grupos
- Lançamento com mais de 1 parcela gera N transações com `installmentGroupId` comum e descrição serializada `1/12 Celular`, `2/12 Celular`, etc.
- **Excluir**: modal pergunta "Apenas esta parcela" ou "Todas as parcelas" (`DELETE ?scope=one|series`).
- **Editar**: seletor "Aplicar alterações a: Apenas esta parcela / Todas as parcelas" (`applyToAll`). Campos compartilhados (descrição, valor, tipo, categoria, cartão, método, vencimento) são propagados; **mês, ano e status de pagamento sempre continuam individuais**.
- Parcelas existentes no padrão `i/N` receberam grupo retroativamente (backfill: mesmo dono + descrição sem prefixo + mesmo valor + tipo, com 2+ lançamentos).

### Regras recorrentes (Configurações)
- CRUD de regras (descrição, valor, tipo receita/despesa, categoria, mês/ano inicial, ativa/inativa).
- Regra **ativa** entra no relatório mensal a partir do mês/ano inicial — como linha sintética **somente no resumo** (não vira linha clicável).
- Idempotência: se já existir transação marcada por `recurringRuleId` no mesmo mês/ano, a regra não é reinserida.
- Alterar regras também invalida o cache de transações.

### Cartões (Configurações)
- CRUD de cartões: nome, bandeira (Nubank/Itaucard/Outros), últimos 4 dígitos, cor, logo (upload opcional), cartão padrão.
- **Upload de logo**: PNG/JPG/WebP até 2 MB (`POST /cards/:id/logo`); arquivos servidos em `/api/uploads/*`.
- **Logo automática**: ao criar cartão Nubank/Itaucard, a logo oficial é copiada automaticamente.
- Exibição: círculo com a logo ou com a cor do cartão; etiqueta `Meu Nubank •• 1234`; badge "Padrão".
- Ao excluir cartão, as transações vinculadas perdem o cartão (FK `ON DELETE SET NULL`).

### Tema e responsividade
- Dark mode automático (sistema) via next-themes, sobreposição por classe.
- Layout responsivo: cards empilham no mobile; modal vira bottom-sheet.
- Dev acessível pela LAN (`http://192.168.1.10:3000`) via `allowedDevOrigins` + rewrite de `/api/uploads`.

## Endpoints da API

Prefixo global `/api`, autenticação Bearer (exceto os marcados `@Public()`).

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria conta e retorna `{ user, tokens }` (`@Public`) |
| POST | `/api/auth/login` | Autentica e retorna `{ user, tokens }` (`@Public`) |
| GET | `/api/auth/me` | Usuário autenticado |

### Transactions
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/transactions/monthly?month&year&search&type&category&isPaid` | Relatório mensal + `summary` (padrões: mês/ano atuais) |
| POST | `/api/transactions` | Cria 1 lançamento ou N parcelas (`recurrence: { installments, startFrom? }`) |
| PATCH | `/api/transactions/:id` | Edição parcial; `applyToAll: true` propaga na série |
| DELETE | `/api/transactions/:id?scope=one\|series` | Exclui 1 ou a série inteira (padrão `one`) |

### Cards
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/cards` | Cria cartão |
| GET | `/api/cards` | Lista (padrão primeiro, depois por nome) |
| PATCH | `/api/cards/:id` | Atualiza campos parciais |
| POST | `/api/cards/:id/logo` | Upload de logo (`multipart/form-data`, campo `file`) |
| DELETE | `/api/cards/:id` | Remove (204) |

### Recurring rules
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/recurring-rules` | Cria regra recorrente |
| GET | `/api/recurring-rules` | Lista (ativas primeiro) |
| PATCH | `/api/recurring-rules/:id` | Edita descrição/valor/tipo/categoria/isActive |
| DELETE | `/api/recurring-rules/:id` | Remove (204) |

### Health
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | `{ status: 'ok', timestamp }` (`@Public`) |

### Erros
- Regra de domínio violada → **422** com `domainCode` (ex.: `PAYMENT_METHOD_REQUIRED`).
- Não encontrado → **404**; e-mail duplicado → **409**; credenciais inválidas → **401**; validação de DTO → **400** com lista de mensagens; erro inesperado → **500**.
- Login usa mensagem única `'Email ou senha inválidos.'` para e-mail inexistente e senha errada (anti-enumeração).

## Regras de negócio

Definidas em `packages/shared/src/domain/rules.ts` (`validateTransactionInput`) e espelhadas no front (`schemas.ts` zod + `TransactionForm`).

1. **Mês e ano**: mês inteiro 1–12; ano inteiro (API/DTO: 2000–2200) — `INVALID_MONTH`/`INVALID_YEAR`.
2. **Valor**: `amountCents` inteiro positivo e seguro (safe integer) — `INVALID_AMOUNT`.
3. **Categoria nula** só é permitida em **despesa com cartão** — `CATEGORY_REQUIRED`.
4. **Tipo × categoria**: a categoria precisa combinar com o tipo (`contas_fixas`/`outros` → despesa; `receita` → receita; `devedores` → devedor) — `CATEGORY_TYPE_MISMATCH`.
5. **Bucket de despesa**: despesa com categoria **e** cartão simultaneamente é proibida — `CATEGORY_CARD_CONFLICT`.
6. **Devedores exigem `paymentMethod`** (`nubank`/`itaucard`) — `PAYMENT_METHOD_REQUIRED`; método é **proibido** nos demais tipos (inclusive categoria de despesa com método) — `PAYMENT_METHOD_NOT_ALLOWED`.
7. **Consistência cartão × método**: se houver `cardBrand` e `paymentMethod` juntos, a bandeira deve mapear para o método (`nubank → nubank`, `itaucard → itaucard`; bandeira `outros` não mapeia) — `CARD_METHOD_MISMATCH`. Sem os dois juntos, `cardId` é apenas etiqueta.
8. **Recorrência**: `installments` 1–240; `startFrom` default 1 e ≤ `installments` (no form web, máx. 12 parcelas).
9. **Série de parcelas**: mesmo `installmentGroupId`; editar "todas" propaga apenas `description`, `amountCents`, `type`, `category`, `paymentMethod`, `cardId`, `dueDate` — **nunca** `month`, `year` ou `isPaid`.
10. **Regras recorrentes**: ativas e com `mês/ano ≥ início` entram no resumo mensal como linha sintética (id `{ruleId}:{month}:{year}`, não paga, sem vencimento), desde que não exista transação real marcada por `recurringRuleId` no mesmo mês/ano (`shouldMaterializeRule` + `coveredByRule`).
11. **Resumo mensal** (`calculateSummary`): `receitas − despesas = saldo`; devedores somados à parte em `total`, com `paid` e `unpaid` separados.
12. **Autenticação**: senha mínima 8, com letras e números; hash scrypt nativo (salt 16 bytes, digest 64 bytes, OWASP N=2^14, r=8, p=1); e-mail normalizado (`trim().toLowerCase()`) e único — `EMAIL_ALREADY_IN_USE`.

### Categorias e tipos

| Tipo | Categorias | Label |
|---|---|---|
| `receita` | `receita` | Receita |
| `despesa` | `contas_fixas`, `outros` (ou cartão) | Contas Fixas / Outros |
| `devedor` | `devedores` | Devedores |

## Banco de dados

PostgreSQL 16 via Docker (`docker-compose.yml`, host `localhost:5433`). Prisma 7 com driver adapter; client gerado em `apps/api/src/generated/prisma`.

- **Models**: `users`, `transactions`, `cards`, `recurring_rules` (enums `TransactionType`, `Category`, `PaymentMethod`, `CardBrand`).
- **Índices**: `transactions[ownerId, year, month]`, `transactions[ownerId, dueDate]`, `transactions[installmentGroupId]`, além de índices de e-mail, cartão e regra por dono.
- **FKs**: `transactions.cardId` / `transactions.recurringRuleId` → `ON DELETE SET NULL`; `cards.ownerId` / `recurring_rules.ownerId` → `ON DELETE CASCADE`.
- `dueDate` é `DATE` no Postgres, exposto como ISO `yyyy-mm-dd`.
- **Migrações** (`apps/api/prisma/migrations/`):
  - `20260919165908_init` — usuários e transações;
  - `20260919213035_add_cards_recurring_rules` — cartões, regras recorrentes, `cardId`/`recurringRuleId`;
  - `20260919223000_despesa_bucket_cartao` — `category` nullable + backfill migrando despesas de cartão para `cardId`;
  - `20260920090000_add_card_logo_url` — coluna de logo;
  - `20260920162236_add_installment_group` — grupo de parcelas + backfill do padrão `i/N`.

## Configuração e ambiente

Variáveis principais no `.env` da raiz (exemplo em `.env.example`; o web usa `apps/web/.env.local`):

```env
NODE_ENV=development
API_PORT=3001
API_PREFIX=api
DATABASE_URL=postgresql://valletcontrol:valletcontrol@localhost:5433/valletcontrol?schema=public
JWT_SECRET=<segredo 32 bytes mínimo>
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.10:3000
NEXT_PUBLIC_API_URL=http://192.168.1.10:3001/api
```

- Web não lê o `.env` raiz: a URL da API vem de `NEXT_PUBLIC_API_URL` (em `apps/web/.env.local`; fallback `http://localhost:3001/api`).
- CORS libera apenas `ALLOWED_ORIGINS` (lista separada por vírgula).
- Uploads ficam em `apps/api/uploads/` (ou `UPLOADS_DIR`), servidos em `/api/uploads` com `Access-Control-Allow-Origin: *`.

## Como rodar

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir o Postgres
pnpm db:up

# 3. Apontar JWT_SECRET e NEXT_PUBLIC_API_URL no .env / apps/web/.env.local

# 4. Migrar e popular (cria usuário demo + cartões + transações)
pnpm db:migrate
pnpm db:seed

# 5. Subir web + API (dev com watch)
pnpm dev
```

Acesso: web em `http://localhost:3000` (ou pelo IP da LAN, ex. `http://192.168.1.10:3000`); API em `http://localhost:3001/api`; health em `GET /health`.

Usuário seed: `demo@valletcontrol.app` / `senha-segura-123`.

## Comandos úteis (raiz)

| Comando | Ação |
|---|---|
| `pnpm dev` / `pnpm dev:web` / `pnpm dev:api` | Sobe tudo ou apenas web/api |
| `pnpm build` | Build de todos os pacotes (turbo) |
| `pnpm test` | Testes da API (jest) e do shared (vitest) |
| `pnpm lint` / `pnpm typecheck` | Lint e typecheck de todos os pacotes |
| `pnpm db:up` / `pnpm db:down` | Sobe/desce o Postgres (docker compose) |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:studio` | Migra, popula e abre o Studio do Prisma |
| `pnpm clean` | Limpa artefatos de build |

## Testes

- **API** (`apps/api/src/**/*.spec.ts`, jest): **49 testes em 7 suítes** — autenticação (register/login), hasher scrypt, criação/edição/exclusão de transações (incl. séries e `applyToAll`), relatório mensal e DTO (`toTransactionUpdate`).
- **Shared** (`packages/shared/src/domain/rules.spec.ts`, vitest): **18 testes** das regras puras de validação.
- Web: sem suíte própria; `test` roda `tsc --noEmit`.

## Notas de implementação

- `toTransactionUpdate` (DTO) usa guardas por valor (`!== undefined`), nunca `in`, porque com `useDefineForClassFields` o class-transformer cria todos os campos do DTO como `undefined` — o uso de `in` zeraria `cardId`/`paymentMethod`/`dueDate` em PATCH parciais.
- Linhas sintéticas de regras recorrentes contam no resumo, mas não aparecem na tabela (quebrariam "marcar como pago" e a edição/exclusão real).
- `formatMonthYear` e labels de mês vivem no shared; formatadores pt-BR reais em `apps/web/lib/format.ts`.