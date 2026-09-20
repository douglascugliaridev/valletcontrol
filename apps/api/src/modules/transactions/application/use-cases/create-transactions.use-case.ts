import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  RecurrenceConfig,
  Transaction,
  TransactionCreatedResponse,
  TransactionInput,
} from '@valletcontrol/shared';
import {
  buildInstallmentDescription,
  expandRecurrence,
  validateCardPaymentConsistency,
  validateTransactionInput,
} from '@valletcontrol/shared';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { CardRepositoryPort } from '../../../cards/application/ports/card-repository.port';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port';

export interface CreateTransactionsInput {
  ownerId: string;
  input: TransactionInput;
  /** Quando presente, cria N transações paginadas pelos meses seguintes. */
  recurrence?: Pick<RecurrenceConfig, 'installments' | 'startFrom'>;
}

/**
 * Use case: criação de transação, com suporte a recorrência mensal.
 * Valida regras de domínio (incl. payment_method restrito a devedores)
 * ANTES de persistir — corrige a ausência de validação server-side.
 */
@Injectable()
export class CreateTransactionsUseCase {
  constructor(
    private readonly transactions: TransactionRepositoryPort,
    private readonly cards: CardRepositoryPort,
  ) {}

  async execute(input: CreateTransactionsInput): Promise<TransactionCreatedResponse> {
    const totalInstances = input.recurrence?.installments ?? 1;
    const instances =
      input.recurrence && totalInstances > 1
        ? expandRecurrence({
            startMonth: input.input.month,
            startYear: input.input.year,
            installments: totalInstances,
            startFrom: input.recurrence.startFrom ?? 1,
          })
        : [{ month: input.input.month, year: input.input.year, installment: 1 }];

    const card = input.input.cardId
      ? await this.resolveCard(input.input.cardId, input.ownerId)
      : null;

    // Todas as parcelas de um mesmo lançamento compartilham o grupo, para
    // permitir "editar/excluir todas as parcelas" mais tarde.
    const installmentGroupId = totalInstances > 1 ? randomUUID() : undefined;

    const items: TransactionInput[] = instances.map((instance) => {
      const transaction: TransactionInput = {
        description:
          totalInstances > 1
            ? buildInstallmentDescription(
                input.input.description,
                instance.installment,
                totalInstances,
              )
            : input.input.description,
        amountCents: input.input.amountCents,
        type: input.input.type,
        category: input.input.category,
        paymentMethod: input.input.paymentMethod,
        cardId: input.input.cardId ?? null,
        dueDate: input.input.dueDate,
        month: instance.month,
        year: instance.year,
        isPaid: input.input.isPaid ?? false,
        installmentGroupId,
      };

      validateTransactionInput(transaction);
      validateCardPaymentConsistency({
        paymentMethod: transaction.paymentMethod,
        cardBrand: card?.brand ?? null,
      });
      return transaction;
    });

    const created = await this.transactions.createMany(input.ownerId, items);
    return { transactions: this.sortByReferenceMonth(created) };
  }

  private async resolveCard(cardId: string, ownerId: string) {
    const card = await this.cards.findByIdAndOwner(cardId, ownerId);
    if (!card) {
      throw new NotFoundError('Cartão não encontrado.');
    }
    return card;
  }

  private sortByReferenceMonth(transactions: Transaction[]): Transaction[] {
    return [...transactions].sort((a, b) => {
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      if (a.month !== b.month) {
        return a.month - b.month;
      }
      return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    });
  }
}
