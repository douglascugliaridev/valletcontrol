import { NotFoundError } from '../../../../common/errors/app-errors';
import { makeTransaction, mockTransactionRepository } from '../../../../test/transaction.fixtures';
import { DeleteTransactionUseCase } from './delete-transaction.use-case';

const ownerId = 'user-1';

describe('DeleteTransactionUseCase', () => {
  it('exclui transação existente do dono', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(makeTransaction());
    repo.deleteByIdAndOwner.mockResolvedValue(undefined);
    const useCase = new DeleteTransactionUseCase(repo);

    await useCase.execute({ ownerId, id: 'tx-1' });

    expect(repo.deleteByIdAndOwner).toHaveBeenCalledWith('tx-1', ownerId);
  });

  it('não exclui transação de outro dono (RLS)', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(null);
    const useCase = new DeleteTransactionUseCase(repo);

    await expect(useCase.execute({ ownerId, id: 'tx-1' })).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.deleteByIdAndOwner).not.toHaveBeenCalled();
  });

  it('exclui todas as parcelas do grupo quando scope é series', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(makeTransaction({ installmentGroupId: 'grp-1' }));
    repo.deleteManyByInstallmentGroupAndOwner.mockResolvedValue(3);
    const useCase = new DeleteTransactionUseCase(repo);

    await useCase.execute({ ownerId, id: 'tx-1', scope: 'series' });

    expect(repo.deleteManyByInstallmentGroupAndOwner).toHaveBeenCalledWith('grp-1', ownerId);
    expect(repo.deleteByIdAndOwner).not.toHaveBeenCalled();
  });

  it('scope series sem grupo cai na exclusão individual', async () => {
    const repo = mockTransactionRepository();
    repo.findByIdAndOwner.mockResolvedValue(makeTransaction());
    repo.deleteByIdAndOwner.mockResolvedValue(undefined);
    const useCase = new DeleteTransactionUseCase(repo);

    await useCase.execute({ ownerId, id: 'tx-1', scope: 'series' });

    expect(repo.deleteByIdAndOwner).toHaveBeenCalledWith('tx-1', ownerId);
    expect(repo.deleteManyByInstallmentGroupAndOwner).not.toHaveBeenCalled();
  });
});
