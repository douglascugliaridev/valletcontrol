'use client';

import type { Category, TransactionType } from '@valletcontrol/shared';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_TO_TYPE,
  TRANSACTION_TYPES,
} from '@valletcontrol/shared';
import { Button, Input, Select } from '@/components/ui';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EMPTY_FILTERS, type Filters } from './filters.types';

export function FiltersBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const [draftSearch, setDraftSearch] = useState(filters.search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setDraftSearch(filters.search), [filters.search]);

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const onSearch = (value: string) => {
    setDraftSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ search: value }), 350);
  };

  const categories: readonly Category[] = filters.type
    ? CATEGORIES.filter((c) => CATEGORY_TO_TYPE[c] === filters.type)
    : CATEGORIES;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar descrição…"
          value={draftSearch}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <Select
          aria-label="Tipo"
          value={filters.type ?? ''}
          onChange={(e) =>
            set({
              type: (e.target.value || undefined) as TransactionType | undefined,
              category: undefined,
            })
          }
        >
          <option value="">Todos tipos</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'receita' ? 'Receitas' : t === 'despesa' ? 'Despesas' : 'Devedores'}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Categoria"
          value={filters.category ?? ''}
          onChange={(e) => set({ category: (e.target.value || undefined) as Category | undefined })}
        >
          <option value="">Todas categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Pagamento"
          value={filters.isPaid === undefined ? '' : String(filters.isPaid)}
          onChange={(e) =>
            set({ isPaid: e.target.value === '' ? undefined : e.target.value === 'true' })
          }
        >
          <option value="">Pagamento: todos</option>
          <option value="true">Pagas</option>
          <option value="false">Pendentes</option>
        </Select>
        <Button
          variant="ghost"
          onClick={() => onChange(EMPTY_FILTERS)}
          disabled={
            !filters.search && !filters.type && !filters.category && filters.isPaid === undefined
          }
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}
