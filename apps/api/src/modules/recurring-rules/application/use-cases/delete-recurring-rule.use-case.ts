import { Injectable } from '@nestjs/common';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface DeleteRecurringRuleInput {
  ownerId: string;
  id: string;
}

/** Delete escopado ao dono; sem 404 silencioso (igual cards/transactions). */
@Injectable()
export class DeleteRecurringRuleUseCase {
  constructor(private readonly rules: RecurringRuleRepositoryPort) {}

  async execute({ ownerId, id }: DeleteRecurringRuleInput): Promise<void> {
    await this.rules.deleteByIdAndOwner(id, ownerId);
  }
}
