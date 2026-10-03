import { Category, TransactionType, addMonths } from '@walletcontrol/shared';
import type { Month, RecurringRule, Transaction } from '@walletcontrol/shared';
import { ApplyRecurringRuleScopeUseCase } from './apply-recurring-rule-scope.use-case';
import { DeleteRecurringRuleScopeUseCase } from './delete-recurring-rule-scope.use-case';
import { ExtendRecurringRuleUseCase } from './extend-recurring-rule.use-case';
import { MaterializeRecurringRuleUseCase } from './materialize-recurring-rule.use-case';
import type { MaterializeRecurringRuleInput } from './materialize-recurring-rule.use-case';
import type { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';
import type { TransactionRepositoryPort } from '../../../transactions/application/ports/transaction-repository.port';
import type { CardRepositoryPort } from '../../../cards/application/ports/card-repository.port';

const ownerId = 'user-1';

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    ownerId,
    description: 'Aluguel',
    amountCents: 120_000,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    startMonth: 11 as Month,
    startYear: 2026,
    monthsAhead: 12,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Port de regras em memória — o suficiente para exercitar os use cases. */
function ruleRepo(existing: RecurringRule | null) {
  const state = { rule: existing };
  return {
    state,
    findAllByOwner: jest.fn().mockResolvedValue(state.rule ? [state.rule] : []),
    findByIdAndOwner: jest.fn().mockResolvedValue(state.rule),
    create: jest.fn().mockImplementation((_owner: string, input) => {
      state.rule = makeRule({ ...input, id: 'rule-1' } as Partial<RecurringRule>);
      return Promise.resolve(state.rule);
    }),
    updateByIdAndOwner: jest.fn().mockImplementation((_id, _owner, patch) => {
      if (!state.rule) throw new Error('regra ausente');
      state.rule = { ...state.rule, ...patch };
      return Promise.resolve(state.rule);
    }),
    deleteByIdAndOwner: jest.fn().mockImplementation(() => {
      state.rule = null;
      return Promise.resolve();
    }),
  };
}

/** Port de transações: grava em memória para inspecionar os meses gerados. */
function txRepo() {
  const state = { rows: [] as Transaction[] };
  return {
    state,
    findAllByOwner: jest.fn().mockResolvedValue([]),
    findByIdAndOwner: jest.fn().mockResolvedValue(null),
    createMany: jest.fn().mockImplementation((owner: string, items: Transaction[]) => {
      const created = items.map((item: Transaction, i: number) => ({
        ...item,
        id: `t${state.rows.length + i + 1}`,
        ownerId: owner,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }));
      state.rows.push(...created);
      return Promise.resolve(created);
    }),
    updateByIdAndOwner: jest.fn(),
    deleteByIdAndOwner: jest.fn(),
    updateManyByInstallmentGroupAndOwner: jest.fn(),
    deleteManyByInstallmentGroupAndOwner: jest.fn(),
    findManyByRecurringRuleFrom: jest.fn((ruleId, _owner, year, month) => {
      const rows = state.rows
        .filter((r) => r.recurringRuleId === ruleId)
        .filter((r) => r.year > year || (r.year === year && r.month >= month))
        .sort((a, b) => a.year - b.year || a.month - b.month);
      return Promise.resolve(rows);
    }),
    // Reproduz a semântica do Prisma, `protectPaid` inclusive: um fake que ignora a
    // proteção passaria o teste verde enquanto a API reescreve pagamento em produção.
    updateManyByRecurringRuleFrom: jest.fn((ruleId, _owner, year, month, patch, opts) => {
      let changed = 0;
      for (const r of state.rows) {
        if (r.recurringRuleId !== ruleId) continue;
        if (!(r.year > year || (r.year === year && r.month >= month))) continue;
        if (opts?.protectPaid && r.isPaid) continue;
        Object.assign(r, patch);
        changed += 1;
      }
      return Promise.resolve(changed);
    }),
    countPaidByRecurringRuleFrom: jest.fn((ruleId, _owner, year, month) => {
      return Promise.resolve(
        state.rows.filter(
          (r) =>
            r.recurringRuleId === ruleId &&
            r.isPaid &&
            (r.year > year || (r.year === year && r.month >= month)),
        ).length,
      );
    }),
    deleteManyUnpaidByRecurringRuleFrom: jest.fn((ruleId, _owner, year, month) => {
      const keep = state.rows.filter((r) => {
        if (r.recurringRuleId !== ruleId) return true;
        if (r.isPaid) return true;
        return !(r.year > year || (r.year === year && r.month >= month));
      });
      const deleted = state.rows.length - keep.length;
      state.rows = keep;
      return Promise.resolve(deleted);
    }),
    countTransactionsOfRule: jest.fn((ruleId) =>
      Promise.resolve(state.rows.filter((r) => r.recurringRuleId === ruleId).length),
    ),
  };
}

const cardRepo = { findByIdAndOwner: jest.fn() };

function seed(): MaterializeRecurringRuleInput['seed'] {
  return {
    description: 'Aluguel',
    amountCents: 120_000,
    type: TransactionType.EXPENSE,
    category: Category.FIXED_EXPENSES,
    month: 11 as Month,
    year: 2026,
    dueDate: null,
  };
}

describe('MaterializeRecurringRuleUseCase', () => {
  it('materializa N transações, uma por mês, com a regra como âncora', async () => {
    const rules = ruleRepo(null);
    const txs = txRepo();
    const useCase = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );

    const result = await useCase.execute({ ownerId, months: 12, seed: seed() });

    expect(result.transactions).toHaveLength(12);
    expect(result.rule.monthsAhead).toBe(12);
    expect(result.transactions[0]).toMatchObject({ year: 2026, month: 11 });
    expect(result.transactions[11]).toMatchObject({ year: 2027, month: 10 });
    // todas pertencem ao mesmo grupo
    expect(new Set(result.transactions.map((t) => t.recurringRuleId)).size).toBe(1);
  });

  it('só o mês de referência herda o "pago"; os futuros nascem pendentes', async () => {
    const rules = ruleRepo(null);
    const txs = txRepo();
    const useCase = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );

    const result = await useCase.execute({ ownerId, months: 3, seed: { ...seed(), isPaid: true } });

    expect(result.transactions[0]?.isPaid).toBe(true);
    expect(result.transactions[1]?.isPaid).toBe(false);
    expect(result.transactions[2]?.isPaid).toBe(false);
  });

  it('months = 1 gera apenas a transação daquele mês', async () => {
    const rules = ruleRepo(null);
    const txs = txRepo();
    const useCase = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );

    const result = await useCase.execute({ ownerId, months: 1, seed: seed() });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({ year: 2026, month: 11 });
  });

  it('atravessa a virada de ano', async () => {
    const rules = ruleRepo(null);
    const txs = txRepo();
    const useCase = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );

    const result = await useCase.execute({
      ownerId,
      months: 2,
      seed: { ...seed(), month: 12 as Month, year: 2026 },
    });

    expect(result.transactions.map((t) => `${t.year}-${t.month}`)).toEqual(['2026-12', '2027-1']);
  });

  it('materializa receita recorrente — um salário não tem caminho no formulário do dashboard', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const result = await new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    ).execute({
      ownerId,
      months: 4,
      seed: {
        ...seed(),
        description: 'Salário',
        type: TransactionType.INCOME,
        category: Category.INCOME,
        month: 10 as Month,
        year: 2026,
        isPaid: true,
      },
    });

    expect(result.rule.type).toBe(TransactionType.INCOME);
    expect(result.rule.monthsAhead).toBe(4);
    expect(result.transactions).toHaveLength(4);
    // os quatro meses são receita, e só o de referência herda o "recebido"
    expect(result.transactions.every((t) => t.type === TransactionType.INCOME)).toBe(true);
    expect(result.transactions.map((t) => t.isPaid)).toEqual([true, false, false, false]);
  });

  it('semente inválida não deixa regra órfã na lista', async () => {
    const rules = ruleRepo(null);
    const txs = txRepo();
    // receita com categoria de despesa: o domínio recusa com CATEGORY_TYPE_MISMATCH
    await expect(
      new MaterializeRecurringRuleUseCase(
        rules as unknown as RecurringRuleRepositoryPort,
        txs as unknown as TransactionRepositoryPort,
        cardRepo as unknown as CardRepositoryPort,
      ).execute({
        ownerId,
        months: 3,
        seed: {
          ...seed(),
          type: TransactionType.INCOME,
          category: Category.FIXED_EXPENSES,
        },
      }),
    ).rejects.toThrow();

    // A regra não pode ter sido criada: validando depois do `rules.create`, ela
    // aparecia em Configurações com "0 lançamentos".
    expect(rules.create).not.toHaveBeenCalled();
  });

  it('falha ao gravar os lançamentos remove a regra recem-criada', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    txs.createMany.mockRejectedValueOnce(new Error('banco indisponível'));

    await expect(
      new MaterializeRecurringRuleUseCase(
        rules as unknown as RecurringRuleRepositoryPort,
        txs as unknown as TransactionRepositoryPort,
        cardRepo as unknown as CardRepositoryPort,
      ).execute({ ownerId, months: 3, seed: seed() }),
    ).rejects.toThrow('banco indisponível');

    expect(rules.deleteByIdAndOwner).toHaveBeenCalled();
  });

  it('rejeita despesa com cartão inconsistente com a bandeira', async () => {
    const rules = ruleRepo(null);
    const txs = txRepo();
    const cards = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ brand: 'nubank' }),
    };
    const useCase = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cards as unknown as CardRepositoryPort,
    );

    await expect(
      useCase.execute({
        ownerId,
        months: 2,
        seed: {
          ...seed(),
          type: TransactionType.DEBTOR,
          category: Category.DEBTORS,
          paymentMethod: 'itaucard',
        } as never,
      }),
    ).rejects.toThrow();
  });
});

