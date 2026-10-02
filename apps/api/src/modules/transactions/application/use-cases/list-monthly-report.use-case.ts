import { Injectable } from '@nestjs/common';
import type { Month, MonthlyReport, TransactionQuery } from '@walletcontrol/shared';
import { calculateSummary } from '@walletcontrol/shared';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port';

export interface ListMonthlyReportInput {
  ownerId: string;
  query: TransactionQuery;
}

/**
 * Use case: relatório mensal com resumo calculado no servidor.
 *
 * Consulta pura — as transações do mês são lidas e resumidas.
 *
 * Antes, este use case também injetava "linhas sintéticas" a partir das regras
 * recorrentes ativas, que entravam no resumo mas NÃO na lista. Isso foi removido:
 * contas fixas agora são transações reais, materializadas na criação da regra
 * (ver `MaterializeRecurringRuleUseCase`) e portando `recurringRuleId`. Manter a
 * injeção somaria o valor duas vezes — a linha real e a projetada.
 */
@Injectable()
export class ListMonthlyReportUseCase {
  constructor(private readonly transactions: TransactionRepositoryPort) {}

  async execute(input: ListMonthlyReportInput): Promise<MonthlyReport> {
    const transactions = await this.transactions.findAllByOwner(input.ownerId, input.query);
    return {
      month: input.query.month,
      year: input.query.year,
      transactions,
      summary: calculateSummary(transactions),
    };
  }
}

export type { Month, TransactionQuery };
