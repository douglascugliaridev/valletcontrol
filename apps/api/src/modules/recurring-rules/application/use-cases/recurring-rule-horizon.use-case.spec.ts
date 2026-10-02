import { Category, TransactionType } from '@walletcontrol/shared';
import type {
  Month,
  RecurringRule,
  RecurringRuleInput,
  RecurringRuleUpdate,
} from '@walletcontrol/shared';
import type { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';
import {
  CreateRecurringRuleUseCase,
  type CreateRecurringRuleInput,
} from './create-recurring-rule.use-case';
import { UpdateRecurringRuleUseCase } from './update-recurring-rule.use-case';

const ownerId = 'user-1';

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    ownerId,
    description: 'Aluguel',
    amountCents: 150_000,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    startMonth: 1 as Month,
    startYear: 2026,
    monthsAhead: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function mockRepo(existing: RecurringRule | null = makeRule()) {
  return {
    findAllByOwner: jest.fn().mockResolvedValue(existing ? [existing] : []),
    findByIdAndOwner: jest.fn().mockResolvedValue(existing),
    create: jest
      .fn()
      .mockImplementation((_owner: string, input: RecurringRuleInput) =>
        Promise.resolve(makeRule({ ...input, monthsAhead: input.monthsAhead ?? null })),
      ),
    updateByIdAndOwner: jest.fn().mockResolvedValue(makeRule()),
    deleteByIdAndOwner: jest.fn().mockResolvedValue(undefined),
  };
}

function baseInput(overrides: Partial<RecurringRuleInput> = {}): RecurringRuleInput {
  return {
    description: '  Aluguel  ',
    amountCents: 150_000,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    startMonth: 1 as Month,
    startYear: 2026,
    ...overrides,
  };
}

describe('CreateRecurringRuleUseCase', () => {
  it('repassa monthsAhead para o repositório', async () => {
    const repo = mockRepo(null);
    const useCase = new CreateRecurringRuleUseCase(repo as unknown as RecurringRuleRepositoryPort);
    const input: CreateRecurringRuleInput = {
      ownerId,
      input: baseInput({ monthsAhead: 12 }),
    };

    const result = await useCase.execute(input);

    expect(repo.create).toHaveBeenCalledWith(ownerId, expect.objectContaining({ monthsAhead: 12 }));
    expect(result.monthsAhead).toBe(12);
  });

  it('trata meses à frente ausente como sem prazo (null)', async () => {
    const repo = mockRepo(null);
    const useCase = new CreateRecurringRuleUseCase(repo as unknown as RecurringRuleRepositoryPort);

    const result = await useCase.execute({ ownerId, input: baseInput() });

    expect(repo.create).toHaveBeenCalledWith(
      ownerId,
      expect.objectContaining({ monthsAhead: null }),
    );
    expect(result.monthsAhead).toBeNull();
  });
});

describe('UpdateRecurringRuleUseCase', () => {
  it('repassa monthsAhead no patch', async () => {
    const repo = mockRepo();
    const useCase = new UpdateRecurringRuleUseCase(repo as unknown as RecurringRuleRepositoryPort);
    const patch: RecurringRuleUpdate = { monthsAhead: 6 };

    await useCase.execute({ ownerId, id: 'rule-1', patch });

    expect(repo.updateByIdAndOwner).toHaveBeenCalledWith('rule-1', ownerId, { monthsAhead: 6 });
  });

  it('permite voltar para sem prazo enviando null explícito', async () => {
    const repo = mockRepo();
    const useCase = new UpdateRecurringRuleUseCase(repo as unknown as RecurringRuleRepositoryPort);

    await useCase.execute({ ownerId, id: 'rule-1', patch: { monthsAhead: null } });

    expect(repo.updateByIdAndOwner).toHaveBeenCalledWith('rule-1', ownerId, { monthsAhead: null });
  });

  it('404 amigável quando a regra não existe', async () => {
    const repo = mockRepo(null);
    const useCase = new UpdateRecurringRuleUseCase(repo as unknown as RecurringRuleRepositoryPort);

    await expect(
      useCase.execute({ ownerId, id: 'nao-existe', patch: { monthsAhead: 3 } }),
    ).rejects.toThrow('Regra recorrente não encontrada.');
  });
});
