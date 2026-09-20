import { Category, PaymentMethod, TransactionType } from '@valletcontrol/shared';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { makeTransaction, mockTransactionRepository } from '../../../../test/transaction.fixtures';
import { UpdateTransactionUseCase } from './update-transaction.use-case';
import { makeCard, mockCardRepository } from '../../../../test/card.fixtures';

const ownerId = 'user-1';

describe('UpdateTransactionUseCase', () => {
  it('atualiza uma transação existente do dono', async () => {
    const repo = mockTransactionRepository();
    const existing = makeTransaction();
    const updated = makeTransaction({ description: 'Aluguel novo', isPaid: true });
    repo.findByIdAndOwner.mockResolvedValue(existing);
    repo.updateByIdAndOwner.mockResolvedValue(updated);
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    const result = await useCase.execute({
      ownerId,
      id: 'tx-1',
      patch: { description: 'Aluguel novo', isPaid: true },
    });

    expect(repo.findByIdAndOwner).toHaveBeenCalledWith('tx-1', ownerId);
    expect(repo.updateByIdAndOwner).toHaveBeenCalledWith('tx-1', ownerId, {
      description: 'Aluguel novo',
      isPaid: true,
    });
    expect(result.description).toBe('Aluguel novo');
  });

  it('retorna NotFound quando a transação não pertence ao dono (RLS)', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(null);
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    await expect(
      useCase.execute({ ownerId, id: 'tx-de-outro-usuario', patch: { isPaid: true } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.updateByIdAndOwner).not.toHaveBeenCalled();
  });

  it('valida o resultado mesclado ao alterar tipo para devedor sem método de pagamento', async () => {
    const repo = mockTransactionRepository();
    const existing = makeTransaction();
    repo.findByIdAndOwner.mockResolvedValue(existing);
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    await expect(
      useCase.execute({
        ownerId,
        id: 'tx-1',
        patch: { type: TransactionType.DEBTOR, category: Category.DEBTORS, paymentMethod: null },
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_METHOD_REQUIRED' });
    expect(repo.updateByIdAndOwner).not.toHaveBeenCalled();
  });

  it('permite trocar o método de pagamento de um devedor', async () => {
    const repo = mockTransactionRepository();
    const existing = makeTransaction({
      type: TransactionType.DEBTOR,
      category: Category.DEBTORS,
      paymentMethod: PaymentMethod.NUBANK,
    });
    const updated = makeTransaction({
      type: TransactionType.DEBTOR,
      category: Category.DEBTORS,
      paymentMethod: PaymentMethod.ITAUCARD,
    });
    repo.findByIdAndOwner.mockResolvedValue(existing);
    repo.updateByIdAndOwner.mockResolvedValue(updated);
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    const result = await useCase.execute({
      ownerId,
      id: 'tx-1',
      patch: { paymentMethod: PaymentMethod.ITAUCARD },
    });

    expect(result.paymentMethod).toBe(PaymentMethod.ITAUCARD);
  });

  it('move transação entre meses preservando regras', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(makeTransaction());
    repo.updateByIdAndOwner.mockResolvedValue(makeTransaction({ month: 10 }));
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    const result = await useCase.execute({ ownerId, id: 'tx-1', patch: { month: 10, year: 2026 } });

    expect(result.month).toBe(10);
  });

  it('rejeita update que mantém método inconsistente com a bandeira do cartão', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const existing = makeTransaction({
      type: TransactionType.DEBTOR,
      category: Category.DEBTORS,
      paymentMethod: PaymentMethod.NUBANK,
      cardId: 'card-1',
    });
    repo.findByIdAndOwner.mockResolvedValue(existing);
    cards.findByIdAndOwner.mockResolvedValue(makeCard({ id: 'card-1', brand: 'itaucard' }));
    const useCase = new UpdateTransactionUseCase(repo, cards);

    await expect(
      useCase.execute({ ownerId, id: 'tx-1', patch: { isPaid: true } }),
    ).rejects.toMatchObject({ code: 'CARD_METHOD_MISMATCH' });
    expect(cards.findByIdAndOwner).toHaveBeenCalledWith('card-1', ownerId);
    expect(repo.updateByIdAndOwner).not.toHaveBeenCalled();
  });

  it('aceita update consistente com o cartão vinculado', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const existing = makeTransaction({
      type: TransactionType.DEBTOR,
      category: Category.DEBTORS,
      paymentMethod: PaymentMethod.NUBANK,
      cardId: 'card-1',
    });
    repo.findByIdAndOwner.mockResolvedValue(existing);
    repo.updateByIdAndOwner.mockResolvedValue(makeTransaction({ isPaid: true }));
    cards.findByIdAndOwner.mockResolvedValue(makeCard({ id: 'card-1', brand: 'nubank' }));
    const useCase = new UpdateTransactionUseCase(repo, cards);

    const result = await useCase.execute({ ownerId, id: 'tx-1', patch: { isPaid: true } });

    expect(result.isPaid).toBe(true);
    expect(repo.updateByIdAndOwner).toHaveBeenCalledWith('tx-1', ownerId, { isPaid: true });
  });

  it('rejeita update com cartão inexistente ou de outro dono', async () => {
    const repo = mockTransactionRepository();
    const cards = mockCardRepository();
    const existing = makeTransaction({
      type: TransactionType.DEBTOR,
      category: Category.DEBTORS,
      paymentMethod: PaymentMethod.ITAUCARD,
      cardId: 'card-ga',
    });
    repo.findByIdAndOwner.mockResolvedValue(existing);
    cards.findByIdAndOwner.mockResolvedValue(null);
    const useCase = new UpdateTransactionUseCase(repo, cards);

    await expect(
      useCase.execute({ ownerId, id: 'tx-1', patch: { isPaid: true } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.updateByIdAndOwner).not.toHaveBeenCalled();
  });

  it('aplica o patch a todas as parcelas do grupo, mantendo month/year/isPaid individuais', async () => {
    const repo = mockTransactionRepository();
    const existing = makeTransaction({ installmentGroupId: 'grp-1' });
    const updated = makeTransaction({ description: 'Celular', amountCents: 60_000 });
    repo.findByIdAndOwner
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    repo.updateManyByInstallmentGroupAndOwner.mockResolvedValue(4);
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    const result = await useCase.execute({
      ownerId,
      id: 'tx-1',
      patch: { description: 'Celular', amountCents: 60_000, month: 10, isPaid: true },
      applyToSeries: true,
    });

    expect(repo.updateManyByInstallmentGroupAndOwner).toHaveBeenCalledWith('grp-1', ownerId, {
      description: 'Celular',
      amountCents: 60_000,
    });
    expect(repo.updateByIdAndOwner).not.toHaveBeenCalled();
    expect(result.description).toBe('Celular');
  });

  it('rejeita série inválida (despesa para devedor sem método) antes de propagar', async () => {
    const repo = mockTransactionRepository();
    const existing = makeTransaction({ installmentGroupId: 'grp-1' });
    repo.findByIdAndOwner.mockResolvedValue(existing);
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    await expect(
      useCase.execute({
        ownerId,
        id: 'tx-1',
        patch: { type: TransactionType.DEBTOR, category: Category.DEBTORS, paymentMethod: null },
        applyToSeries: true,
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_METHOD_REQUIRED' });
    expect(repo.updateManyByInstallmentGroupAndOwner).not.toHaveBeenCalled();
  });

  it('cai no update individual quando a transação não pertence a um grupo', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(makeTransaction());
    repo.updateByIdAndOwner.mockResolvedValue(makeTransaction({ description: 'X' }));
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    await useCase.execute({
      ownerId,
      id: 'tx-1',
      patch: { description: 'X' },
      applyToSeries: true,
    });

    expect(repo.updateByIdAndOwner).toHaveBeenCalledWith('tx-1', ownerId, { description: 'X' });
    expect(repo.updateManyByInstallmentGroupAndOwner).not.toHaveBeenCalled();
  });

  it('toggle de pagamento com applyToSeries cai no update individual (sem campos compartilhados)', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(makeTransaction({ installmentGroupId: 'grp-1' }));
    repo.updateByIdAndOwner.mockResolvedValue(makeTransaction({ isPaid: true }));
    const useCase = new UpdateTransactionUseCase(repo, mockCardRepository());

    await useCase.execute({
      ownerId,
      id: 'tx-1',
      patch: { isPaid: true },
      applyToSeries: true,
    });

    expect(repo.updateByIdAndOwner).toHaveBeenCalledWith('tx-1', ownerId, { isPaid: true });
    expect(repo.updateManyByInstallmentGroupAndOwner).not.toHaveBeenCalled();
  });
});
