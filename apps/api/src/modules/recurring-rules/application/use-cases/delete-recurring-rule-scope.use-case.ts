import { Injectable } from '@nestjs/common';
import type { Month } from '@walletcontrol/shared';
import { TransactionRepositoryPort } from '../../../transactions/application/ports/transaction-repository.port';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface DeleteRecurringRuleScopeInput {
  ownerId: string;
  ruleId: string;
  /** Mês de referência: apaga este mês e os seguintes, nunca os anteriores. */
  fromMonth: Month;
  fromYear: number;
}

export interface DeleteRecurringRuleScopeResponse {
  deleted: number;
  /** Lançamentos pagos no escopo, preservados: apagar conta nunca destrói pagamento. */
  keptPaid: number;
  /** true quando o grupo ficou sem nenhuma transação e a regra foi removida. */
  ruleRemoved: boolean;
}

/**
 * Use case: exclui as transações de uma conta fixa a partir de um mês.
 *
 * Se o grupo ficar sem nenhuma transação, a regra é removida junto: um grupo vazio
 * não tem o que gerenciar em Configurações, e reapareceria na lista sem nenhuma
 * transação para editar.
 */
@Injectable()
export class DeleteRecurringRuleScopeUseCase {
  constructor(
    private readonly rules: RecurringRuleRepositoryPort,
    private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(input: DeleteRecurringRuleScopeInput): Promise<DeleteRecurringRuleScopeResponse> {
    // Antes de apagar, para poder dizer quantos pagamentos o escopo poupou.
    const keptPaid = await this.transactions.countPaidByRecurringRuleFrom(
      input.ruleId,
      input.ownerId,
      input.fromYear,
      input.fromMonth,
    );

    const deleted = await this.transactions.deleteManyUnpaidByRecurringRuleFrom(
      input.ruleId,
      input.ownerId,
      input.fromYear,
      input.fromMonth,
    );

    // Janela ampla de propósito: o objetivo é saber se sobrou QUALQUER transação
    // do grupo, não as do escopo. `countTransactionsOfRule` evita materializar
    // linhas só para checar o tamanho.
    //
    // Se sobraram pagos, a regra permanece: eles ainda são lançamentos do grupo.
    const remaining = await this.transactions.countTransactionsOfRule(input.ruleId, input.ownerId);
    let ruleRemoved = false;
    if (remaining === 0) {
      await this.rules.deleteByIdAndOwner(input.ruleId, input.ownerId);
      ruleRemoved = true;
    }

    return { deleted, keptPaid, ruleRemoved };
  }
}
