import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port';

export type TransactionDeleteScope = 'one' | 'series';

export interface DeleteTransactionInput {
  ownerId: string;
  id: string;
  /** `series` exclui todas as parcelas do grupo da transação. Padrão: `one`. */
  scope?: TransactionDeleteScope;
}

/** Use case: exclusão de transação (escopada por dono). */
@Injectable()
export class DeleteTransactionUseCase {
  constructor(private readonly transactions: TransactionRepositoryPort) {}

  async execute(input: DeleteTransactionInput): Promise<void> {
    const existing = await this.transactions.findByIdAndOwner(input.id, input.ownerId);
    if (!existing) {
      throw new NotFoundError('Transação não encontrada.');
    }

    if (input.scope === 'series' && existing.installmentGroupId) {
      await this.transactions.deleteManyByInstallmentGroupAndOwner(
        existing.installmentGroupId,
        input.ownerId,
      );
      return;
    }

    await this.transactions.deleteByIdAndOwner(input.id, input.ownerId);
  }
}