/**
 * Domínio de finanças pessoais — enums e constantes puras.
 * Sem dependências externas: seguro para usar na API, Web e Mobile.
 */

/** Natureza financeira da transação. */
export const TransactionType = {
  INCOME: 'receita',
  EXPENSE: 'despesa',
  DEBTOR: 'devedor',
} as const;

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TRANSACTION_TYPES: readonly TransactionType[] = Object.values(TransactionType);

/**
 * Categorias visuais do dashboard. Cada categoria mapeia para
 * um tipo financeiro padrão (ver CATEGORY_TO_TYPE).
 * Despesas podem usar categoria OU cartão (bucket via cardId) —
 * quando o cartão é o bucket, `category` fica nulo.
 */
export const Category = {
  FIXED_EXPENSES: 'contas_fixas',
  OTHERS: 'outros',
  INCOME: 'receita',
  DEBTORS: 'devedores',
} as const;

export type Category = (typeof Category)[keyof typeof Category];

export const CATEGORIES: readonly Category[] = Object.values(Category);

/** Forma de pagamento — aplicável apenas a transações do tipo DEVEDOR. */
export const PaymentMethod = {
  NUBANK: 'nubank',
  ITAUCARD: 'itaucard',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PAYMENT_METHODS: readonly PaymentMethod[] = Object.values(PaymentMethod);

/** Categoria padrão de cada tipo de transação. */
export const CATEGORY_TO_TYPE: Readonly<Record<Category, TransactionType>> = {
  [Category.FIXED_EXPENSES]: TransactionType.EXPENSE,
  [Category.OTHERS]: TransactionType.EXPENSE,
  [Category.INCOME]: TransactionType.INCOME,
  [Category.DEBTORS]: TransactionType.DEBTOR,
};

/** Tipos que representam dinheiro recebido (para cálculo de saldo). */
export const INCOME_TYPES: readonly TransactionType[] = [TransactionType.INCOME];

/** Tipos que representam dinheiro gasto (para cálculo de saldo). */
export const EXPENSE_TYPES: readonly TransactionType[] = [TransactionType.EXPENSE];

/** Tipos que representam valores a receber de terceiros. */
export const DEBTOR_TYPES: readonly TransactionType[] = [TransactionType.DEBTOR];

/** Nome legível em pt-BR para cada tipo. */
export const TRANSACTION_TYPE_LABELS: Readonly<Record<TransactionType, string>> = {
  [TransactionType.INCOME]: 'Receita',
  [TransactionType.EXPENSE]: 'Despesa',
  [TransactionType.DEBTOR]: 'Devedor(a)',
};

/** Nome legível em pt-BR para cada categoria. */
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  [Category.FIXED_EXPENSES]: 'Contas Fixas',
  [Category.OTHERS]: 'Outros',
  [Category.INCOME]: 'Receitas',
  [Category.DEBTORS]: 'Devedores',
};

/** Mês é 1-12 (1 = janeiro). */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const MONTH_NAMES_SHORT: readonly string[] = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export const MONTH_NAMES_LONG: readonly string[] = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
