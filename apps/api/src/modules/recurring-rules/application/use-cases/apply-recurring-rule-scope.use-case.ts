import { Injectable } from '@nestjs/common';
import type { Month, RecurringRule, TransactionUpdate } from '@walletcontrol/shared';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { TransactionRepositoryPort } from '../../../transactions/application/ports/transaction-repository.port';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface ApplyRecurringRuleScopeInput {
  ownerId: string;
  ruleId: string;
  /** Mês de referência: o escopo é este mês em diante. */
  fromMonth: Month;
  fromYear: number;
  patch: TransactionUpdate;
}

/**
 * Campos que descrevem **a conta** (o que é e quanto custa), e não o pagamento.
 * Alterar qualquer um deles em lote sobre um lançamento já pago reescreve a história
 * de um pagamento que aconteceu.
 */
const BILL_ATTRIBUTE_FIELDS = [
  'description',
  'amountCents',
  'type',
  'category',
  'cardId',
  'dueDate',
] as const satisfies readonly (keyof TransactionUpdate)[];

/**
 * O escopo protege os pagos **exceto** quando o patch é só sobre o estado do pagamento.
 *
 * Proteger sempre quebraria "marcar todos os meses à frente como pagos", que precisa
 * justamente alcançar as linhas não pagas. Exceção: se o patch também mexe nos atributos
 * da conta, a proteção volta — assim "corrigir o valor e marcar como pago" nunca
 * reescreve o valor de um pagamento já feito.
 */
function shouldProtectPaid(patch: TransactionUpdate): boolean {
  const keys = Object.keys(patch) as (keyof TransactionUpdate)[];
  const touchesBillAttributes = keys.some((k) =>
    (BILL_ATTRIBUTE_FIELDS as readonly string[]).includes(k),
  );
  return touchesBillAttributes;
}

/**
 * Use case: aplica um patch nas transações de uma conta fixa a partir de um mês.
 *
 * `month` e `year` são ignorados de propósito: eles são a âncora do escopo, e alterá-los
 * faria duas transações do mesmo grupo colidirem no mesmo mês.
 *
 * meses anteriores ao de referência **não** são tocados — editar março não muda janeiro.
 */
@Injectable()
export class ApplyRecurringRuleScopeUseCase {
  constructor(
    private readonly rules: RecurringRuleRepositoryPort,
    private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(
    input: ApplyRecurringRuleScopeInput,
  ): Promise<{ rule: RecurringRule; changed: number; keptPaid: number }> {
    const rule = await this.rules.findByIdAndOwner(input.ruleId, input.ownerId);
    if (!rule) {
      throw new NotFoundError('Regra de conta fixa não encontrada.');
    }

    const { month: _month, year: _year, ...patch } = input.patch;
    const protectPaid = shouldProtectPaid(patch);

    // Conta antes de alterar: `changed` não revela o que foi preservado.
    const keptPaid = protectPaid
      ? await this.transactions.countPaidByRecurringRuleFrom(
          input.ruleId,
          input.ownerId,
          input.fromYear,
          input.fromMonth,
        )
      : 0;

    const changed = await this.transactions.updateManyByRecurringRuleFrom(
      input.ruleId,
      input.ownerId,
      input.fromYear,
      input.fromMonth,
      patch,
      { protectPaid },
    );

    return { rule, changed, keptPaid };
  }
}
