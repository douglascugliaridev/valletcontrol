import { Category, TransactionType } from '@walletcontrol/shared';
import type { Month, RecurringRule, Transaction } from '@walletcontrol/shared';
import { DeleteRecurringRuleUseCase } from './delete-recurring-rule.use-case';
import type { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';
import type { TransactionRepositoryPort } from '../../../transactions/application/ports/transaction-repository.port';

const ownerId = 'user-1';

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    ownerId,
    description: 'Internet',
    amountCents: 11_990,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    startMonth: 10 as Month,
    startYear: 2026,
    monthsAhead: 4,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Meses do grupo com o estado de pagamento pedido. */
function rows(pagamentos: boolean[]): Transaction[] {
  return pagamentos.map((isPaid, i) => ({
    id: `t${i + 1}`,
    ownerId,
    description: 'Internet',
    amountCents: 11_990,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    paymentMethod: null,
    cardId: null,
    dueDate: null,
    month: (10 + i) as Month,
    year: 2026,
    isPaid,
    recurringRuleId: 'rule-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
}

function mocks(rowsMock: Transaction[], existing: RecurringRule | null) {
  return {
    rules: {
      findByIdAndOwner: jest.fn().mockResolvedValue(existing),
      deleteByIdAndOwner: jest.fn().mockResolvedValue(undefined),
    } as unknown as RecurringRuleRepositoryPort,
    transactions: {
      countTransactionsOfRule: jest.fn().mockResolvedValue(rowsMock.length),
      findFirstUnpaidByRecurringRule: jest
        .fn()
        .mockResolvedValue(rowsMock.find((r) => !r.isPaid) ?? null),
      deleteManyUnpaidByRecurringRuleFrom: jest
        .fn()
        .mockResolvedValue(rowsMock.filter((r) => !r.isPaid).length),
    } as unknown as TransactionRepositoryPort,
  };
}

describe('DeleteRecurringRuleUseCase — cancela a conta fixa', () => {
  it('remove os não pagos a partir do primeiro não pago', async () => {
    // nov e dez pagos; jan e fev previstos
    const rowsMock = rows([true, true, false, false]);
    const { rules, transactions } = mocks(rowsMock, makeRule());

    const result = await new DeleteRecurringRuleUseCase(rules, transactions).execute({
      ownerId,
      id: 'rule-1',
    });

    expect(result).toEqual({ deletedTransactions: 2, keptPaidTransactions: 2 });
    // meses: 10 e 11/2026 pagos, 12/2026 e 1/2027 não pagos.
    // O corte é o primeiro NÃO pago: 12/2026.
    expect((transactions.deleteManyUnpaidByRecurringRuleFrom as jest.Mock).mock.calls[0]).toEqual([
      'rule-1',
      ownerId,
      2026,
      12,
    ]);
  });

  it('preserva os pagos mesmo que venham DEPOIS de um não pago', async () => {
    // nov não pago, dez pago — o pago não pode ser destruído
    const rowsMock = rows([false, true, false]);
    const { rules, transactions } = mocks(rowsMock, makeRule());

    const result = await new DeleteRecurringRuleUseCase(rules, transactions).execute({
      ownerId,
      id: 'rule-1',
    });

    // 2 não pagos saem (nov e jan), o pago de dez fica
    expect(result.deletedTransactions).toBe(2);
    expect(result.keptPaidTransactions).toBe(1);
  });

  it('não apaga nada quando todos os meses já foram pagos', async () => {
    const rowsMock = rows([true, true, true]);
    const { rules, transactions } = mocks(rowsMock, makeRule());

    const result = await new DeleteRecurringRuleUseCase(rules, transactions).execute({
      ownerId,
      id: 'rule-1',
    });

    expect(result).toEqual({ deletedTransactions: 0, keptPaidTransactions: 3 });
    expect(transactions.deleteManyUnpaidByRecurringRuleFrom).not.toHaveBeenCalled();
    // a regra mesmo assim sai: o usuário pediu para cancelar
    expect(rules.deleteByIdAndOwner).toHaveBeenCalled();
  });

  it('remove a regra em qualquer caso, mesmo sem lançamentos', async () => {
    const { rules, transactions } = mocks([], makeRule({ monthsAhead: null }));

    const result = await new DeleteRecurringRuleUseCase(rules, transactions).execute({
      ownerId,
      id: 'rule-1',
    });

    expect(result).toEqual({ deletedTransactions: 0, keptPaidTransactions: 0 });
    expect(rules.deleteByIdAndOwner).toHaveBeenCalledWith('rule-1', ownerId);
  });

  it('404 amigável para conta fixa de outro dono', async () => {
    const { rules, transactions } = mocks([], null);

    await expect(
      new DeleteRecurringRuleUseCase(rules, transactions).execute({ ownerId, id: 'nao-existe' }),
    ).rejects.toThrow('Conta fixa não encontrada.');
    expect(rules.deleteByIdAndOwner).not.toHaveBeenCalled();
    expect(transactions.deleteManyUnpaidByRecurringRuleFrom).not.toHaveBeenCalled();
  });

  it('nunca apaga um lançamento pago, qualquer que seja o corte', async () => {
    const rowsMock = rows([true, true, false, false, false]);
    const { rules, transactions } = mocks(rowsMock, makeRule());

    await new DeleteRecurringRuleUseCase(rules, transactions).execute({
      ownerId,
      id: 'rule-1',
    });

    // meses: 10 e 11/2026 pagos; 12/2026, 1 e 2/2027 não pagos. Corte em 12/2026.
    expect(transactions.deleteManyUnpaidByRecurringRuleFrom).toHaveBeenCalledTimes(1);
    const args = (transactions.deleteManyUnpaidByRecurringRuleFrom as jest.Mock).mock.calls[0];
    expect(args).toEqual(['rule-1', ownerId, 2026, 12]);
  });
});
