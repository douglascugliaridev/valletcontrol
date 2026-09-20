import { Category, TransactionType } from '@valletcontrol/shared';
import type { TransactionInput } from '@valletcontrol/shared';
import { DomainValidationError } from '@valletcontrol/shared';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { CreateTransactionsUseCase } from './create-transactions.use-case';
import {
  makeDebtorInput,
  makeValidInput,
  mockTransactionRepository,
} from '../../../../test/transaction.fixtures';
import { makeCard, mockCardRepository } from '../../../../test/card.fixtures';

describe('CreateTransactionsUseCase', () => {
  it('cria uma transação validada, escopada ao ownerId', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const input = makeValidInput();
    repo.createMany.mockResolvedValue([
      { ...input, id: 'tx-1', ownerId: 'user-1', createdAt: '', updatedAt: '' },
    ]);
    const useCase = new CreateTransactionsUseCase(repo, cards);

    const result = await useCase.execute({ ownerId: 'user-1', input });

    expect(repo.createMany).toHaveBeenCalledWith('user-1', [input]);
    expect(result.transactions).toHaveLength(1);
  });

  it('expande recorrência e prefixa a descrição com parcela', async () => {
    const repo = mockTransactionRepository();
    const input = makeValidInput({ description: 'Assinatura', month: 11, year: 2026 });
    repo.createMany.mockImplementation(async (_ownerId: string, items: TransactionInput[]) =>
      items.map((t, index) => ({
        ...t,
        id: `tx-${index}`,
        ownerId: 'user-1',
        createdAt: '',
        updatedAt: '',
      })),
    );
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);

    const result = await useCase.execute({
      ownerId: 'user-1',
      input,
      recurrence: { installments: 4 },
    });

    const descriptions = result.transactions.map((t) => t.description);
    expect(descriptions).toEqual([
      '1/4 Assinatura',
      '2/4 Assinatura',
      '3/4 Assinatura',
      '4/4 Assinatura',
    ]);
    expect(result.transactions.map((t) => t.month)).toEqual([11, 12, 1, 2]);
    expect(result.transactions.map((t) => t.year)).toEqual([2026, 2026, 2027, 2027]);
  });

  it('expande recorrência a partir de uma parcela intermediária (startFrom)', async () => {
    const repo = mockTransactionRepository();
    const input = makeValidInput({ description: 'Curso', month: 11, year: 2026 });
    repo.createMany.mockImplementation(async (_ownerId: string, items: TransactionInput[]) =>
      items.map((t, index) => ({
        ...t,
        id: `tx-${index}`,
        ownerId: 'user-1',
        createdAt: '',
        updatedAt: '',
      })),
    );
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);

    const result = await useCase.execute({
      ownerId: 'user-1',
      input,
      recurrence: { installments: 12, startFrom: 4 },
    });

    const descriptions = result.transactions.map((t) => t.description);
    expect(descriptions).toEqual([
      '4/12 Curso',
      '5/12 Curso',
      '6/12 Curso',
      '7/12 Curso',
      '8/12 Curso',
      '9/12 Curso',
      '10/12 Curso',
      '11/12 Curso',
      '12/12 Curso',
    ]);
    expect(result.transactions.map((t) => t.month)).toEqual([11, 12, 1, 2, 3, 4, 5, 6, 7]);
    expect(result.transactions).toHaveLength(9);
  });

  it('recusa paymentMethod em despesa (validação server-side)', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);

    await expect(
      useCase.execute({
        ownerId: 'user-1',
        input: { ...makeValidInput(), paymentMethod: 'nubank' },
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);

    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('exige paymentMethod para devedores', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);

    const input = {
      ...makeDebtorInput(),
      paymentMethod: null as unknown as 'nubank',
    };

    await expect(useCase.execute({ ownerId: 'user-1', input })).rejects.toThrow(
      DomainValidationError,
    );
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('aceita devedor com paymentMethod válido', async () => {
    const repo = mockTransactionRepository();
    repo.createMany.mockResolvedValue([]);
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);

    await expect(
      useCase.execute({ ownerId: 'user-1', input: makeDebtorInput() }),
    ).resolves.toBeDefined();
  });

  it('rejeita mês inválido antes de persistir', async () => {
    const repo = mockTransactionRepository();
    const input = makeValidInput({ month: 13 as never });
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);

    await expect(useCase.execute({ ownerId: 'user-1', input })).rejects.toThrow(
      DomainValidationError,
    );
  });

  it('rejeita tipo incompatível com categoria', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);
    await expect(
      useCase.execute({
        ownerId: 'user-1',
        input: {
          ...makeValidInput(),
          type: TransactionType.INCOME,
          category: Category.FIXED_EXPENSES,
        },
      }),
    ).rejects.toMatchObject({ code: 'CATEGORY_TYPE_MISMATCH' });
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('rejeita devedor cujo método não corresponde à bandeira do cartão', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    cards.findByIdAndOwner.mockResolvedValue(makeCard({ id: 'card-1', brand: 'itaucard' }));
    const useCase = new CreateTransactionsUseCase(repo, cards);
    const input = makeDebtorInput({ cardId: 'card-1' });

    await expect(useCase.execute({ ownerId: 'user-1', input })).rejects.toMatchObject({
      code: 'CARD_METHOD_MISMATCH',
    });
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('aceita devedor cujo método confere com a bandeira do cartão', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    cards.findByIdAndOwner.mockResolvedValue(makeCard({ id: 'card-1', brand: 'nubank' }));
    repo.createMany.mockResolvedValue([]);
    const useCase = new CreateTransactionsUseCase(repo, cards);
    const input = makeDebtorInput({ cardId: 'card-1' });

    await expect(useCase.execute({ ownerId: 'user-1', input })).resolves.toBeDefined();
    expect(cards.findByIdAndOwner).toHaveBeenCalledWith('card-1', 'user-1');
    expect(repo.createMany).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({ cardId: 'card-1' }),
    ]);
  });

  it('rejeita cartão inexistente ou de outro dono', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    cards.findByIdAndOwner.mockResolvedValue(null);
    const useCase = new CreateTransactionsUseCase(repo, cards);
    const input = makeDebtorInput({ cardId: 'card-inexistente' });

    await expect(useCase.execute({ ownerId: 'user-1', input })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('aceita despesa com cartão como bucket (categoria nula)', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    cards.findByIdAndOwner.mockResolvedValue(makeCard({ id: 'card-1', brand: 'itaucard' }));
    repo.createMany.mockResolvedValue([]);
    const useCase = new CreateTransactionsUseCase(repo, cards);
    const input = makeValidInput({ cardId: 'card-1', category: null });

    await expect(useCase.execute({ ownerId: 'user-1', input })).resolves.toBeDefined();
  });

  it('rejeita despesa com categoria E cartão ao mesmo tempo', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    cards.findByIdAndOwner.mockResolvedValue(makeCard({ id: 'card-1', brand: 'nubank' }));
    const useCase = new CreateTransactionsUseCase(repo, cards);
    const input = makeValidInput({ cardId: 'card-1' });

    await expect(useCase.execute({ ownerId: 'user-1', input })).rejects.toMatchObject({
      code: 'CATEGORY_CARD_CONFLICT',
    });
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('rejeita despesa sem categoria e sem cartão', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const useCase = new CreateTransactionsUseCase(repo, cards);
    const input = makeValidInput({ category: null });

    await expect(useCase.execute({ ownerId: 'user-1', input })).rejects.toMatchObject({
      code: 'CATEGORY_REQUIRED',
    });
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('atribui um grupo compartilhado a todas as parcelas da recorrência', async () => {
    const repo = mockTransactionRepository();
    repo.createMany.mockImplementation(async (_ownerId: string, items: TransactionInput[]) =>
      items.map((t, index) => ({
        ...t,
        id: `tx-${index}`,
        ownerId: 'user-1',
        createdAt: '',
        updatedAt: '',
      })),
    );
    const useCase = new CreateTransactionsUseCase(repo, mockCardRepository());

    const result = await useCase.execute({
      ownerId: 'user-1',
      input: makeValidInput({ description: 'Celular' }),
      recurrence: { installments: 3 },
    });

    const groups = new Set(result.transactions.map((t) => t.installmentGroupId));
    expect(groups.size).toBe(1);
    const [groupId] = groups;
    expect(groupId).toBeTruthy();
    expect(repo.createMany).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([expect.objectContaining({ installmentGroupId: groupId })]),
    );
  });

  it('lançamento sem recorrência não recebe grupo', async () => {
    const repo = mockTransactionRepository();
    const input = makeValidInput();
    repo.createMany.mockResolvedValue([{ ...input, id: 'tx-1', ownerId: 'user-1', createdAt: '', updatedAt: '' }]);
    const useCase = new CreateTransactionsUseCase(repo, mockCardRepository());

    const result = await useCase.execute({ ownerId: 'user-1', input });

    expect(result.transactions[0]?.installmentGroupId).toBeUndefined();
  });
});
