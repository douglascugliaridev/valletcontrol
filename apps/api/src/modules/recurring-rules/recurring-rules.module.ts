import { Module } from '@nestjs/common';
import { CreateRecurringRuleUseCase } from './application/use-cases/create-recurring-rule.use-case';
import { DeleteRecurringRuleUseCase } from './application/use-cases/delete-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from './application/use-cases/list-recurring-rules.use-case';
import { UpdateRecurringRuleUseCase } from './application/use-cases/update-recurring-rule.use-case';
import { MaterializeRecurringRuleUseCase } from './application/use-cases/materialize-recurring-rule.use-case';
import { ExtendRecurringRuleUseCase } from './application/use-cases/extend-recurring-rule.use-case';
import { ApplyRecurringRuleScopeUseCase } from './application/use-cases/apply-recurring-rule-scope.use-case';
import { DeleteRecurringRuleScopeUseCase } from './application/use-cases/delete-recurring-rule-scope.use-case';
import { RecurringRuleRepositoryPort } from './application/ports/recurring-rule-repository.port';
import { PrismaRecurringRuleRepository } from './infrastructure/prisma-recurring-rule.repository';
import { RecurringRulesController } from './ui/recurring-rules.controller';
import { CardsModule } from '../cards/cards.module';
import { TransactionsModule } from '../transactions/transactions.module';

/**
 * Módulo de regras recorrentes do usuário (contas fixas).
 * Segue o mesmo frame hexagonal dos demais módulos: controller (adapter
 * de UI) → use cases (hexágono central) → repository Prisma (adapter
 * de persistência), todos escopados ao dono autenticado (`ownerId`).
 *
 * Depende de TransactionsModule e CardsModule porque a regra materializa
 * transações reais. A dependência é unidirecional: TransactionsModule não
 * importa este módulo, então não há ciclo.
 */
@Module({
  imports: [TransactionsModule, CardsModule],
  controllers: [RecurringRulesController],
  providers: [
    CreateRecurringRuleUseCase,
    DeleteRecurringRuleUseCase,
    ListRecurringRulesUseCase,
    UpdateRecurringRuleUseCase,
    MaterializeRecurringRuleUseCase,
    ExtendRecurringRuleUseCase,
    ApplyRecurringRuleScopeUseCase,
    DeleteRecurringRuleScopeUseCase,
    { provide: RecurringRuleRepositoryPort, useClass: PrismaRecurringRuleRepository },
  ],
  exports: [RecurringRuleRepositoryPort],
})
export class RecurringRulesModule {}
