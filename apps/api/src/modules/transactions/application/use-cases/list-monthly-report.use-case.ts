import { Injectable } from '@nestjs/common';
import type {
  Month,
  MonthlyReport,
  RecurringRule,
  Transaction,
  TransactionQuery,
} from '@valletcontrol/shared';
import { calculateSummary, coveredByRule, shouldMaterializeRule } from '@valletcontrol/shared';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port';
import { RecurringRuleRepositoryPort } from '../../../recurring-rules/application/ports/recurring-rule-repository.port';

export interface ListMonthlyReportInput {
  ownerId: string;
  query: TransactionQuery;
}

/** Converte uma regra recorrente em um lançamento sintético do mês (preview puro). */
function ruleToLine(rule: RecurringRule, month: Month, year: number): Transaction {
  return {
    id: `${rule.id}:${month}:${year}`,
    ownerId: rule.ownerId,
    description: rule.description,
    amountCents: rule.amountCents,
    type: rule.type,
    category: rule.category,
    paymentMethod: null,
    dueDate: null,
    month,
    year,
    isPaid: false,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/** Aplica ao lançamento sintético os mesmos filtros da listagem mensal. */
function matchesQuery(line: Transaction, query: TransactionQuery): boolean {
  if (
    query.search?.trim() &&
    !line.description.toLowerCase().includes(query.search.trim().toLowerCase())
  ) {
    return false;
  }
  if (query.type && line.type !== query.type) {
    return false;
  }
  if (query.category && line.category !== query.category) {
    return false;
  }
  if (query.isPaid !== undefined && line.isPaid !== query.isPaid) {
    return false;
  }
  return true;
}

/**
 * Use case: relatório mensal com resumo calculado no servidor.
 * Regras recorrentes ativas (ex.: salário) entram no resumo, mas NÃO são
 * listadas como linhas (linhas sintéticas não são transações reais e
 * quebrariam ações como marcar como pago). A injeção é idempotente
 * (não duplica quando já existe transação marcada pela regra).
 */
@Injectable()
export class ListMonthlyReportUseCase {
  constructor(
    private readonly transactions: TransactionRepositoryPort,
    private readonly recurringRules?: RecurringRuleRepositoryPort,
  ) {}

  async execute(input: ListMonthlyReportInput): Promise<MonthlyReport> {
    const transactions = await this.transactions.findAllByOwner(input.ownerId, input.query);
    const { month, year } = input.query;

    const lines = this.recurringRules
      ? await this.injectRecurringRules(
          this.recurringRules,
          transactions,
          input.ownerId,
          month,
          year,
          input.query,
        )
      : [];

    const summary = calculateSummary([...transactions, ...lines]);
    return {
      month,
      year,
      transactions,
      summary,
    };
  }

  private async injectRecurringRules(
    rulesRepo: RecurringRuleRepositoryPort,
    transactions: Transaction[],
    ownerId: string,
    month: Month,
    year: number,
    query: TransactionQuery,
  ): Promise<Transaction[]> {
    const rules = await rulesRepo.findAllByOwner(ownerId);
    const lines: Transaction[] = [];
    for (const rule of rules) {
      if (!shouldMaterializeRule(rule, month, year)) continue;
      if (coveredByRule(transactions, rule.id, month, year)) continue;
      const line = ruleToLine(rule, month, year);
      if (matchesQuery(line, query)) lines.push(line);
    }
    return lines;
  }
}

export type { Transaction, TransactionQuery };
