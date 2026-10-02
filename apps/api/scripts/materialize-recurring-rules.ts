/**
 * Migração pontual: transforma as regras recorrentes que existiam no modelo antigo
 * (projeção calculada na leitura) em grupos materializados, gravando as transações
 * dos próximos meses.
 *
 * Sem isso, as regras antigas param de aparecer no relatório: a injeção de regras foi
 * removida de `ListMonthlyReportUseCase` justamente para não somar o valor duas vezes.
 *
 * Idempotente: uma regra que já tem transações materializadas é pulada, então rodar
 * duas vezes não duplica nada.
 *
 * Uso (a partir de `apps/api`, com `DATABASE_URL` do banco alvo):
 *   pnpm exec tsx scripts/materialize-recurring-rules.ts
 *   pnpm exec tsx scripts/materialize-recurring-rules.ts --months 12
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { addMonths } from '@walletcontrol/shared';
import type { Month } from '@walletcontrol/shared';

/** Lê `DATABASE_URL` do `.env` da raiz, como o prisma.config.ts faz. */
function databaseUrl(): string {
  const rootEnv = resolve(process.cwd(), '../../.env');
  if (existsSync(rootEnv)) {
    for (const line of readFileSync(rootEnv, 'utf8').split('\n')) {
      const m = /^DATABASE_URL=(.*)$/.exec(line.trim());
      if (m?.[1]) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;
  throw new Error('DATABASE_URL não encontrada (nem no .env da raiz, nem no ambiente).');
}

function monthsArg(): number {
  const i = process.argv.indexOf('--months');
  const value = i >= 0 ? Number(process.argv[i + 1]) : 12;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('--months deve ser um inteiro maior que zero.');
  }
  return value;
}

async function main() {
  const months = monthsArg();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl() }),
  });

  const rules = await prisma.recurringRule.findMany({
    include: { _count: { select: { transactions: true } } },
    orderBy: { startYear: 'asc' },
  });

  if (rules.length === 0) {
    console.log('Nenhuma regra recorrente encontrada — nada a fazer.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    if (rule._count.transactions > 0) {
      skipped += 1;
      console.log(
        `· "${rule.description}" já tem ${rule._count.transactions} lançamentos — pulada.`,
      );
      continue;
    }

    // monthsAhead null = regra antiga sem prazo. Usa o total informado na linha de comando.
    const total = rule.monthsAhead ?? months;
    const data = [];
    for (let offset = 0; offset < total; offset += 1) {
      const { month, year } = addMonths(rule.startMonth as Month, rule.startYear, offset);
      data.push({
        ownerId: rule.ownerId,
        description: rule.description,
        amountCents: rule.amountCents,
        type: rule.type,
        category: rule.category,
        paymentMethod: null,
        cardId: null,
        dueDate: null,
        month,
        year,
        // Só o mês inicial nasce marcado como pago: é o único que já "aconteceu".
        isPaid: offset === 0,
        recurringRuleId: rule.id,
      });
    }

    await prisma.$transaction([
      prisma.transaction.createMany({ data }),
      prisma.recurringRule.update({
        where: { id: rule.id },
        data: { monthsAhead: total },
      }),
    ]);
    created += 1;
    console.log(
      `✓ "${rule.description}" (${rule.startMonth}/${rule.startYear}) → ${total} lançamentos.`,
    );
  }

  console.log(`\nConcluído: ${created} regra(s) materializadas, ${skipped} pulada(s).`);
}

main()
  .catch((err) => {
    console.error('Falhou:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // encerra o pool do adapter
  });
