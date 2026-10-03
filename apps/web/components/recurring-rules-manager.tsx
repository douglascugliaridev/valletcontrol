'use client';

import type { Month, MonthlyReport, RecurringRule, Transaction } from '@walletcontrol/shared';
import {
  addMonths,
  CATEGORY_LABELS,
  MAX_MONTHS_AHEAD,
  MONTH_NAMES_LONG,
} from '@walletcontrol/shared';
import { useDeleteRecurringRule, useExtendRecurringRule, useRecurringRules } from '@/lib/hooks';
import { ApiError, api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Spinner,
} from '@/components/ui';
import { Plus, Repeat, Trash2 } from 'lucide-react';
import { RecurringRuleCreateDialog } from '@/components/recurring-rule-create-dialog';
import { useEffect, useState } from 'react';
import { formatCents } from '@/lib/format';
import { typeTone } from '@/lib/display';

interface MonthRef {
  month: Month;
  year: number;
}

interface GroupCount {
  total: number;
  first?: MonthRef;
  last?: MonthRef;
}

/** Um mês do relatório já filtrado pelas transações do grupo. */
async function fetchMonth(client: typeof api, ref: MonthRef) {
  try {
    const report = await client<MonthlyReport>(
      `/transactions/monthly?year=${ref.year}&month=${ref.month}`,
    );
    return report.transactions;
  } catch {
    return [] as Transaction[];
  }
}

/** "nov/2026 → out/2027" para a linha de gestão do grupo. */
function rangeLabel(first: { month: Month; year: number }, last: { month: Month; year: number }) {
  const one = (m: { month: Month; year: number }) =>
    `${MONTH_NAMES_LONG[m.month - 1]?.slice(0, 3) ?? '?'}/${m.year}`;
  return `${one(first)} → ${one(last)}`;
}

