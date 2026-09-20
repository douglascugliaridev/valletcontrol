import { Injectable } from '@nestjs/common';
import type { RecurringRule, RecurringRuleInput } from '@valletcontrol/shared';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface CreateRecurringRuleInput {
  ownerId: string;
  input: RecurringRuleInput;
}

/**
 * Use case: criação de regra recorrente (ex.: salário).
 * A regra nasce inativa → ativa conforme `isActive`; a materialização
 * no relatório mensal é calculada de forma pura (sem gerar parcelas).
 */
@Injectable()
export class CreateRecurringRuleUseCase {
  constructor(private readonly rules: RecurringRuleRepositoryPort) {}

  async execute({ ownerId, input }: CreateRecurringRuleInput): Promise<RecurringRule> {
    return this.rules.create(ownerId, {
      description: input.description.trim(),
      amountCents: input.amountCents,
      type: input.type,
      category: input.category,
      startMonth: input.startMonth,
      startYear: input.startYear,
      isActive: input.isActive ?? true,
    });
  }
}
