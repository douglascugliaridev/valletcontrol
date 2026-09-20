'use client';

import type {
  Category,
  Month,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '@valletcontrol/shared';
import {
  CARD_BRAND_LABELS,
  PAYMENT_METHODS,
  cardToPaymentMethod,
  formatCardLabel,
} from '@valletcontrol/shared';
import type { CreateTransactionPayload, TransactionUpdate } from '@valletcontrol/shared';
import { Button, Input, Label, Modal, Select, Spinner } from '@/components/ui';
import { CardLogo } from '@/components/card-logo';
import { categoriesForType } from '@/lib/display';
import { centsToInput, parseReaisToCents } from '@/lib/format';
import { useCards } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { useEffect, useState } from 'react';

export interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  /** Transação a editar; null = novo lançamento. */
  initial: Transaction | null;
  defaultMonth: Month;
  defaultYear: number;
  saving?: boolean;
  errorMessage?: string | null;
  onCreate: (payload: CreateTransactionPayload) => void;
  onEdit: (patch: TransactionUpdate, applyToAll?: boolean) => void;
}

const TYPE_LABEL = { receita: 'Receita', despesa: 'Despesa', devedor: 'Devedor(a)' } as const;
const CAT_LABEL: Record<Category, string> = {
  contas_fixas: 'Contas Fixas',
  outros: 'Outros',
  receita: 'Receitas (salário, freela…)',
  devedores: 'Devedores (a receber)',
};
const METHOD_LABEL = { nubank: 'Nubank', itaucard: 'Itaucard' } as const;

interface Draft {
  description: string;
  amount: string;
  type: TransactionType;
  category: Category;
  paymentMethod: string;
  cardId: string;
  dueDate: string;
  isPaid: boolean;
  month: number;
  year: number;
  installments: string;
  startFrom: string;
}

function toDraft(initial: Transaction | null, defaultMonth: Month, defaultYear: number): Draft {
  if (initial) {
    return {
      description: initial.description,
      amount: centsToInput(initial.amountCents),
      type: initial.type,
      category: initial.category ?? 'outros',
      paymentMethod: initial.paymentMethod ?? '',
      cardId: initial.cardId ?? '',
      dueDate: initial.dueDate ?? '',
      isPaid: initial.isPaid,
      month: initial.month,
      year: initial.year,
      installments: '',
      startFrom: '',
    };
  }
  return {
    description: '',
    amount: '',
    type: 'despesa',
    category: 'contas_fixas',
    paymentMethod: '',
    cardId: '',
    dueDate: '',
    isPaid: false,
    month: defaultMonth,
    year: defaultYear,
    installments: '',
    startFrom: '',
  };
}

