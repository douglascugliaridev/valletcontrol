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
  Query,
} from '@nestjs/common';
import type {
  MonthlyReport,
  Transaction,
  TransactionCreatedResponse,
  TransactionQuery,
} from '@valletcontrol/shared';
import type { AuthenticatedUser } from '../../../common/auth/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/auth/decorators/current-user.decorator';
import { CreateTransactionsUseCase } from '../application/use-cases/create-transactions.use-case';
import { DeleteTransactionUseCase } from '../application/use-cases/delete-transaction.use-case';
import { ListMonthlyReportUseCase } from '../application/use-cases/list-monthly-report.use-case';
import { UpdateTransactionUseCase } from '../application/use-cases/update-transaction.use-case';
import {
  CreateTransactionDto,
  ListMonthlyReportQueryDto,
  toTransactionUpdate,
  UpdateTransactionDto,
} from './dto/transaction.dto';

const DEFAULT_YEAR = new Date().getFullYear();
const DEFAULT_MONTH = (new Date().getMonth() + 1) as TransactionQuery['month'];

/** Controller REST de transações (frame driver adapter). */
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly listMonthlyReport: ListMonthlyReportUseCase,
    private readonly createTransactions: CreateTransactionsUseCase,
    private readonly updateTransaction: UpdateTransactionUseCase,
    private readonly deleteTransaction: DeleteTransactionUseCase,
  ) {}

  @Get('monthly')
  async getMonthlyReport(
    @CurrentUser() authUser: AuthenticatedUser,
    @Query() query: ListMonthlyReportQueryDto,
  ): Promise<MonthlyReport> {
    return this.listMonthlyReport.execute({
      ownerId: authUser.userId,
      query: {
        month: (query.month ?? DEFAULT_MONTH) as TransactionQuery['month'],
        year: query.year ?? DEFAULT_YEAR,
        search: query.search,
        type: query.type,
        category: query.category,
        isPaid: query.isPaid,
      },
    });
  }

  @Post()
  async create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionCreatedResponse> {
    const input = {
      description: dto.description,
      amountCents: dto.amountCents,
      type: dto.type,
      category: dto.category ?? null,
      paymentMethod: dto.paymentMethod ?? null,
      cardId: dto.cardId ?? null,
      dueDate: dto.dueDate ?? null,
      month: dto.month as TransactionQuery['month'],
      year: dto.year,
      isPaid: dto.isPaid ?? false,
    };

    return this.createTransactions.execute({
      ownerId: authUser.userId,
      input,
      recurrence: dto.recurrence
        ? {
            installments: dto.recurrence.installments,
            ...(dto.recurrence.startFrom !== undefined && {
              startFrom: dto.recurrence.startFrom,
            }),
          }
        : undefined,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.updateTransaction.execute({
      ownerId: authUser.userId,
      id,
      patch: toTransactionUpdate(dto),
      applyToSeries: dto.applyToAll === true,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Query('scope') scope?: string,
  ): Promise<void> {
    await this.deleteTransaction.execute({
      ownerId: authUser.userId,
      id,
      scope: scope === 'series' ? 'series' : 'one',
    });
  }
}
