import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { TransactionRepositoryPort } from '../../../transactions/application/ports/transaction-repository.port';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface DeleteRecurringRuleInput {
  ownerId: string;
  id: string;
}

export interface DeleteRecurringRuleResponse {
  /** Transações não pagas removidas — os meses que deixam de existir. */
  deletedTransactions: number;
  /** Transações pagas preservadas, que continuam no relatório como lançamentos comuns. */
  keptPaidTransactions: number;
}

/**
 * Use case: cancela uma conta fixa.
 *
 * A conta fixa materializa N transações reais, então "excluir a regra" não pode ser só
 * apagar a regra — sem isso os N lançamentos continuariam no relatório sem o vínculo
 * (o `onDelete: SetNull` da FK só zera o `recurringRuleId`), e o botão de "excluir
 * conta fixa" não apagaria conta nenhuma.
 *
 * A regra de corte é **não pago a partir do primeiro não pago**:
 *
 *   - lançamentos pagos são fato consumado e nunca são apagados aqui;
 *   - a partir do primeiro lançamento não pago (em ordem cronológica), os meses
 *     futuros vão embora — que é o que significa "cancelei essa conta";
 *   - o que já passou e ainda não foi pago também sai, porque é uma obrigação que
 *     deixou de existir. Marcar como pago é a forma de protegê-lo, e essa escolha
 *     continua sendo do usuário.
 *
 * Ao final a regra é removida. As transações pagas que sobram ficam órfãs de propósito:
 * são lançamentos reais, que o usuário pode editar ou apagar individualmente.
 */
@Injectable()
export class DeleteRecurringRuleUseCase {
  constructor(
    private readonly rules: RecurringRuleRepositoryPort,
    private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute({ ownerId, id }: DeleteRecurringRuleInput): Promise<DeleteRecurringRuleResponse> {
    const rule = await this.rules.findByIdAndOwner(id, ownerId);
    if (!rule) {
      throw new NotFoundError('Conta fixa não encontrada.');
    }

    const total = await this.transactions.countTransactionsOfRule(id, ownerId);

    // Ponto de corte: o primeiro lançamento não pago. Sem nenhum, o grupo inteiro já
    // foi pago e não há o que apagar.
    const firstUnpaid = await this.transactions.findFirstUnpaidByRecurringRule(id, ownerId);
    const deletedTransactions = firstUnpaid
      ? await this.transactions.deleteManyUnpaidByRecurringRuleFrom(
          id,
          ownerId,
          firstUnpaid.year,
          firstUnpaid.month,
        )
      : 0;

    await this.rules.deleteByIdAndOwner(id, ownerId);

    return {
      deletedTransactions,
      keptPaidTransactions: Math.max(0, total - deletedTransactions),
    };
  }
}
