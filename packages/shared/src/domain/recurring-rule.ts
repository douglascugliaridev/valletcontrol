import type { Category, Month, TransactionType } from './enums';
import type { Transaction } from './transaction';

/**
 * Regra recorrente (ex.: salário) — fonte de renda/despesa fixa mensal.
 * A injeção no mês é calculada de forma pura (não gera parcelas no banco).
 */
export interface RecurringRule {
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  category: Category;
  /** Mês/ano em que a regra passou a valer (primeira ocorrência esperada). */
  startMonth: Month;
  startYear: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Entrada para criação/edição de regra recorrente. */
export interface RecurringRuleInput {
  description: string;
  amountCents: number;
  type: TransactionType;
  category: Category;
  startMonth: Month;
  startYear: number;
  isActive?: boolean;
}

export type RecurringRuleUpdate = Partial<Omit<RecurringRuleInput, 'startMonth' | 'startYear'>>;

/** Marca de que um lançamento foi gerado por uma regra recorrente. */
export interface RecurrenceMarker {
  ruleId: string;
  month: Month;
  year: number;
}

/**
 * Decide se uma regra deve gerar lançamento no mês/ano dado.
 * Pura e determinística — base para persistência e para preview.
 */
export function shouldMaterializeRule(rule: RecurringRule, month: Month, year: number): boolean {
  if (!rule.isActive) return false;
  const startsAfter =
    year > rule.startYear || (year === rule.startYear && month >= rule.startMonth);
  return startsAfter;
}

/**
 * Lista de lançamentos que uma regra já cobriu no mês (via marca de recorrência
 * persistida na transação). Usada para tornar a injeção idempotente.
 */
export function coveredByRule(
  transactions: readonly Transaction[],
  ruleId: string,
  month: Month,
  year: number,
): boolean {
  return transactions.some(
    (t) =>
      (t as Transaction & { recurringRuleId?: string | null }).recurringRuleId === ruleId &&
      t.month === month &&
      t.year === year,
  );
}
