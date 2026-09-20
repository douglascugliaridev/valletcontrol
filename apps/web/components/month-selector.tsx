'use client';

import { Button } from '@/components/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthYear } from '@/lib/format';
import { toMonth } from '@/lib/hooks';

export function MonthSelector({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}) {
  const move = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1);
    onChange(toMonth(date.getMonth() + 1), date.getFullYear());
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </Button>
      <div className="min-w-40 px-3 text-center text-base font-semibold capitalize">
        {formatMonthYear(month, year)}
      </div>
      <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
