'use client';

import type { MonthlyReport } from '@valletcontrol/shared';
import { Card, Skeleton } from '@/components/ui';
import { ArrowDownCircle, ArrowUpCircle, HandCoins, Scale } from 'lucide-react';
import { formatCents } from '@/lib/format';
import { cn } from '@/lib/cn';

const baseCard = 'flex flex-col gap-1 p-5';

export function SummaryCards({ report }: { report: MonthlyReport | undefined }) {
  if (!report) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card className={baseCard} key={i}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  const { summary } = report;
  const cards = [
    {
      icon: ArrowUpCircle,
      label: 'Receitas',
      value: formatCents(summary.totalIncomeCents),
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: ArrowDownCircle,
      label: 'Despesas',
      value: formatCents(summary.totalExpenseCents),
      valueClass: 'text-rose-600 dark:text-rose-400',
    },
    {
      icon: Scale,
      label: 'Saldo',
      value: formatCents(summary.balanceCents),
      valueClass:
        summary.balanceCents >= 0 ? 'text-foreground' : 'text-rose-600 dark:text-rose-400',
    },
    {
      icon: HandCoins,
      label: 'A receber',
      value: formatCents(summary.totalDebtorsCents),
      valueClass: 'text-amber-600 dark:text-amber-400',
      detail: `pago ${formatCents(summary.paidDebtorsCents)} · pendente ${formatCents(summary.unpaidDebtorsCents)}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card className={baseCard} key={card.label}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <card.icon className="size-4" />
            <span className="text-xs font-medium">{card.label}</span>
          </div>
          <div className={cn('text-xl font-bold tabular-nums sm:text-2xl', card.valueClass)}>
            {card.value}
          </div>
          {card.detail && <div className="text-xs text-muted-foreground">{card.detail}</div>}
        </Card>
      ))}
    </div>
  );
}
