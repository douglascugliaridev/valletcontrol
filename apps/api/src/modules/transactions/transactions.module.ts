import { Module } from '@nestjs/common';
import { CreateTransactionsUseCase } from './application/use-cases/create-transactions.use-case';
import { DeleteTransactionUseCase } from './application/use-cases/delete-transaction.use-case';
import { ListMonthlyReportUseCase } from './application/use-cases/list-monthly-report.use-case';
import { UpdateTransactionUseCase } from './application/use-cases/update-transaction.use-case';
import { PrismaTransactionRepository } from './infrastructure/prisma-transaction.repository';
import { TransactionsController } from './ui/transactions.controller';
import { TransactionRepositoryPort } from './application/ports/transaction-repository.port';
import { CardsModule } from '../cards/cards.module';
import { RecurringRulesModule } from '../recurring-rules/recurring-rules.module';

@Module({
  imports: [RecurringRulesModule, CardsModule],
  controllers: [TransactionsController],
  providers: [
    ListMonthlyReportUseCase,
    CreateTransactionsUseCase,
    UpdateTransactionUseCase,
    DeleteTransactionUseCase,
    { provide: TransactionRepositoryPort, useClass: PrismaTransactionRepository },
  ],
})
export class TransactionsModule {}