export function TransactionForm({
  open,
  onClose,
  initial,
  defaultMonth,
  defaultYear,
  saving,
  errorMessage,
  onCreate,
  onEdit,
}: TransactionFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, defaultMonth, defaultYear));
  const [applyToAll, setApplyToAll] = useState(false);
  const { data: cards } = useCards();

  useEffect(() => {
    if (open) {
      setDraft(toDraft(initial, defaultMonth, defaultYear));
      setApplyToAll(false);
    }
  }, [open, initial, defaultMonth, defaultYear]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onTypeChange = (type: TransactionType) => {
    const categories = categoriesForType(type);
    set({ type, category: categories[0] ?? 'outros', paymentMethod: '', cardId: '' });
  };

  const onCardChange = (cardId: string) => {
    const card = (cards ?? []).find((c) => c.id === cardId);
    set({
      cardId,
      paymentMethod: card ? (cardToPaymentMethod(card.brand) ?? '') : '',
    });
  };

  const onExpenseBucketChange = (value: string) => {
    const card = (cards ?? []).find((c) => c.id === value);
    if (card) {
      set({ cardId: card.id, category: 'outros', paymentMethod: '' });
    } else {
      set({ cardId: '', category: value as Category, paymentMethod: '' });
    }
  };

  const amountCents = parseReaisToCents(draft.amount);
  const needsMethod = draft.type === 'devedor';
  const totalInstallments = draft.installments.trim() ? Number(draft.installments) : 1;
  const startingInstallment = draft.startFrom.trim() ? Number(draft.startFrom) : 1;
  const errors: string[] = [];
  if (!draft.description.trim()) errors.push('Informe a descrição.');
  if (amountCents === null) errors.push('Informe um valor válido.');
  if (needsMethod && !draft.paymentMethod) errors.push('Devedores exigem o método de pagamento.');
  if (initial === null && totalInstallments > 12) {
    errors.push('Máximo de 12 parcelas.');
  }
  if (initial === null && startingInstallment < 1) {
    errors.push('Parcela inicial mínima: 1.');
  }
  if (initial === null && startingInstallment > totalInstallments) {
    errors.push('Parcela inicial não pode ser maior que o total de parcelas.');
  }

  const submit = () => {
    if (errors.length > 0) return;
    const base = {
      description: draft.description.trim(),
      amountCents: amountCents!,
      type: draft.type,
      category: draft.type === 'despesa' && draft.cardId ? null : draft.category,
      paymentMethod: needsMethod ? ((draft.paymentMethod ?? null) as PaymentMethod | null) : null,
      dueDate: draft.dueDate || null,
      cardId: draft.cardId || null,
      month: Number(draft.month) as Month,
      year: Number(draft.year),
      isPaid: draft.isPaid,
    };

    if (initial) {
      const {
        category,
        cardId,
        description,
        amountCents: value,
        type,
        paymentMethod,
        dueDate,
        month,
        year,
        isPaid,
      } = base;
      const patch: TransactionUpdate = {
        description,
        amountCents: value,
        type,
        category,
        cardId,
        paymentMethod,
        dueDate,
        month,
        year,
        isPaid,
      };
      onEdit(patch, applyToAll);
    } else {
      const installments = draft.installments.trim() ? Number(draft.installments) : undefined;
      const startingFrom =
        draft.startFrom.trim() && Number(draft.startFrom) > 1 ? Number(draft.startFrom) : undefined;
      onCreate({
        ...base,
        ...(installments && installments > 1
          ? { recurrence: { installments, ...(startingFrom ? { startFrom: startingFrom } : {}) } }
          : {}),
      });
    }
  };

  const categories = categoriesForType(draft.type);

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar transação' : 'Nova transação'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {initial?.installmentGroupId && (
          <div className="flex flex-col gap-1.5">
            <Label>Aplicar alterações a</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: false, label: 'Apenas esta parcela' },
                { value: true, label: 'Todas as parcelas' },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => setApplyToAll(option.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    applyToAll === option.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Mês, ano e status de pagamento continuam individuais em cada parcela.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Descrição</Label>
          <Input
            id="description"
            placeholder="Ex.: Aluguel, Mercado, Freela…"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0,00"
              value={draft.amount}
              onChange={(e) => set({ amount: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Tipo</Label>
            <Select
              id="type"
              value={draft.type}
              onChange={(e) => onTypeChange(e.target.value as TransactionType)}
            >
              {(Object.keys(TYPE_LABEL) as TransactionType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="category">
                {draft.type === 'despesa' ? 'Categoria ou cartão' : 'Categoria'}
              </Label>
              {(() => {
                const selected = (cards ?? []).find((c) => c.id === draft.cardId);
                return selected ? (
                  <CardLogo logoUrl={selected.logoUrl} alt={selected.name} size={16} />
                ) : null;
              })()}
            </div>
            <Select
              id="category"
              value={draft.type === 'despesa' ? draft.cardId || draft.category : draft.category}
              onChange={(e) =>
                draft.type === 'despesa'
                  ? onExpenseBucketChange(e.target.value)
                  : set({ category: e.target.value as Category })
              }
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CAT_LABEL[c]}
                </option>
              ))}
              {draft.type === 'despesa' && (cards ?? []).length > 0 && (
                <>
                  <option disabled>── Cartões ──</option>
                  {(cards ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCardLabel(c)} · {CARD_BRAND_LABELS[c.brand]}
                    </option>
                  ))}
                </>
              )}
            </Select>
          </div>
          {needsMethod ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card">Cartão</Label>
              <Select id="card" value={draft.cardId} onChange={(e) => onCardChange(e.target.value)}>
                <option value="">Selecione…</option>
                {(cards ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatCardLabel(c)} · {CARD_BRAND_LABELS[c.brand]}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={draft.dueDate}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
            </div>
          )}
        </div>

        {needsMethod && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentMethod">Método de pagamento</Label>
            <Select
              id="paymentMethod"
              value={draft.paymentMethod}
              onChange={(e) => set({ paymentMethod: e.target.value })}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="month">Mês</Label>
            <Select
              id="month"
              value={draft.month}
              onChange={(e) => set({ month: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="year">Ano</Label>
            <Select
              id="year"
              value={draft.year}
              onChange={(e) => set({ year: Number(e.target.value) })}
            >
              {[defaultYear - 1, defaultYear, defaultYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          {initial === null && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="installments">Parcelas</Label>
              <Input
                id="installments"
                type="number"
                min={1}
                max={12}
                placeholder="1"
                value={draft.installments}
                onChange={(e) => set({ installments: e.target.value })}
              />
            </div>
          )}
          {initial === null && totalInstallments > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startFrom">Iniciar na parcela</Label>
              <Input
                id="startFrom"
                type="number"
                min={1}
                max={totalInstallments}
                placeholder="1"
                value={draft.startFrom}
                onChange={(e) => set({ startFrom: e.target.value })}
              />
            </div>
          )}
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isPaid}
              onChange={(e) => set({ isPaid: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
            Pago(a)
          </label>
        </div>

        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}
        {errorMessage && (
          <p
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving === true || errors.length > 0}>
            {saving ? <Spinner className="size-4" /> : null}
            {initial
              ? 'Salvar alterações'
              : totalInstallments > 1
                ? startingInstallment > 1
                  ? `Criar ${totalInstallments - startingInstallment + 1} lançamentos (${startingInstallment}/${totalInstallments} a ${totalInstallments}/${totalInstallments})`
                  : `Criar ${totalInstallments} lançamentos`
                : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
