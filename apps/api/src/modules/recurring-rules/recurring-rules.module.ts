import { Module } from '@nestjs/common';
import { CreateRecurringRuleUseCase } from './application/use-cases/create-recurring-rule.use-case';
import { DeleteRecurringRuleUseCase } from './application/use-cases/delete-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from './application/use-cases/list-recurring-rules.use-case';
import { UpdateRecurringRuleUseCase } from './application/use-cases/update-recurring-rule.use-case';
import { RecurringRuleRepositoryPort } from './application/ports/recurring-rule-repository.port';
import { PrismaRecurringRuleRepository } from './infrastructure/prisma-recurring-rule.repository';
import { RecurringRulesController } from './ui/recurring-rules.controller';

/**
 * Módulo de regras recorrentes do usuário (ex.: salário recorrente).
 * Segue o mesmo frame hexagonal dos demais módulos: controller (adapter
 * de UI) → use cases (hexágono central) → repository Prisma (adapter de
 * persistência), todos escopados ao dono autenticado (`ownerId`).
 */
@Module({
  controllers: [RecurringRulesController],
  providers: [
    CreateRecurringRuleUseCase,
    DeleteRecurringRuleUseCase,
    ListRecurringRulesUseCase,
    UpdateRecurringRuleUseCase,
    { provide: RecurringRuleRepositoryPort, useClass: PrismaRecurringRuleRepository },
  ],
  exports: [RecurringRuleRepositoryPort],
})
export class RecurringRulesModule {}
