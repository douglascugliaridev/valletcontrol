'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Card,
  CardInput,
  CardUpdate,
  CreateTransactionPayload,
  GetMonthlyReportParams,
  Month,
  MonthlyReport,
  RecurringRule,
  RecurringRuleInput,
  RecurringRuleUpdate,
  Transaction,
  TransactionUpdate,
} from '@valletcontrol/shared';
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

export function useUploadCardLogo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      return api<Card>(`/cards/${id}/logo`, { method: 'POST', body });
    },
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
    mutationFn: (id: string) => api<void>(`/recurring-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: recurringRulesKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function toMonth(value: number): Month {
  return Math.min(12, Math.max(1, Math.floor(value))) as Month;
}
