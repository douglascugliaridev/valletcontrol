import { Injectable } from '@nestjs/common';
import type { Transaction, TransactionInput, TransactionUpdate } from '@valletcontrol/shared';
import { validateCardPaymentConsistency, validateTransactionInput } from '@valletcontrol/shared';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { CardRepositoryPort } from '../../../cards/application/ports/card-repository.port';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port';

export interface UpdateTransactionInput {
  ownerId: string;
  id: string;
  patch: TransactionUpdate;
  /** Aplica o patch a todas as parcelas do grupo (quando faz parte de um). */
  applyToSeries?: boolean;
}

/** Campos compartilhados da série — mês/ano/isPaid permanecem individuais. */
const SERIES_FIELDS = [
  'description',
  'amountCents',
  'type',
  'category',
  'paymentMethod',
  'cardId',
  'dueDate',
] as const;

/** Filtra o patch mantendo apenas os campos propagáveis para o grupo. */
function pickSeriesPatch(patch: TransactionUpdate): TransactionUpdate {
  const series: Record<string, unknown> = {};
  for (const field of SERIES_FIELDS) {
    const value = patch[field];
    if (value !== undefined) {
      series[field] = value;
    }
  }
  return series as TransactionUpdate;
}

/**
 * Use case: edição completa de transação (ponto de atenção corrigido —
 * antes só existia toggle de pagamento e exclusão).
 * Apatar patch valida a transação completa resultante (merge com a atual)
 * para preservar a integridade das regras de domínio.
 * Com `applyToSeries`, campos compartilhados são propagados a todas as
 * parcelas do mesmo grupo.
 */
@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    private readonly transactions: TransactionRepositoryPort,
    private readonly cards: CardRepositoryPort,
  ) {}

  async execute(input: UpdateTransactionInput): Promise<Transaction> {
    const existing = await this.transactions.findByIdAndOwner(input.id, input.ownerId);
    if (!existing) {
      throw new NotFoundError('Transação não encontrada.');
    }

    const seriesPatch =
      input.applyToSeries && existing.installmentGroupId
        ? pickSeriesPatch(input.patch)
        : null;

    // Série sem campos compartilhados (ex.: só isPaid) cai no fluxo individual.
    if (seriesPatch && Object.keys(seriesPatch).length > 0) {
      const merged: TransactionInput = { ...existing, ...seriesPatch };
      validateTransactionInput(merged);
      await this.validateCard(merged, input.ownerId);

      await this.transactions.updateManyByInstallmentGroupAndOwner(
        existing.installmentGroupId!,
        input.ownerId,
        seriesPatch,
      );
      const refreshed = await this.transactions.findByIdAndOwner(input.id, input.ownerId);
      if (!refreshed) {
        throw new NotFoundError('Transação não encontrada.');
      }
      return refreshed;
    }

    const merged: TransactionInput = { ...existing, ...input.patch };
    validateTransactionInput(merged);
    await this.validateCard(merged, input.ownerId);

    return this.transactions.updateByIdAndOwner(input.id, input.ownerId, input.patch);
  }

  private async validateCard(input: TransactionInput, ownerId: string): Promise<void> {
    if (!input.cardId) {
      return;
    }
    const card = await this.cards.findByIdAndOwner(input.cardId, ownerId);
    if (!card) {
      throw new NotFoundError('Cartão não encontrado.');
    }
    validateCardPaymentConsistency({
      paymentMethod: input.paymentMethod,
      cardBrand: card.brand,
    });
  }
}
