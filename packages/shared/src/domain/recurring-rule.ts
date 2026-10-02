import type { Category, TransactionType } from './enums';
import type { Month } from './enums';

/**
 * Teto de meses de uma regra recorrente. Fonte única para o DTO da API e o
 * formulário do front, para o front nunca aceitar o que a API rejeita.
 */
export const MAX_MONTHS_AHEAD = 600;

/**
 * Regra recorrente (ex.: salário) — **grupo** de transações de conta fixa.
 *
 * Não projeta nada: cada mês da recorrência é uma transação real gravada no banco,
 * compartilhando o `recurringRuleId` com as irmãs. Assim editar, excluir e marcar
 * pago funcionam sem tratamento especial, e o relatório é consulta pura.
 */
export interface RecurringRule {
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  category: Category;
  /** Mês/ano da primeira ocorrência do grupo. Imutável após a criação. */
  startMonth: Month;
  startYear: number;
  /**
   * Quantos meses o grupo ocupa, **contando `startMonth`**: `12` gera um ano fechado.
   * Número de transações gravadas, não um horizonte calculado.
   */
  monthsAhead: number | null;
  /**
   * Só controla a gestão do grupo (listar em Configurações e permitir estender).
   * Não esconde transações: elas são reais e podem estar pagas.
   */
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
  /** `null`/ausente = grupo sem extensão registrada. */
  monthsAhead?: number | null;
  isActive?: boolean;
}

export type RecurringRuleUpdate = Partial<Omit<RecurringRuleInput, 'startMonth' | 'startYear'>>;

/** Escopo de uma alteração sobre um grupo de contas fixas. */
export type RecurrenceScope = 'month' | 'forward';
