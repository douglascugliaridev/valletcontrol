import { Category, PaymentMethod, TransactionType } from '@valletcontrol/shared';
import {
  makeTransaction,
  mockTransactionRepository,
  userQuery,
} from '../../../../test/transaction.fixtures';
import { ListMonthlyReportUseCase } from './list-monthly-report.use-case';

const ownerId = 'user-1';

describe('ListMonthlyReportUseCase', () => {
  it('lista transações escopadas ao dono (RLS) e calcula o resumo', async () => {
    const repo = mockTransactionRepository();
    repo.findAllByOwner.mockResolvedValue([
      makeTransaction({
        id: 'a',
        type: TransactionType.INCOME,
        category: Category.INCOME,
        amountCents: 500_000,
      }),
      makeTransaction({ id: 'b', amountCents: 200_000 }),
      makeTransaction({
        id: 'c',
        type: TransactionType.DEBTOR,
        category: Category.DEBTORS,
        paymentMethod: PaymentMethod.NUBANK,
        amountCents: 120_000,
      }),
    ]);
    const useCase = new ListMonthlyReportUseCase(repo);

    const report = await useCase.execute({ ownerId, query: userQuery });

    expect(repo.findAllByOwner).toHaveBeenCalledWith(ownerId, userQuery);
    expect(report.summary).toEqual({
      totalIncomeCents: 500_000,
      totalExpenseCents: 200_000,
      balanceCents: 300_000,
      totalDebtorsCents: 120_000,
      paidDebtorsCents: 0,
      unpaidDebtorsCents: 120_000,
    });
  });

  it('propaga filtros avançados para o repositório', async () => {
    const repo = mockTransactionRepository();
    repo.findAllByOwner.mockResolvedValue([]);
    const useCase = new ListMonthlyReportUseCase(repo);

    await useCase.execute({
      ownerId,
      query: { ...userQuery, search: 'mercado', type: TransactionType.EXPENSE, isPaid: false },
    });

    expect(repo.findAllByOwner).toHaveBeenCalledWith(ownerId, {
      ...userQuery,
      search: 'mercado',
      type: TransactionType.EXPENSE,
      isPaid: false,
    });
  });

  it('calcula saldo negativo quando despesas superam receitas', async () => {
    const repo = mockTransactionRepository();
    repo.findAllByOwner.mockResolvedValue([
      makeTransaction({
        id: 'a',
        type: TransactionType.INCOME,
        category: Category.INCOME,
        amountCents: 100_000,
      }),
      makeTransaction({ id: 'b', amountCents: 300_000 }),
    ]);
    const useCase = new ListMonthlyReportUseCase(repo);

    const report = await useCase.execute({ ownerId, query: userQuery });
    expect(report.summary.balanceCents).toBe(-200_000);
  });
});
