import { Injectable } from '@nestjs/common';
import type { RecurringRule, Transaction } from '@walletcontrol/shared';
import { addMonths, validateTransactionInput } from '@walletcontrol/shared';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { TransactionRepositoryPort } from '../../../transactions/application/ports/transaction-repository.port';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface MaterializeRecurringRuleInput {
  ownerId: string;
  ruleId: string;
  /** Quantidade de meses a acrescentar, contados a partir do último já gravado. */
  months: number;
}

/**
 * Use case: estende um grupo de conta fixa gravando as transações dos próximos meses.
 *
 * Complementa a criação (que já grava o primeiro lote) e é a única forma de aumentar
 * um grupo depois de criado — deliberadamente não há "reduzir", porque apagar meses já
 * pagos destruiria dado real.
 */
@Injectable()
export class ExtendRecurringRuleUseCase {
  constructor(
    private readonly rules: RecurringRuleRepositoryPort,
    private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(
    input: MaterializeRecurringRuleInput,
  ): Promise<{ rule: RecurringRule; added: number }> {
    const rule = await this.rules.findByIdAndOwner(input.ruleId, input.ownerId);
    if (!rule) {
      throw new NotFoundError('Regra de conta fixa não encontrada.');
    }
    if (rule.monthsAhead === null) {
      throw new NotFoundError(
        'Esta regra não tem meses definidos. Crie a conta fixa pela tela de transações.',
      );
    }

    const last = await this.transactions.findManyByRecurringRuleFrom(
      rule.id,
      input.ownerId,
      rule.startYear,
      rule.startMonth,
    );
    const lastRow = last[last.length - 1];
    const anchor = lastRow ?? { month: rule.startMonth, year: rule.startYear };

    const total = rule.monthsAhead + input.months;
    const items: Transaction[] = [];
    for (let offset = 1; offset <= input.months; offset += 1) {
      const { month, year } = addMonths(anchor.month, anchor.year, offset);
      const item: Transaction = {
        id: '',
        ownerId: input.ownerId,
        description: rule.description,
        amountCents: rule.amountCents,
        type: rule.type,
        category: rule.category,
        paymentMethod: null,
        cardId: null,
        dueDate: null,
        month,
        year,
        isPaid: false,
        recurringRuleId: rule.id,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      };
      validateTransactionInput(item);
      items.push(item);
    }

    const created = await this.transactions.createMany(input.ownerId, items);
    await this.rules.updateByIdAndOwner(rule.id, input.ownerId, { monthsAhead: total });
    return { rule, added: created.length };
  }
}
