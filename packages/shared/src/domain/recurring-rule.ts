import type { Category, Month, TransactionType } from './enums';
import type { Transaction } from './transaction';
import { addMonths } from './recurrence';

/**
 * Teto de meses a frente de uma regra recorrente. Fonte única para o DTO da API e o
 * formulário do front, para o front nunca aceitar o que a API rejeita.
 */
export const MAX_MONTHS_AHEAD = 600;

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
  /**
   * Quantos meses a regra vale, contados de `startMonth`/`startYear` (inclusive).
   * `null` = **sem prazo**, que é o padrão: contas fixas (aluguel, energia) não têm
   * data de término. Preenchido, a regra para de gerar depois do último mês.
   */
  monthsAhead: number | null;
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
  /** `null`/ausente = sem prazo. Ver {@link RecurringRule.monthsAhead}. */
  monthsAhead?: number | null;
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
 *
 * A regra vale do mês inicial em diante. Se `monthsAhead` estiver preenchido, vale
 * apenas pelos próximos `monthsAhead` meses **contando o inicial**: `monthsAhead: 1`
 * gera só o mês de início, `12` gera um ano fechado.
 */
export function shouldMaterializeRule(rule: RecurringRule, month: Month, year: number): boolean {
  if (!rule.isActive) return false;
  const startsAfter =
    year > rule.startYear || (year === rule.startYear && month >= rule.startMonth);
  if (!startsAfter) return false;
  if (rule.monthsAhead === null || rule.monthsAhead === undefined) return true;

  const end = addMonths(rule.startMonth, rule.startYear, rule.monthsAhead - 1);
  const endsBefore = year < end.year || (year === end.year && month <= end.month);
  return endsBefore;
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
