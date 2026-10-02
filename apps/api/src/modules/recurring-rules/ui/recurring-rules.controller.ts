import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { Month, RecurringRule, RecurringRuleUpdate } from '@walletcontrol/shared';
import type { AuthenticatedUser } from '../../../common/auth/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/auth/decorators/current-user.decorator';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from './dto/update-recurring-rule.dto';
import {
  ExtendRecurringRuleDto,
  MaterializeRecurringRuleDto,
  RecurringRuleScopeDto,
} from './dto/materialize-recurring-rule.dto';
import { CreateRecurringRuleUseCase } from '../application/use-cases/create-recurring-rule.use-case';
import { DeleteRecurringRuleUseCase } from '../application/use-cases/delete-recurring-rule.use-case';
import type { DeleteRecurringRuleResponse } from '../application/use-cases/delete-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from '../application/use-cases/list-recurring-rules.use-case';
import { UpdateRecurringRuleUseCase } from '../application/use-cases/update-recurring-rule.use-case';
import { MaterializeRecurringRuleUseCase } from '../application/use-cases/materialize-recurring-rule.use-case';
import { ExtendRecurringRuleUseCase } from '../application/use-cases/extend-recurring-rule.use-case';
import { ApplyRecurringRuleScopeUseCase } from '../application/use-cases/apply-recurring-rule-scope.use-case';
import { DeleteRecurringRuleScopeUseCase } from '../application/use-cases/delete-recurring-rule-scope.use-case';

/**
 * Controller REST de regras recorrentes — frame driver adapter
 * (espelho do cards/transactions). Toda a autorização é escopada
 * via @CurrentUser / @AuthenticatedUser.
 */
@Controller('recurring-rules')
export class RecurringRulesController {
  constructor(
    private readonly createRule: CreateRecurringRuleUseCase,
    private readonly listRules: ListRecurringRulesUseCase,
    private readonly updateRule: UpdateRecurringRuleUseCase,
    private readonly deleteRule: DeleteRecurringRuleUseCase,
    private readonly materializeRule: MaterializeRecurringRuleUseCase,
    private readonly extendRule: ExtendRecurringRuleUseCase,
    private readonly applyScope: ApplyRecurringRuleScopeUseCase,
    private readonly deleteScope: DeleteRecurringRuleScopeUseCase,
  ) {}

  /**
   * Cria uma conta fixa materializando N transações reais.
   *
   * Rota declarada antes de `@Post()` para não ser capturada pelo tratamento de `:id`.
   */
  @Post('materialize')
  async materialize(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: MaterializeRecurringRuleDto,
  ) {
    return this.materializeRule.execute({
      ownerId: authUser.userId,
      months: dto.months ?? 1,
      seed: {
        description: dto.description,
        amountCents: dto.amountCents,
        type: dto.type,
        category: dto.category,
        cardId: dto.cardId ?? null,
        dueDate: dto.dueDate ?? null,
        month: dto.month as Month,
        year: dto.year,
        isPaid: dto.isPaid,
      },
    });
  }

  @Post(':id/extend')
  async extend(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ExtendRecurringRuleDto,
  ) {
    return this.extendRule.execute({
      ownerId: authUser.userId,
      ruleId: id,
      months: dto.months,
    });
  }

  @Post()
  async add(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: CreateRecurringRuleDto,
  ): Promise<RecurringRule> {
    return this.createRule.execute({
      ownerId: authUser.userId,
      input: {
        description: dto.description,
        amountCents: dto.amountCents,
        type: dto.type,
        category: dto.category,
        startMonth: dto.startMonth as Month,
        startYear: dto.startYear,
        monthsAhead: dto.monthsAhead ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Get()
  async list(@CurrentUser() authUser: AuthenticatedUser): Promise<RecurringRule[]> {
    return this.listRules.execute({ ownerId: authUser.userId });
  }

  @Patch(':id')
  async update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringRuleDto,
  ): Promise<RecurringRule> {
    const patch: RecurringRuleUpdate = {
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.monthsAhead !== undefined && { monthsAhead: dto.monthsAhead }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };
    return this.updateRule.execute({ ownerId: authUser.userId, id, patch });
  }

  /**
   * Aplica um patch nas transações do grupo a partir do mês de referência.
   * Meses anteriores ficam intactos.
   */
  @Patch(':id/transactions')
  async applyToScope(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecurringRuleScopeDto,
  ) {
    return this.applyScope.execute({
      ownerId: authUser.userId,
      ruleId: id,
      fromMonth: dto.fromMonth as Month,
      fromYear: dto.fromYear,
      patch: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isPaid !== undefined && { isPaid: dto.isPaid }),
        ...('cardId' in dto && { cardId: dto.cardId ?? null }),
        ...('dueDate' in dto && { dueDate: dto.dueDate ?? null }),
      },
    });
  }

  /** Exclui as transações do grupo a partir do mês de referência. */
  @Delete(':id/transactions')
  async deleteFromScope(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Query('fromMonth') fromMonth: string,
    @Query('fromYear') fromYear: string,
  ) {
    return this.deleteScope.execute({
      ownerId: authUser.userId,
      ruleId: id,
      fromMonth: Number(fromMonth) as Month,
      fromYear: Number(fromYear),
    });
  }

  /**
   * Cancela a conta fixa: remove os lançamentos não pagos a partir do primeiro não
   * pago e preserva os pagos. Devolve as contagens para o front informar o que saiu.
   */
  @Delete(':id')
  async remove(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DeleteRecurringRuleResponse> {
    return this.deleteRule.execute({ ownerId: authUser.userId, id });
  }
}
