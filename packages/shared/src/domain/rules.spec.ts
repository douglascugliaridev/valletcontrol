import { describe, expect, it } from 'vitest';
import { CardBrand, Category, PaymentMethod, TransactionType } from '../index';
import {
  DomainValidationError,
  validateTransactionInput,
  validateCardPaymentConsistency,
  calculateSummary,
} from './rules';

const validBase = {
  description: 'Aluguel',
  amountCents: 100_000,
  type: TransactionType.EXPENSE,
  category: Category.FIXED_EXPENSES,
  paymentMethod: null,
  dueDate: null,
  month: 9 as const,
  year: 2026,
};

const expectCode = (fn: () => void, code: string) => {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(DomainValidationError);
    expect((err as DomainValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Esperava erro ${code}, mas não houve erro.`);
};

describe('validateTransactionInput (regra payment_method corrigida)', () => {
  it('aceita despesa sem paymentMethod', () => {
    expect(() => validateTransactionInput(validBase)).not.toThrow();
  });

  it('pagamento é OBRIGATÓRIO para devedores', () => {
    const debtor = {
      ...validBase,
      type: TransactionType.DEBTOR,
      category: Category.DEBTORS,
      paymentMethod: null,
    };
    expectCode(() => validateTransactionInput(debtor), 'PAYMENT_METHOD_REQUIRED');
  });

  it('pagamento é PROIBIDO para despesa (antes aceito sem validação server-side)', () => {
    const expenseWithMethod = {
      ...validBase,
      paymentMethod: PaymentMethod.NUBANK,
    };
    expectCode(() => validateTransactionInput(expenseWithMethod), 'PAYMENT_METHOD_NOT_ALLOWED');
  });

  it('aceita devedor com paymentMethod válido', () => {
    const debtor = {
      ...validBase,
      type: TransactionType.DEBTOR,
      category: Category.DEBTORS,
      paymentMethod: PaymentMethod.ITAUCARD,
    };
    expect(() => validateTransactionInput(debtor)).not.toThrow();
  });

  it('rejeita método de pagamento em categoria não-devedor', () => {
    const expenseWithMethod = {
      ...validBase,
      type: TransactionType.EXPENSE,
      category: Category.FIXED_EXPENSES,
      paymentMethod: PaymentMethod.NUBANK,
    };
    expectCode(() => validateTransactionInput(expenseWithMethod), 'PAYMENT_METHOD_NOT_ALLOWED');
  });

  it('rejeita tipo incompatível com categoria', () => {
    const mismatched = {
      ...validBase,
      type: TransactionType.DEBTOR,
      category: Category.INCOME,
      paymentMethod: null,
    };
    expectCode(() => validateTransactionInput(mismatched), 'CATEGORY_TYPE_MISMATCH');
  });

  it('rejeita mês fora de 1-12', () => {
    expectCode(
      () => validateTransactionInput({ ...validBase, month: 13 as never }),
      'INVALID_MONTH',
    );
  });

  it('rejeita valor não positivo', () => {
    expectCode(() => validateTransactionInput({ ...validBase, amountCents: 0 }), 'INVALID_AMOUNT');
  });

  it('aceita despesa com cartão como bucket (categoria nula)', () => {
    expect(() =>
      validateTransactionInput({ ...validBase, category: null, cardId: 'card-1' }),
    ).not.toThrow();
  });

  it('rejeita despesa sem categoria e sem cartão', () => {
    expectCode(
      () => validateTransactionInput({ ...validBase, category: null }),
      'CATEGORY_REQUIRED',
    );
  });

  it('rejeita despesa com categoria e cartão simultaneamente', () => {
    expectCode(
      () => validateTransactionInput({ ...validBase, cardId: 'card-1' }),
      'CATEGORY_CARD_CONFLICT',
    );
  });

  it('rejeita categoria nula em transação de receita', () => {
    expectCode(
      () =>
        validateTransactionInput({
          ...validBase,
          type: TransactionType.INCOME,
          category: null,
        }),
      'CATEGORY_REQUIRED',
    );
  });
});

describe('calculateSummary', () => {
  it('calcula receitas, despesas, saldo e devedores', () => {
    const summary = calculateSummary([
      {
        ...validBase,
        type: TransactionType.INCOME,
        category: Category.INCOME,
        amountCents: 500_000,
        id: 'a',
        ownerId: 'u',
        isPaid: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        ...validBase,
        amountCents: 200_000,
        id: 'b',
        ownerId: 'u',
        isPaid: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        ...validBase,
        type: TransactionType.INCOME,
        category: Category.INCOME,
        amountCents: 50_000,
        id: 'c',
        ownerId: 'u',
        isPaid: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        ...validBase,
        type: TransactionType.DEBTOR,
        category: Category.DEBTORS,
        amountCents: 30_000,
        paymentMethod: PaymentMethod.NUBANK,
        id: 'd',
        ownerId: 'u',
        isPaid: false,
        createdAt: '',
        updatedAt: '',
      },
      {
        ...validBase,
        type: TransactionType.DEBTOR,
        category: Category.DEBTORS,
        amountCents: 70_000,
        paymentMethod: PaymentMethod.NUBANK,
        id: 'e',
        ownerId: 'u',
        isPaid: true,
        createdAt: '',
        updatedAt: '',
      },
    ]);

    expect(summary.totalIncomeCents).toBe(550_000);
    expect(summary.totalExpenseCents).toBe(200_000);
    expect(summary.balanceCents).toBe(350_000);
    expect(summary.totalDebtorsCents).toBe(100_000);
    expect(summary.paidDebtorsCents).toBe(70_000);
    expect(summary.unpaidDebtorsCents).toBe(30_000);
  });
});

describe('validateCardPaymentConsistency', () => {
  it('aceita método correspondente à bandeira do cartão', () => {
    expect(() =>
      validateCardPaymentConsistency({
        paymentMethod: PaymentMethod.NUBANK,
        cardBrand: CardBrand.NUBANK,
      }),
    ).not.toThrow();
    expect(() =>
      validateCardPaymentConsistency({
        paymentMethod: PaymentMethod.ITAUCARD,
        cardBrand: CardBrand.ITAUCARD,
      }),
    ).not.toThrow();
  });

  it('rejeita método incompatível com a bandeira', () => {
    expectCode(
      () =>
        validateCardPaymentConsistency({
          paymentMethod: PaymentMethod.NUBANK,
          cardBrand: CardBrand.ITAUCARD,
        }),
      'CARD_METHOD_MISMATCH',
    );
    expectCode(
      () =>
        validateCardPaymentConsistency({
          paymentMethod: PaymentMethod.ITAUCARD,
          cardBrand: CardBrand.NUBANK,
        }),
      'CARD_METHOD_MISMATCH',
    );
  });

  it('rejeita bandeira "outros" (sem método correspondente)', () => {
    expectCode(
      () =>
        validateCardPaymentConsistency({
          paymentMethod: PaymentMethod.NUBANK,
          cardBrand: CardBrand.OTHERS,
        }),
      'CARD_METHOD_MISMATCH',
    );
  });

  it('ignora transações sem paymentMethod (cardId apenas como etiqueta)', () => {
    expect(() =>
      validateCardPaymentConsistency({ paymentMethod: null, cardBrand: CardBrand.ITAUCARD }),
    ).not.toThrow();
  });

  it('ignora transações sem cartão vinculado', () => {
    expect(() =>
      validateCardPaymentConsistency({ paymentMethod: PaymentMethod.NUBANK, cardBrand: null }),
    ).not.toThrow();
  });
});
