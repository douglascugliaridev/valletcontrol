'use client';

import type { Card as CardType, Transaction } from '@valletcontrol/shared';
import { CATEGORY_LABELS, formatCardLabel, TRANSACTION_TYPE_LABELS } from '@valletcontrol/shared';
import { Badge, Button, Card } from '@/components/ui';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { typeTone } from '@/lib/display';
import { formatCents, formatISODate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CardLogo } from '@/components/card-logo';

export function TransactionsTable({
  transactions,
  cards,
  loading,
  onTogglePaid,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[] | undefined;
  cards?: CardType[] | undefined;
  loading: boolean;
  onTogglePaid: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  if (loading && !transactions) {
    return (
      <Card className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-muted/40" />
        ))}
      </Card>
    );
  }

  const items = transactions ?? [];

  return (
    <Card className="overflow-hidden">
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-sm font-medium">Nenhuma transação encontrada</p>
          <p className="text-sm text-muted-foreground">
            Ajuste os filtros ou cadastre um novo lançamento.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t) => {
            const tone = typeTone[t.type];
            const card = t.category ? undefined : (cards ?? []).find((c) => c.id === t.cardId);
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => onTogglePaid(t)}
                  aria-label={t.isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
                  title={t.isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                    t.isPaid
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'border-border text-transparent hover:border-muted-foreground/50',
                  )}
                >
                  <Check className="size-4" />
                </button>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      'truncate text-sm font-medium',
                      t.isPaid &&
                        'text-muted-foreground line-through decoration-muted-foreground/40',
                    )}
                  >
                    {t.description}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge tone={tone.badge}>{TRANSACTION_TYPE_LABELS[t.type]}</Badge>
                    <Badge tone="neutral">
                      {t.category ? (
                        (CATEGORY_LABELS[t.category] ?? t.category)
                      ) : card ? (
                        <span className="flex items-center gap-1.5">
                          <CardLogo logoUrl={card.logoUrl} alt={card.name} size={16} />
                          {formatCardLabel(card)}
                        </span>
                      ) : (
                        'Cartão'
                      )}
                    </Badge>
                    {t.dueDate && <span>venc. {formatISODate(t.dueDate)}</span>}
                    {t.paymentMethod && <span>{t.paymentMethod}</span>}
                  </span>
                </div>

                <div className="min-w-0 shrink text-sm font-semibold tabular-nums text-foreground sm:shrink-0">
                  {tone.value}
                  {formatCents(t.amountCents)}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(t)} aria-label="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => onDelete(t)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
