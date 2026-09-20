import type { Transaction, TransactionInput, TransactionQuery } from '@valletcontrol/shared';
import { Category, PaymentMethod, TransactionType } from '@valletcontrol/shared';
import { TransactionRepositoryPort } from '../modules/transactions/application/ports/transaction-repository.port';

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    ownerId: 'user-1',
    description: 'Aluguel',
    amountCents: 100_000,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    paymentMethod: null,
    dueDate: '2026-09-10',
    month: 9,
    year: 2026,
    isPaid: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeValidInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    description: 'Aluguel',
    amountCents: 100_000,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    paymentMethod: null,
    cardId: null,
    dueDate: '2026-09-10',
    month: 9,
    year: 2026,
    isPaid: false,
    ...overrides,
  };
}

export function makeDebtorInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return makeValidInput({
    type: TransactionType.DEBTOR,
    category: Category.DEBTORS,
    paymentMethod: PaymentMethod.NUBANK,
    ...overrides,
  });
}

/** Mock tipado do port de repositório de transações (subclasses concretas p/ typecheck). */
class MockTransactionRepository extends TransactionRepositoryPort {
  findAllByOwner = jest.fn();
  findByIdAndOwner = jest.fn();
  createMany = jest.fn();
  updateByIdAndOwner = jest.fn();
  deleteByIdAndOwner = jest.fn();
  updateManyByInstallmentGroupAndOwner = jest.fn();
  deleteManyByInstallmentGroupAndOwner = jest.fn();
}

export function mockTransactionRepository(): MockTransactionRepository {
  return new MockTransactionRepository();
}

export const userQuery: TransactionQuery = { month: 9, year: 2026 };
