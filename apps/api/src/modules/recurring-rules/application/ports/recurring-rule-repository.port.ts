import type { RecurringRule, RecurringRuleInput, RecurringRuleUpdate } from '@valletcontrol/shared';

/**
 * Port (driven adapter) de persistência de regras recorrentes.
 * Toda consulta é escopada por `ownerId` (isolamento entre usuários).
 */
export abstract class RecurringRuleRepositoryPort {
  abstract findAllByOwner(ownerId: string): Promise<RecurringRule[]>;

  abstract findByIdAndOwner(id: string, ownerId: string): Promise<RecurringRule | null>;

  abstract create(ownerId: string, input: RecurringRuleInput): Promise<RecurringRule>;

  abstract updateByIdAndOwner(
    id: string,
    ownerId: string,
    patch: RecurringRuleUpdate,
  ): Promise<RecurringRule>;

  abstract deleteByIdAndOwner(id: string, ownerId: string): Promise<void>;
}
