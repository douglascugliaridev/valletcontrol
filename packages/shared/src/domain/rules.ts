import { cardToPaymentMethod } from './card';
import type { CardBrand } from './card';
import { Category, CATEGORY_TO_TYPE, PaymentMethod, TransactionType } from './enums';
import type { Transaction, TransactionInput, TransactionSummary } from './transaction';

/** Erro de domínio com código estável para a API traduzir. */
export type DomainErrorCode =
  | 'INVALID_MONTH'
  | 'INVALID_YEAR'
  | 'INVALID_AMOUNT'
  | 'PAYMENT_METHOD_REQUIRED'
  | 'PAYMENT_METHOD_NOT_ALLOWED'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'CATEGORY_REQUIRED'
  | 'CATEGORY_CARD_CONFLICT'
  | 'MONTH_YEAR_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_IN_USE'
  | 'CARD_METHOD_MISMATCH';

export class DomainValidationError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainValidationError';
    this.code = code;
  }
}

const isMonth = (value: number): value is 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 =>
  Number.isInteger(value) && value >= 1 && value <= 12;

/**
 * Regra 1 (corrigida): validação de domínio da transação.
 * - paymentMethod é OBRIGATÓRIO se, e somente se, type === DEVEDOR.
 * - paymentMethod é PROIBIDO para os demais tipos.
 * - tipo inconsistente com a categoria é rejeitado.
 * - bucket da transação: despesa pertence a UMA categoria fixa
 *   (contas_fixas/outros) OU a um cartão via cardId (category nula).
 *   Categoria nula fora de despesa com cartão é rejeitada e o conflito
 *   "categoria + cartão" em despesa também.
 */
export function validateTransactionInput(input: TransactionInput): void {
  if (!isMonth(input.month)) {
    throw new DomainValidationError(
      'INVALID_MONTH',
      `Mês inválido: ${input.month}. Esperado 1-12.`,
    );
  }

  if (!Number.isInteger(input.year) || input.year < 1900 || input.year > 2200) {
    throw new DomainValidationError('INVALID_YEAR', `Ano inválido: ${input.year}.`);
  }

  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainValidationError(
      'INVALID_AMOUNT',
      `Valor inválido: ${input.amountCents}. Deve ser um inteiro de centavos positivo.`,
    );
  }

  if (input.category === null) {
    if (input.type !== TransactionType.EXPENSE || !input.cardId) {
      throw new DomainValidationError(
        'CATEGORY_REQUIRED',
        'Toda transação exige uma categoria (ou um cartão, para despesas).',
      );
    }
  } else {
    const expectedType = CATEGORY_TO_TYPE[input.category];
    if (input.type !== expectedType) {
      throw new DomainValidationError(
        'CATEGORY_TYPE_MISMATCH',
        `Tipo "${input.type}" incompatível com a categoria "${input.category}" (esperado "${expectedType}").`,
      );
    }
  }

  if (input.type === TransactionType.EXPENSE && input.category !== null && input.cardId) {
    throw new DomainValidationError(
      'CATEGORY_CARD_CONFLICT',
      'Uma despesa deve pertencer a uma categoria fixa OU a um cartão, não a ambos.',
    );
  }

  if (input.type === TransactionType.DEBTOR && !input.paymentMethod) {
    throw new DomainValidationError(
      'PAYMENT_METHOD_REQUIRED',
      'Transações do tipo "devedor" exigem um método de pagamento (cartão).',
    );
  }

  if (input.type !== TransactionType.DEBTOR && input.paymentMethod) {
    throw new DomainValidationError(
      'PAYMENT_METHOD_NOT_ALLOWED',
      `Método de pagamento "${input.paymentMethod}" só é permitido para transações do tipo "devedor".`,
    );
  }

  if (
    input.paymentMethod &&
    input.category !== null &&
    CATEGORY_TO_TYPE[input.category] !== TransactionType.DEBTOR
  ) {
    throw new DomainValidationError(
      'PAYMENT_METHOD_NOT_ALLOWED',
      `Categoria "${input.category}" não permite método de pagamento. Use a categoria "devedores".`,
    );
  }
}

/**
 * Regra de consistência cartão × método de pagamento.
 * Aplicável quando o usuário referencia um cartão (`cardId`) em uma transação
 * de devedor: o `paymentMethod` deve corresponder à bandeira do cartão.
 * - Sem `paymentMethod` (despesa/receita com cardId apenas como etiqueta) → ok.
 * - Bandeira `outros` (OTHERS) não mapeia para nenhum método → rejeitado.
 */
export function validateCardPaymentConsistency(input: {
  paymentMethod: PaymentMethod | null;
  cardBrand?: CardBrand | null;
}): void {
  const { paymentMethod, cardBrand } = input;
  if (!paymentMethod || !cardBrand) {
    return;
  }
  const expected = cardToPaymentMethod(cardBrand);
  if (expected !== paymentMethod) {
    throw new DomainValidationError(
      'CARD_METHOD_MISMATCH',
      `Método de pagamento "${paymentMethod}" incompatível com a bandeira do cartão "${cardBrand}" (esperado "${expected ?? 'nenhum'}").`,
    );
  }
}

/**
 * Resumo mensal (receitas, despesas, saldo, devedores).
 * Função pura — não depende de banco ou framework.
 */
export function calculateSummary(transactions: readonly Transaction[]): TransactionSummary {
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  let totalDebtorsCents = 0;
  let paidDebtorsCents = 0;
  let unpaidDebtorsCents = 0;

  for (const tx of transactions) {
    if (tx.type === TransactionType.INCOME) {
      totalIncomeCents += tx.amountCents;
      continue;
    }
    if (tx.type === TransactionType.EXPENSE) {
      totalExpenseCents += tx.amountCents;
      continue;
    }
    if (tx.type === TransactionType.DEBTOR) {
      totalDebtorsCents += tx.amountCents;
      if (tx.isPaid) {
        paidDebtorsCents += tx.amountCents;
      } else {
        unpaidDebtorsCents += tx.amountCents;
      }
      continue;
    }
    const never = tx.type satisfies never;
    throw new Error(`Tipo de transação desconhecido: ${String(never)}`);
  }

  return {
    totalIncomeCents,
    totalExpenseCents,
    balanceCents: totalIncomeCents - totalExpenseCents,
    totalDebtorsCents,
    paidDebtorsCents,
    unpaidDebtorsCents,
  };
}

/** Monta a descrição com parcela incremental: `1/12 Salário` */
export function buildInstallmentDescription(
  baseDescription: string,
  installment: number,
  total: number,
): string {
  return `${installment}/${total} ${baseDescription}`.trim();
}

export { Category, PaymentMethod };
