'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Card,
  CardInput,
  CardUpdate,
  CreateTransactionPayload,
  GetMonthlyReportParams,
  Month,
  MaterializeRecurringRulePayload,
  MaterializeRecurringRuleResponse,
  MonthlyReport,
  RecurringRule,
  RecurringRuleInput,
  RecurringRuleScopeDeleteResponse,
  RecurringRuleScopePayload,
  RecurringRuleScopeResponse,
  RecurringRuleUpdate,
  Transaction,
  TransactionUpdate,
} from '@walletcontrol/shared';
import { api } from './api';

export const reportKey = (params: GetMonthlyReportParams) =>
  ['transactions', 'monthly', params] as const;
export const cardsKey = ['cards'] as const;
export const recurringRulesKey = ['recurring-rules'] as const;

function monthlyParams(params: GetMonthlyReportParams): string {
  const search = new URLSearchParams({ year: String(params.year), month: String(params.month) });
  if (params.search) search.set('search', params.search);
  if (params.type) search.set('type', params.type);
  if (params.category) search.set('category', params.category);
  if (params.isPaid !== undefined) search.set('isPaid', String(params.isPaid));
  return search.toString();
}

export function useMonthlyReport(params: GetMonthlyReportParams) {
  return useQuery({
    queryKey: reportKey(params),
    queryFn: () => api<MonthlyReport>(`/transactions/monthly?${monthlyParams(params)}`),
  });
}

export function useCreateTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) =>
      api<{ transactions: Transaction[] }>('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
      applyToAll,
    }: {
      id: string;
      patch: TransactionUpdate;
      applyToAll?: boolean;
    }) =>
      api<Transaction>(`/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(applyToAll ? { ...patch, applyToAll } : patch),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDeleteTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, all }: { id: string; all?: boolean }) =>
      api<void>(`/transactions/${id}${all ? '?scope=series' : ''}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useCards() {
  return useQuery({
    queryKey: cardsKey,
    queryFn: () => api<Card[]>('/cards'),
  });
}

export function useCreateCard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CardInput) =>
      api<Card>('/cards', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => client.invalidateQueries({ queryKey: cardsKey }),
  });
}

export function useUpdateCard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardUpdate }) =>
      api<Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => client.invalidateQueries({ queryKey: cardsKey }),
  });
}

export function useDeleteCard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/cards/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: cardsKey }),
  });
}

export function useRecurringRules() {
  return useQuery({
    queryKey: recurringRulesKey,
    queryFn: () => api<RecurringRule[]>('/recurring-rules'),
  });
}

export function useCreateRecurringRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RecurringRuleInput) =>
      api<RecurringRule>('/recurring-rules', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateRecurringRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RecurringRuleUpdate }) =>
      api<RecurringRule>(`/recurring-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteRecurringRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<DeleteRecurringRuleResponse>(`/recurring-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Cria uma conta fixa materializando `months` meses a partir do mês de referência.
 * A resposta traz a regra e as transações geradas.
 */
export function useMaterializeRecurringBill() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: MaterializeRecurringRulePayload) =>
      api<MaterializeRecurringRuleResponse>('/recurring-rules/materialize', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Aplica um patch nas transações de um grupo de contas fixas a partir de um mês.
 * Usado quando o usuário escolhe "também os meses à frente" na edição.
 */
export function useApplyRecurringBillScope() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, ...payload }: RecurringRuleScopePayload & { ruleId: string }) =>
      api<RecurringRuleScopeResponse>(`/recurring-rules/${ruleId}/transactions`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/** Exclui as transações do grupo a partir de um mês (escopo "à frente"). */
export function useDeleteRecurringBillScope() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      fromMonth,
      fromYear,
    }: {
      ruleId: string;
      fromMonth: Month;
      fromYear: number;
    }) =>
      api<RecurringRuleScopeDeleteResponse>(
        `/recurring-rules/${ruleId}/transactions?fromMonth=${fromMonth}&fromYear=${fromYear}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/** Acrescenta meses ao fim de um grupo de contas fixas (usado em Configurações). */
export function useExtendRecurringRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, months }: { id: string; months: number }) =>
      api<{ rule: RecurringRule; added: number }>(`/recurring-rules/${id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ months }),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/** Resposta do cancelamento de uma conta fixa (o front usa para informar o usuário). */
export interface DeleteRecurringRuleResponse {
  /** Lançamentos não pagos removidos — os meses que deixam de existir. */
  deletedTransactions: number;
  /** Lançamentos pagos preservados, que seguem no relatório como lançamentos comuns. */
  keptPaidTransactions: number;
}

export function toMonth(value: number): Month {
  return Math.min(12, Math.max(1, Math.floor(value))) as Month;
}