describe('ApplyRecurringRuleScopeUseCase', () => {
  it('aplica o patch do mês de referência em diante e não toca o passado', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 12, seed: seed() });

    const useCase = new ApplyRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );
    const result = await useCase.execute({
      ownerId,
      ruleId: 'rule-1',
      fromMonth: 2 as Month,
      fromYear: 2027,
      patch: { amountCents: 130_000 },
    });

    // nov/2026 e dez/2026 intactos; jan/2027 em diante alterados (9 de 12)
    expect(result.changed).toBe(9);
    const nov = txs.state.rows.find((r) => r.year === 2026 && r.month === 11);
    const dez = txs.state.rows.find((r) => r.year === 2026 && r.month === 12);
    const fev = txs.state.rows.find((r) => r.year === 2027 && r.month === 2);
    expect(nov?.amountCents).toBe(120_000);
    expect(dez?.amountCents).toBe(120_000);
    expect(fev?.amountCents).toBe(130_000);
  });

  it('protege lançamento PAGO: editar a conta à frente não reescreve o pagamento', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 12, seed: seed() });

    // o usuário pagou o mês de referência (nov/2026) e deixa os futuros pendentes
    for (const r of txs.state.rows) {
      if (r.year === 2026 && r.month === 11) r.isPaid = true;
    }

    const result = await new ApplyRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    ).execute({
      ownerId,
      ruleId: 'rule-1',
      fromMonth: 11 as Month,
      fromYear: 2026,
      patch: { amountCents: 130_000 },
    });

    const nov = txs.state.rows.find((r) => r.year === 2026 && r.month === 11);
    const dez = txs.state.rows.find((r) => r.year === 2026 && r.month === 12);
    // o pago continua com o valor que foi realmente pago
    expect(nov?.amountCents).toBe(120_000);
    expect(dez?.amountCents).toBe(130_000);
    // 11 pendentes alterados (12 meses − o pago), e o front é avisado do que ficou
    expect(result.changed).toBe(11);
    expect(result.keptPaid).toBe(1);
  });

  it('marcar os meses à frente como pagos alcança as linhas pendentes', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 4, seed: seed() });

    const result = await new ApplyRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    ).execute({
      ownerId,
      ruleId: 'rule-1',
      fromMonth: 11 as Month,
      fromYear: 2026,
      patch: { isPaid: true },
    });

    // patch só sobre pagamento: não há o que proteger, senão a ação viraria no-op
    expect(result.changed).toBe(4);
    expect(result.keptPaid).toBe(0);
    expect(txs.state.rows.every((r) => r.isPaid)).toBe(true);
  });

  it('ignora month/year do patch — são a âncora do escopo', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 3, seed: seed() });

    const useCase = new ApplyRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );
    await useCase.execute({
      ownerId,
      ruleId: 'rule-1',
      fromMonth: 11 as Month,
      fromYear: 2026,
      patch: { amountCents: 99_000, month: 5 as Month, year: 2030 },
    });

    // nenhum mês virou 2030
    expect(txs.state.rows.every((r) => r.year < 2028)).toBe(true);
    expect(txs.state.rows.every((r) => r.amountCents === 99_000)).toBe(true);
  });

  it('404 amigável para regra de outro dono', async () => {
    const rules = ruleRepo(null);
    const txs = txRepo();
    const useCase = new ApplyRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );

    await expect(
      useCase.execute({
        ownerId,
        ruleId: 'nao-existe',
        fromMonth: 1 as Month,
        fromYear: 2027,
        patch: { amountCents: 1 },
      }),
    ).rejects.toThrow('Regra de conta fixa não encontrada.');
  });
});

