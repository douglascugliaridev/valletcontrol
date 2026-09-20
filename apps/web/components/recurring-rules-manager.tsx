'use client';

import type { Category, Month, RecurringRule, TransactionType } from '@valletcontrol/shared';
import { CATEGORY_LABELS, MONTH_NAMES_LONG, TRANSACTION_TYPE_LABELS } from '@valletcontrol/shared';
import {
  useCreateRecurringRule,
  useDeleteRecurringRule,
  useRecurringRules,
  useUpdateRecurringRule,
} from '@/lib/hooks';
import { ApiError } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
} from '@/components/ui';
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { categoriesForType } from '@/lib/display';
import { centsToInput, formatCents, parseReaisToCents } from '@/lib/format';
import { cn } from '@/lib/cn';

const NEW_RULE = (now: Date): RuleDraft => ({
  description: '',
  amount: '',
  type: 'receita',
  category: 'receita',
  startMonth: (now.getMonth() + 1) as Month,
  startYear: now.getFullYear(),
  isActive: true,
});

interface RuleDraft {
  description: string;
  amount: string;
  type: TransactionType;
  category: Category;
  startMonth: number;
  startYear: number;
  isActive: boolean;
}

function toDraft(rule: RecurringRule): RuleDraft {
  return {
    description: rule.description,
    amount: centsToInput(rule.amountCents),
    type: rule.type,
    category: rule.category,
    startMonth: rule.startMonth,
    startYear: rule.startYear,
    isActive: rule.isActive,
  };
}

/** Ano base para o seletor de início da regra. */
function startYearOptions(defaultYear: number): number[] {
  return [defaultYear - 1, defaultYear, defaultYear + 1];
}

export function RecurringRulesManager() {
  const { data: rules, isLoading } = useRecurringRules();
  const createRule = useCreateRecurringRule();
  const updateRule = useUpdateRecurringRule();
  const deleteRule = useDeleteRecurringRule();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(() => NEW_RULE(new Date()));
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringRule | null>(null);

  const openCreate = () => {
    setFormError(null);
    setEditing(null);
    setDraft(NEW_RULE(new Date()));
    setFormOpen(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setFormError(null);
    setEditing(rule);
    setDraft(toDraft(rule));
    setFormOpen(true);
  };

  const set = (patch: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const onTypeChange = (type: TransactionType) => {
    const categories = categoriesForType(type);
    set({ type, category: categories[0] ?? 'outros' });
  };

  const submit = async () => {
    setFormError(null);
    const amountCents = parseReaisToCents(draft.amount);
    if (!draft.description.trim()) {
      setFormError('Informe a descrição da regra.');
      return;
    }
    if (amountCents === null) {
      setFormError('Informe um valor válido.');
      return;
    }
    const input = {
      description: draft.description.trim(),
      amountCents,
      type: draft.type,
      category: draft.category,
      startMonth: draft.startMonth as Month,
      startYear: draft.startYear,
      isActive: draft.isActive,
    };
    try {
      if (editing) {
        await updateRule.mutateAsync({
          id: editing.id,
          patch: {
            description: input.description,
            amountCents: input.amountCents,
            type: input.type,
            category: input.category,
            isActive: input.isActive,
          },
        });
      } else {
        await createRule.mutateAsync(input);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar a regra.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRule.mutateAsync(pendingDelete.id);
    } finally {
      setPendingDelete(null);
    }
  };

  const saving = createRule.isPending || updateRule.isPending;
  const categories = categoriesForType(draft.type);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />
          <CardTitle>Regras recorrentes</CardTitle>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          Nova regra
        </Button>
      </CardHeader>

      <div className="divide-y divide-border border-t border-border">
        {isLoading && !rules ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Spinner className="mx-auto size-5" />
          </div>
        ) : (rules ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma regra recorrente. Ex.: cadastre o “Salário” uma única vez e ele entra todo mês
            no relatório.
          </p>
        ) : (
          (rules ?? []).map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{rule.description}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge tone={rule.type === 'receita' ? 'success' : 'danger'}>
                    {TRANSACTION_TYPE_LABELS[rule.type]}
                  </Badge>
                  <Badge tone="neutral">{CATEGORY_LABELS[rule.category]}</Badge>
                  <span>
                    desde {MONTH_NAMES_LONG[rule.startMonth - 1]} {rule.startYear}
                  </span>
                  {rule.isActive ? (
                    <Badge tone="success">Ativa</Badge>
                  ) : (
                    <Badge tone="neutral">Inativa</Badge>
                  )}
                </span>
              </div>
              <div className="min-w-0 shrink text-sm font-semibold tabular-nums text-foreground sm:shrink-0">
                {formatCents(rule.amountCents)}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(rule)}
                  aria-label="Editar regra"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setPendingDelete(rule)}
                  aria-label="Excluir regra"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar regra recorrente' : 'Nova regra recorrente'}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-description">Descrição</Label>
            <Input
              id="rule-description"
              placeholder="Ex.: Salário"
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-amount">Valor (R$)</Label>
              <Input
                id="rule-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={draft.amount}
                onChange={(e) => set({ amount: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-type">Tipo</Label>
              <Select
                id="rule-type"
                value={draft.type}
                onChange={(e) => onTypeChange(e.target.value as TransactionType)}
              >
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-category">Categoria</Label>
            <Select
              id="rule-category"
              value={draft.category}
              onChange={(e) => set({ category: e.target.value as Category })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-start-month">Mês inicial</Label>
              <Select
                id="rule-start-month"
                value={draft.startMonth}
                onChange={(e) => set({ startMonth: Number(e.target.value) })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES_LONG[m - 1]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-start-year">Ano inicial</Label>
              <Select
                id="rule-start-year"
                value={draft.startYear}
                onChange={(e) => set({ startYear: Number(e.target.value) })}
              >
                {startYearOptions(new Date().getFullYear()).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
              className={cn('size-4 accent-[var(--color-primary)]')}
            />
            Regra ativa (entra no relatório todo mês a partir do mês inicial)
          </label>

          {formError && (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !draft.description.trim()}>
              {saving ? <Spinner className="size-4" /> : null}
              {editing ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Excluir regra recorrente"
      >
        <p className="text-sm text-muted-foreground">
          Deseja excluir a regra “{pendingDelete?.description}” (
          {pendingDelete ? formatCents(pendingDelete.amountCents) : ''})? Ela deixará de entrar no
          relatório mensal.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            {deleteRule.isPending ? <Spinner className="size-4" /> : 'Excluir'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
