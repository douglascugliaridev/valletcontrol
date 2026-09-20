'use client';

import type {
  CreateTransactionPayload,
  Month,
  Transaction,
  TransactionUpdate,
} from '@valletcontrol/shared';
import {
  ApiError,
  authErrorMessage,
  clearSession,
  getStoredUser,
  getToken,
} from '@/lib/api';
import {
  useCards,
  useCreateTransaction,
  useDeleteTransaction,
  useMonthlyReport,
  useUpdateTransaction,
  toMonth,
} from '@/lib/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Spinner } from '@/components/ui';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { FiltersBar } from '@/components/filters-bar';
import { EMPTY_FILTERS, type Filters } from '@/components/filters.types';
import { Logo } from '@/components/logo';
import { MonthSelector } from '@/components/month-selector';
import { SummaryCards } from '@/components/summary-cards';
import { ThemeToggle } from '@/components/theme-toggle';
import { TransactionForm } from '@/components/transaction-form';
import { TransactionsTable } from '@/components/transactions-table';
import { LogOut, Plus, Settings } from 'lucide-react';
import Link from 'next/link';

type FormState = { open: true; initial: Transaction | null } | { open: false };

export default function DashboardPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState<Month>(toMonth(now.getMonth() + 1));
  const [year, setYear] = useState(now.getFullYear());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [form, setForm] = useState<FormState>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setAuthed(true);
  }, [router]);

  const user = useMemo(() => getStoredUser(), []);

  const { data: report, isLoading } = useMonthlyReport({ year, month, ...filters });
  const { data: cards } = useCards();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const openCreate = () => {
    setFormError(null);
    setForm({ open: true, initial: null });
  };
  const openEdit = (t: Transaction) => {
    setFormError(null);
    setForm({ open: true, initial: t });
  };

  const handleCreate = async (payload: CreateTransactionPayload) => {
    setFormError(null);
    try {
      await createTx.mutateAsync(payload);
      setForm({ open: false });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  };

  const handleEdit = async (patch: TransactionUpdate, applyToAll?: boolean) => {
    if (!form.open || !form.initial) return;
    setFormError(null);
    try {
      await updateTx.mutateAsync({ id: form.initial.id, patch, applyToAll });
      setForm({ open: false });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  };

  const handleTogglePaid = (t: Transaction) => {
    setToggleError(null);
    updateTx.mutate(
      { id: t.id, patch: { isPaid: !t.isPaid } },
      {
        onSuccess: () => setToggleError(null),
        onError: (err) =>
          setToggleError(authErrorMessage(err, 'Não foi possível atualizar a transação.')),
      },
    );
  };

  const handleDelete = async (all: boolean) => {
    if (!pendingDelete) return;
    try {
      await deleteTx.mutateAsync({ id: pendingDelete.id, all });
    } finally {
      setPendingDelete(null);
    }
  };

  const onMonthChange = (m: number, y: number) => {
    setMonth(toMonth(m));
    setYear(y);
  };

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const saving = createTx.isPending || updateTx.isPending;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-4 pb-16 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Logo />
          <div className="leading-tight">
            <p className="font-semibold">ValletControl</p>
            <p className="text-xs text-muted-foreground">
              {user?.name ? `Olá, ${String(user.name).split(' ')[0]}` : 'Olá'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/settings" aria-label="Configurações">
            <Button variant="ghost" className="px-2 sm:px-4">
              <Settings className="size-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
          </Link>
          <Button variant="ghost" onClick={logout} aria-label="Sair" className="px-2 sm:px-4">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector month={month} year={year} onChange={onMonthChange} />
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nova transação
        </Button>
      </div>

      <SummaryCards report={report} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex flex-col gap-4">
            <FiltersBar filters={filters} onChange={setFilters} />
            {toggleError && (
              <p
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {toggleError}
              </p>
            )}
            <TransactionsTable
              transactions={report?.transactions}
              cards={cards}
              loading={isLoading}
              onTogglePaid={handleTogglePaid}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          </div>
        </div>
        <CategoryBreakdown report={report} cards={cards} />
      </div>

      <TransactionForm
        open={form.open}
        onClose={() => setForm({ open: false })}
        initial={form.open ? form.initial : null}
        defaultMonth={month}
        defaultYear={year}
        saving={saving}
        errorMessage={saving ? null : formError}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={
          pendingDelete?.installmentGroupId ? 'Excluir parcela' : 'Excluir transação'
        }
      >
        {pendingDelete?.installmentGroupId ? (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{pendingDelete.description}</span>{' '}
              (R$ {(pendingDelete.amountCents / 100).toFixed(2).replace('.', ',')}) faz parte de
              um grupo de parcelas. O que deseja excluir?
            </p>
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => handleDelete(false)} disabled={deleteTx.isPending}>
                {deleteTx.isPending ? <Spinner className="size-4" /> : null}
                Apenas esta parcela
              </Button>
              <Button variant="danger" onClick={() => handleDelete(true)} disabled={deleteTx.isPending}>
                {deleteTx.isPending ? <Spinner className="size-4" /> : null}
                Todas as parcelas
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Deseja excluir “{pendingDelete?.description}” (
              {pendingDelete
                ? `R$ ${(pendingDelete.amountCents / 100).toFixed(2).replace('.', ',')}`
                : ''}
              )? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => handleDelete(false)}>
                {deleteTx.isPending ? <Spinner className="size-4" /> : 'Excluir'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </main>
  );
}
