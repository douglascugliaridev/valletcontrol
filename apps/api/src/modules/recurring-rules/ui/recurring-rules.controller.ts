import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { Month, RecurringRule, RecurringRuleUpdate } from '@valletcontrol/shared';
import type { AuthenticatedUser } from '../../../common/auth/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/auth/decorators/current-user.decorator';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from './dto/update-recurring-rule.dto';
import { CreateRecurringRuleUseCase } from '../application/use-cases/create-recurring-rule.use-case';
import { DeleteRecurringRuleUseCase } from '../application/use-cases/delete-recurring-rule.use-case';
import { ListRecurringRulesUseCase } from '../application/use-cases/list-recurring-rules.use-case';
import { UpdateRecurringRuleUseCase } from '../application/use-cases/update-recurring-rule.use-case';

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
  ) {}

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
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };
    return this.updateRule.execute({ ownerId: authUser.userId, id, patch });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteRule.execute({ ownerId: authUser.userId, id });
  }
}