export function RecurringRulesManager() {
  const { data: rules, isLoading } = useRecurringRules();
  const deleteRule = useDeleteRecurringRule();
  const extendRule = useExtendRecurringRule();

  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringRule | null>(null);
  const [extending, setExtending] = useState<RecurringRule | null>(null);
  const [extendMonths, setExtendMonths] = useState('12');
  const [creating, setCreating] = useState(false);

  /**
   * Quantas transações cada grupo tem, e o primeiro/último mês.
   *
   * O backend não expõe isso junto da regra, então derivamos do relatório: um
   * `GET /transactions/monthly` por mês do grupo. São poucas requisições (o grupo
   * tem `monthsAhead` meses) e evita um endpoint só para contagem.
   */
  const [counts, setCounts] = useState<Map<string, GroupCount>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = new Map<string, GroupCount>();
      for (const rule of rules ?? []) {
        if (!rule.monthsAhead) continue;
        let total = 0;
        let first: MonthRef | undefined;
        let last: MonthRef | undefined;
        for (let offset = 0; offset < rule.monthsAhead; offset += 1) {
          const ref = addMonths(rule.startMonth, rule.startYear, offset);
          const rows = await fetchMonth(api, ref);
          const mine = rows.filter((t) => t.recurringRuleId === rule.id);
          if (mine.length === 0) continue;
          total += mine.length;
          first ??= ref;
          last = ref;
        }
        next.set(rule.id, { total, ...(first ? { first } : {}), ...(last ? { last } : {}) });
      }
      if (!cancelled) setCounts(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [rules]);

  const saving = extendRule.isPending;

  const openExtend = (rule: RecurringRule) => {
    setFormError(null);
    setExtending(rule);
    setExtendMonths('12');
  };

  const confirmCreated = (created: number) => {
    setNotice(
      created > 0
        ? `Recorrência criada com ${created} lançamento(s) no relatório.`
        : 'Recorrência criada, sem lançamentos no período escolhido.',
    );
  };

  const submitExtend = async () => {
    if (!extending) return;
    setFormError(null);
    const months = Number(extendMonths);
    if (!Number.isInteger(months) || months < 1) {
      setFormError('Informe quantos meses acrescentar.');
      return;
    }
    if (months > MAX_MONTHS_AHEAD) {
      setFormError(`Máximo de ${MAX_MONTHS_AHEAD} meses por vez.`);
      return;
    }
    try {
      await extendRule.mutateAsync({ id: extending.id, months });
      setExtending(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível estender.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setFormError(null);
    try {
      const r = await deleteRule.mutateAsync(pendingDelete.id);
      // Informa o que saiu e o que ficou: os pagos continuam no relatório como
      // lançamentos comuns, então "excluir" não remove tudo da tela.
      setNotice(
        r.deletedTransactions > 0
          ? `Conta fixa cancelada: ${r.deletedTransactions} lançamento(s) não pagos foram removidos${
              r.keptPaidTransactions > 0
                ? `, e ${r.keptPaidTransactions} pago(s) continuam no relatório.`
                : '.'
            }`
          : 'Conta fixa cancelada. Não havia lançamentos não previstos.',
      );
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Não foi possível cancelar a conta fixa.',
      );
    } finally {
      setPendingDelete(null);
    }
  };

  /**
   * Receitas e despesas em blocos próprios.
   *
   * Uma lista única fazia o salário aparecer como se fosse uma conta a pagar: o número
   * ao lado é o mesmo valor, mas o sinal é o oposto. Separar por tipo evita ler "5.000,00"
   * na linha do salário e somar junto das despesas.
   */
  const incomes = (rules ?? []).filter((r) => r.type === 'receita');
  const expenses = (rules ?? []).filter((r) => r.type !== 'receita');

  const renderRow = (rule: RecurringRule) => (
    <div key={rule.id} className="flex items-center gap-3 px-5 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{rule.description}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge tone="neutral">{CATEGORY_LABELS[rule.category]}</Badge>
          <span>
            desde {MONTH_NAMES_LONG[rule.startMonth - 1]} {rule.startYear}
          </span>
          <Badge tone="neutral">{counts.get(rule.id)?.total ?? 0} lançamentos</Badge>
          {(() => {
            const c = counts.get(rule.id);
            if (c?.first && c.last) {
              return <span>{rangeLabel(c.first, c.last)}</span>;
            }
            return <span>{rule.monthsAhead ?? 0}m configurados</span>;
          })()}
        </span>
      </div>
      {/* `typeTone` é a convenção do app (`+ ` entra, `- ` sai), o mesmo sinal da
          tabela do dashboard. Sem ele o valor do salário se lia como conta a pagar. */}
      <div className="min-w-0 shrink text-sm font-semibold tabular-nums text-foreground sm:shrink-0">
        {typeTone[rule.type].value}
        {formatCents(rule.amountCents)}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openExtend(rule)}
          aria-label={`Estender ${rule.description}`}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive"
          onClick={() => setPendingDelete(rule)}
          aria-label={`Cancelar ${rule.description}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );

  const renderGroup = (title: string, group: RecurringRule[]) => {
    if (group.length === 0) return null;
    return (
      <section key={title} className="border-t border-border first:border-t-0">
        <h3 className="flex items-center gap-2 bg-muted/50 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
            {group.length}
          </span>
        </h3>
        <div className="divide-y divide-border">{group.map(renderRow)}</div>
      </section>
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />
          <CardTitle>Regras recorrentes</CardTitle>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nova recorrência
        </Button>
      </CardHeader>

      <div className="border-t border-border">
        {isLoading && !rules ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Spinner className="mx-auto size-5" />
          </div>
        ) : (rules ?? []).length === 0 ? (
          <div className="flex flex-col gap-3">
            {notice && (
              <p
                className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground"
                role="status"
              >
                {notice}
              </p>
            )}
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma recorrência. Use “Nova recorrência” para criar um salário, uma conta que se
              repete ou qualquer lançamento mensal.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notice && (
              <p
                className="mx-5 mt-3 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground"
                role="status"
              >
                {notice}
              </p>
            )}
            {renderGroup('Receitas', incomes)}
            {renderGroup('Despesas', expenses)}
          </div>
        )}
      </div>

      <RecurringRuleCreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={confirmCreated}
      />

      <Modal
        open={extending !== null}
        onClose={() => setExtending(null)}
        title="Estender recorrência"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Acrescenta meses ao fim de “{extending?.description}”. Os lançamentos já existentes —
            inclusive os pagos — não mudam.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extend-months">Quantos meses acrescentar</Label>
            <Input
              id="extend-months"
              type="number"
              min={1}
              max={MAX_MONTHS_AHEAD}
              value={extendMonths}
              onChange={(e) => setExtendMonths(e.target.value)}
            />
          </div>
          {formError && (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExtending(null)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={() => void submitExtend()}>
              {saving ? <Spinner className="size-4" /> : null}
              Estender
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Cancelar recorrência"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Cancelar a recorrência “{pendingDelete?.description}”
            {pendingDelete ? ` (${formatCents(pendingDelete.amountCents)})` : ''}?
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>
              Os lançamentos <strong className="text-foreground">não pagos</strong> a partir do
              primeiro não pago serão removidos.
            </li>
            <li>
              Os lançamentos <strong className="text-foreground">já pagos</strong> permanecem no
              relatório como lançamentos comuns — apagar um pagamento é outra operação.
            </li>
            <li>A recorrência deixa de se repetir nos meses seguintes.</li>
          </ul>
          {formError && (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              {deleteRule.isPending ? <Spinner className="size-4" /> : 'Cancelar conta fixa'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
