import { Injectable, NotFoundException } from '@nestjs/common';
import type { RecurringRule, RecurringRuleUpdate } from '@valletcontrol/shared';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface UpdateRecurringRuleInput {
  ownerId: string;
  id: string;
  patch: RecurringRuleUpdate;
}

/** Update escopado ao dono: busca prévia garante 404 amigável. */
@Injectable()
export class UpdateRecurringRuleUseCase {
  constructor(private readonly rules: RecurringRuleRepositoryPort) {}

  async execute({ ownerId, id, patch }: UpdateRecurringRuleInput): Promise<RecurringRule> {
    const existing = await this.rules.findByIdAndOwner(id, ownerId);
    if (!existing) {
      throw new NotFoundException('Regra recorrente não encontrada.');
    }
    return this.rules.updateByIdAndOwner(id, ownerId, patch);
  }
}