describe('ExtendRecurringRuleUseCase', () => {
  it('acrescenta meses depois do último já gravado', async () => {
    const rules = ruleRepo(makeRule({ monthsAhead: 3 }));
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 3, seed: seed() });

    const useCase = new ExtendRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );
    const result = await useCase.execute({ ownerId, ruleId: 'rule-1', months: 2 });

    expect(result.added).toBe(2);
    // nov/2026, dez/2026, jan/2027 + fev, mar/2027
    expect(txs.state.rows.map((r) => `${r.year}-${r.month}`)).toEqual([
      '2026-11',
      '2026-12',
      '2027-1',
      '2027-2',
      '2027-3',
    ]);
    expect(rules.state.rule?.monthsAhead).toBe(5);
  });

  it('recusa estender regra sem meses definidos', async () => {
    const rules = ruleRepo(makeRule({ monthsAhead: null }));
    const txs = txRepo();
    const useCase = new ExtendRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );

    await expect(useCase.execute({ ownerId, ruleId: 'rule-1', months: 3 })).rejects.toThrow(
      'não tem meses definidos',
    );
  });
});

describe('DeleteRecurringRuleScopeUseCase', () => {
  it('exclui do mês de referência em diante, preservando o passado', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 12, seed: seed() });

    const useCase = new DeleteRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );
    const result = await useCase.execute({
      ownerId,
      ruleId: 'rule-1',
      fromMonth: 3 as Month,
      fromYear: 2027,
    });

    // nov/26, dez/26, jan/27 e fev/27 ficam; mar/27 em diante (8 meses) saem
    expect(result.deleted).toBe(8);
    expect(result.ruleRemoved).toBe(false);
    expect(txs.state.rows.map((r) => `${r.year}-${r.month}`)).toEqual([
      '2026-11',
      '2026-12',
      '2027-1',
      '2027-2',
    ]);
  });

  it('nunca apaga um lançamento PAGO que esteja dentro do escopo', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 4, seed: seed() });
    // dez/2026 pago, e o escopo começa em nov/2026 — o pago está DENTRO do recorte
    for (const r of txs.state.rows) {
      if (r.year === 2026 && r.month === 12) r.isPaid = true;
    }

    const result = await new DeleteRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    ).execute({
      ownerId,
      ruleId: 'rule-1',
      fromMonth: 11 as Month,
      fromYear: 2026,
    });

    const remaining = txs.state.rows.filter((r) => r.recurringRuleId === 'rule-1');
    // meses: nov, dez, jan, fev/2027. Escopo de nov/2026 cobre os 4; dez é pago e fica,
    // então saem os 3 pendentes (nov, jan, fev). out/2026 está fora do escopo.
    expect(result.deleted).toBe(3);
    expect(result.keptPaid).toBe(1);
    expect(remaining.some((r) => r.year === 2026 && r.month === 12 && r.isPaid)).toBe(true);
    // sobrou transação do grupo, então a regra permanece
    expect(result.ruleRemoved).toBe(false);
  });

  it('remove a regra quando o grupo fica sem nenhuma transação', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 2, seed: seed() });

    const useCase = new DeleteRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );
    const result = await useCase.execute({
      ownerId,
      ruleId: 'rule-1',
      fromMonth: 11 as Month,
      fromYear: 2026,
    });

    expect(result.deleted).toBe(2);
    expect(result.ruleRemoved).toBe(true);
    expect(rules.deleteByIdAndOwner).toHaveBeenCalled();
  });

  it('não toca transações de outro grupo', async () => {
    const rules = ruleRepo(makeRule());
    const txs = txRepo();
    const create = new MaterializeRecurringRuleUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
      cardRepo as unknown as CardRepositoryPort,
    );
    await create.execute({ ownerId, months: 3, seed: seed() });

    // grupo irmão, gravado direto no repositório
    txs.state.rows.push({
      ...txs.state.rows[0]!,
      id: 'irma',
      recurringRuleId: 'outra-regra',
    });

    const useCase = new DeleteRecurringRuleScopeUseCase(
      rules as unknown as RecurringRuleRepositoryPort,
      txs as unknown as TransactionRepositoryPort,
    );
    await useCase.execute({ ownerId, ruleId: 'rule-1', fromMonth: 11 as Month, fromYear: 2026 });

    expect(txs.state.rows.map((r) => r.id)).toEqual(['irma']);
  });
});

// A aritmética de mês da materialização e da extensão vem de `addMonths` do shared;
// este teste fixa o contrato para que uma refatoração não quebre a virada de ano.
describe('aritmética de mês das contas fixas', () => {
  it('addMonths cobre virada de ano nos dois sentidos', () => {
    expect(addMonths(11, 2026, 1)).toEqual({ month: 12, year: 2026 });
    expect(addMonths(12, 2026, 1)).toEqual({ month: 1, year: 2027 });
    expect(addMonths(11, 2026, 12)).toEqual({ month: 11, year: 2027 });
  });
});
