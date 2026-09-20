import { Injectable } from '@nestjs/common';
import type { RecurringRule } from '@valletcontrol/shared';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface ListRecurringRulesInput {
  ownerId: string;
}

/** Lista as regras recorrentes do usuário (ativas por primeiro). */
@Injectable()
export class ListRecurringRulesUseCase {
  constructor(private readonly rules: RecurringRuleRepositoryPort) {}

  async execute({ ownerId }: ListRecurringRulesInput): Promise<RecurringRule[]> {
    return this.rules.findAllByOwner(ownerId);
  }
}
