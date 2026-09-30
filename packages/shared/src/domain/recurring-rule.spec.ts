import { describe, expect, it } from 'vitest';
import { Category, TransactionType } from './enums';
import type { Month } from './enums';
import { shouldMaterializeRule } from './recurring-rule';
import type { RecurringRule } from './recurring-rule';

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r1',
    ownerId: 'u1',
    description: 'Aluguel',
    amountCents: 150_000,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    startMonth: 3 as Month,
    startYear: 2026,
    monthsAhead: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('shouldMaterializeRule — sem prazo', () => {
  it('não gera antes do mês inicial', () => {
    expect(shouldMaterializeRule(rule(), 2 as Month, 2026)).toBe(false);
    expect(shouldMaterializeRule(rule(), 1 as Month, 2026)).toBe(false);
    expect(shouldMaterializeRule(rule(), 12 as Month, 2025)).toBe(false);
  });

  it('gera do mês inicial em diante, indefinidamente', () => {
    expect(shouldMaterializeRule(rule(), 3 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(rule(), 4 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(rule(), 12 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(rule(), 1 as Month, 2030)).toBe(true);
    expect(shouldMaterializeRule(rule(), 1 as Month, 2099)).toBe(true);
  });
});

describe('shouldMaterializeRule — com meses a frente', () => {
  it('monthsAhead: 1 gera apenas o mês inicial', () => {
    const r = rule({ monthsAhead: 1 });
    expect(shouldMaterializeRule(r, 3 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(r, 4 as Month, 2026)).toBe(false);
    expect(shouldMaterializeRule(r, 1 as Month, 2027)).toBe(false);
  });

  it('monthsAhead: 3 conta o mês inicial e para no terceiro', () => {
    const r = rule({ monthsAhead: 3 });
    expect(shouldMaterializeRule(r, 3 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(r, 4 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(r, 5 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(r, 6 as Month, 2026)).toBe(false);
  });

  it('monthsAhead: 12 fecha um ano exato a partir do inicial', () => {
    const r = rule({ monthsAhead: 12 });
    expect(shouldMaterializeRule(r, 2 as Month, 2026)).toBe(false);
    expect(shouldMaterializeRule(r, 3 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(r, 2 as Month, 2027)).toBe(true); // 12 meses depois
    expect(shouldMaterializeRule(r, 3 as Month, 2027)).toBe(false); // 13 meses
  });

  it('atravessa a virada de ano', () => {
    const r = rule({ startMonth: 11 as Month, monthsAhead: 4 });
    expect(shouldMaterializeRule(r, 11 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(r, 12 as Month, 2026)).toBe(true);
    expect(shouldMaterializeRule(r, 1 as Month, 2027)).toBe(true);
    expect(shouldMaterializeRule(r, 2 as Month, 2027)).toBe(true);
    expect(shouldMaterializeRule(r, 3 as Month, 2027)).toBe(false);
  });
});

describe('shouldMaterializeRule — inativa sempre vence', () => {
  it('regra inativa não gera mesmo dentro do horizonte', () => {
    expect(shouldMaterializeRule(rule({ isActive: false }), 3 as Month, 2026)).toBe(false);
    expect(
      shouldMaterializeRule(rule({ isActive: false, monthsAhead: 12 }), 5 as Month, 2026),
    ).toBe(false);
  });
});
