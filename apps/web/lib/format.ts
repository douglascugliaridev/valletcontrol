/** Formata centavos como moeda pt-BR. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Formata mês/ano como título pt-BR. */
export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}

const formatDateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Formata data ISO (yyyy-mm-dd) em dd/mm/yyyy. */
export function formatISODate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return formatDateFmt.format(new Date(Number(y), Number(m) - 1, Number(d)));
}

/** Converte texto por extenso pt-BR ("R$ 1.234,56" ou "1234.56") para centavos. */
export function parseReaisToCents(input: string): number | null {
  const raw = input.replace(/[R$\s]/g, '');
  if (!raw) return null;
  const value = raw.includes(',') ? Number(raw.replace(/\./g, '').replace(',', '.')) : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** Centavos para valor de input em reais ("1234,56"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
