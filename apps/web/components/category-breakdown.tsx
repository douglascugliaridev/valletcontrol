'use client';

import type { Card as CardType, Category, MonthlyReport } from '@valletcontrol/shared';
import { CATEGORY_LABELS, formatCardLabel } from '@valletcontrol/shared';
import { Card, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { formatCents } from '@/lib/format';
import { CardLogo } from '@/components/card-logo';

export function CategoryBreakdown({
  report,
  cards,
}: {
  report: MonthlyReport | undefined;
  cards?: CardType[] | undefined;
}) {
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Por categoria</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3 p-5 pt-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton className="h-6 w-full" key={i} />
          ))}
        </div>
      </Card>
    );
  }

  const grouped = new Map<string, number>();
  for (const t of report.transactions) {
    const key = t.category ?? t.cardId ?? 'sem-categoria';
    grouped.set(key, (grouped.get(key) ?? 0) + t.amountCents);
  }

  const bucketLabel = (key: string): string => {
    const fixed = CATEGORY_LABELS[key as Category];
    if (fixed) return fixed;
    const card = (cards ?? []).find((c) => c.id === key);
    return card ? formatCardLabel(card) : 'Sem categoria';
  };

  const bucketCard = (key: string): CardType | undefined => (cards ?? []).find((c) => c.id === key);

  const total = Math.max(
    1,
    [...grouped.values()].reduce((a, b) => a + b, 0),
  );
  const rows = [...grouped.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Por categoria</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-3 p-5 pt-0">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>
        )}
        {rows.map(([bucket, cents]) => {
          const pct = Math.round((cents / total) * 100);
          return (
            <div className="flex flex-col gap-1" key={bucket}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  {bucketCard(bucket) && (
                    <CardLogo
                      logoUrl={bucketCard(bucket)?.logoUrl}
                      alt={bucketLabel(bucket)}
                      size={16}
                    />
                  )}
                  {bucketLabel(bucket)}
                </span>
                <span className="tabular-nums text-muted-foreground">{formatCents(cents)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
