import ExcelJS from 'exceljs';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

type DbType = 'RECEITA' | 'DESPESA' | 'DEVEDOR';
type DbCategory = 'RECEITA' | 'CONTAS_FIXAS' | 'OUTROS' | 'DEVEDORES';
type DbPaymentMethod = 'NUBANK' | 'ITAUCARD';
type CardKey = 'nubank' | 'itaucard';
interface PlanEntry {
  description: string;
  amountCents: number;
  type: DbType;
  category: DbCategory | null;
  paymentMethod: DbPaymentMethod | null;
  cardKey: CardKey | null;
  month: number;
  year: number;
  isPaid: boolean;
  groupKey: string | null;
  source: string;
};
interface Manifest {
  version: 1;
  sourceFile: string;
  shiftMonths: 1;
  ownerEmail: string;
  ownerId: string;
  createdAt: string;
  createdCardIds: string[];
  createdTransactionIds: string[];
};
interface CellLike {
  value: unknown;
}
interface SheetLike {
  name: string;
  rowCount: number;
  getCell(row: number, column: number): CellLike;
};

const monthNames: Record<string, number> = {
  JAN: 1,
  FEV: 2,
  MAR: 3,
  ABR: 4,
  ABRI: 4,
  MAI: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SET: 9,
  OUT: 10,
  NOV: 11,
  DEZ: 12,
};

loadEnv();

function loadEnv(): void {
  const apiRoot = path.resolve(__dirname, '..');
  dotenv.config({ path: path.resolve(apiRoot, '../../.env') });
  dotenv.config({ path: path.resolve(apiRoot, '.env') });
}

function rawCell(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && 'result' in value) {
    return (value as { result: unknown }).result;
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join('');
  }
  return value;
}

function textValue(sheet: SheetLike, row: number, column: number): string {
  const value = rawCell(sheet.getCell(row, column).value);
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function numberValue(sheet: SheetLike, row: number, column: number): number | null {
  const value = rawCell(sheet.getCell(row, column).value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/R\$/i, '').replace(/\s/g, '');
  if (!normalized) return null;
  const parsed = normalized.includes(',') && !normalized.includes('.')
    ? Number(normalized.replace(',', '.'))
    : Number(normalized.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function paidValue(sheet: SheetLike, row: number, column: number): boolean {
  const value = textValue(sheet, row, column).toLowerCase();
  return ['x', 'sim', 'true', '1', 'pago', 'paga', 'yes', 'y', '✓'].includes(value);
}

function parseSheetMonth(name: string): { month: number; year: number } | null {
  const [monthName, yearText] = name.trim().split(/\s+/);
  if (!monthName) return null;
  const month = monthNames[monthName.toUpperCase()];
  const year = Number(yearText);
  return month && Number.isInteger(year) ? { month, year } : null;
}

function shiftMonth(month: number, year: number, amount: number): { month: number; year: number } {
  const zeroBased = year * 12 + month - 1 + amount;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

function parseInstallment(description: string): { description: string; groupKey: string } | null {
  const match = /^(\d+)-(\d+)\s+(.+)$/.exec(description);
  if (!match) return null;
  const installment = match[1];
  const total = match[2];
  const base = match[3];
  if (!installment || !total || !base) return null;
  return {
    description: `${installment}/${total} ${base.trim()}`,
    groupKey: `installment:${base.trim().toLowerCase()}`,
  };
}

function addEntry(
  entries: PlanEntry[],
  sheet: SheetLike,
  row: number,
  descriptionColumn: number,
  amountColumn: number,
  paidColumn: number,
  target: { month: number; year: number },
  values: {
    type: DbType;
    category: DbCategory | null;
    paymentMethod?: DbPaymentMethod | null;
    cardKey?: CardKey | null;
  },
): void {
  const rawDescription = textValue(sheet, row, descriptionColumn);
  const amount = numberValue(sheet, row, amountColumn);
  if (!rawDescription || rawDescription.toUpperCase() === 'TOTAL' || amount === null || amount <= 0) {
    return;
  }
  const installment = parseInstallment(rawDescription);
  const description = installment?.description ?? rawDescription;
  const groupKey = installment
    ? `${installment.groupKey}:${Math.round(amount * 100)}:${values.type}:${values.cardKey ?? values.category ?? ''}`
    : null;
  entries.push({
    description,
    amountCents: Math.round(amount * 100),
    type: values.type,
    category: values.category,
    paymentMethod: values.paymentMethod ?? null,
    cardKey: values.cardKey ?? null,
    month: target.month,
    year: target.year,
    isPaid: values.type === 'RECEITA' ? true : paidValue(sheet, row, paidColumn),
    groupKey,
    source: `${sheet.name}!${row}`,
  });
}

function parseSheet(sheet: SheetLike, entries: PlanEntry[]): void {
  const sourceMonth = parseSheetMonth(sheet.name);
  if (!sourceMonth) return;
  const target = shiftMonth(sourceMonth.month, sourceMonth.year, -1);
  for (let row = 5; row <= 22; row += 1) {
    addEntry(entries, sheet, row, 2, 3, 4, target, { type: 'DESPESA', category: 'CONTAS_FIXAS' });
    addEntry(entries, sheet, row, 5, 6, 7, target, {
      type: 'DESPESA',
      category: null,
      cardKey: 'nubank',
    });
    addEntry(entries, sheet, row, 8, 9, 10, target, {
      type: 'DESPESA',
      category: null,
      cardKey: 'itaucard',
    });
    addEntry(entries, sheet, row, 11, 12, 13, target, {
      type: 'DESPESA',
      category: 'OUTROS',
    });
  }
  addEntry(entries, sheet, 28, 2, 3, 3, target, { type: 'RECEITA', category: 'RECEITA' });
  let debtorMethod: CardKey | null = null;
  for (let row = 27; row <= sheet.rowCount; row += 1) {
    const label = textValue(sheet, row, 11);
    if (/^Devedores Nubank/i.test(label)) {
      debtorMethod = 'nubank';
      continue;
    }
    if (/^Devedores Itau/i.test(label)) {
      debtorMethod = 'itaucard';
      continue;
    }
    if (label.toUpperCase() === 'TOTAL') {
      debtorMethod = null;
      continue;
    }
    if (!debtorMethod) continue;
    addEntry(entries, sheet, row, 11, 12, 13, target, {
      type: 'DEVEDOR',
      category: 'DEVEDORES',
      paymentMethod: debtorMethod === 'nubank' ? 'NUBANK' : 'ITAUCARD',
      cardKey: debtorMethod,
    });
  }
}

async function readPlan(sourceFile: string): Promise<{ entries: PlanEntry[]; sheets: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourceFile);
  const entries: PlanEntry[] = [];
  const sheets: string[] = [];
  for (const worksheet of workbook.worksheets) {
    const sheet = worksheet as unknown as SheetLike;
    sheets.push(sheet.name);
    parseSheet(sheet, entries);
  }
  return { entries, sheets };
}

function printPlan(entries: PlanEntry[], sheets: string[]): void {
  const counts = entries.reduce<Record<string, number>>((result, entry) => {
    result[entry.type] = (result[entry.type] ?? 0) + 1;
    return result;
  }, {});
  const byMonth = entries.reduce<Record<string, number>>((result, entry) => {
    const key = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  const installmentGroups = new Set(entries.map((entry) => entry.groupKey).filter(Boolean));
  console.log(JSON.stringify({
    mode: 'dry-run',
    sourceFile: process.argv[process.argv.indexOf('--file') + 1],
    sheets,
    totalEntries: entries.length,
    byType: counts,
    byMonth,
    installmentGroups: installmentGroups.size,
    shiftMonths: 1,
  }, null, 2));
}

function createPrisma(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.');
  const sslDisabled = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false';
  const url = new URL(databaseUrl);
  if (sslDisabled) url.searchParams.delete('sslmode');
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ...(sslDisabled ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  return new PrismaClient({ adapter });
}

async function applyPlan(entries: PlanEntry[], sourceFile: string, ownerEmail: string): Promise<void> {
  const prisma = createPrisma();
  const normalizedEmail = ownerEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new Error(`Usuário não encontrado: ${normalizedEmail}`);
  const createdCardIds: string[] = [];
  const createdTransactionIds: string[] = [];
  const cardIds: Partial<Record<CardKey, string>> = {};
  const groupIds = new Map<string, string>();
  try {
    await prisma.$transaction(async (tx) => {
      for (const card of [
        { key: 'nubank' as const, name: 'Nubank', brand: 'NUBANK' as const, logo: '/api/cards/logos/nubank' },
        { key: 'itaucard' as const, name: 'Itaucard', brand: 'ITAUCARD' as const, logo: '/api/cards/logos/itaucard' },
      ]) {
        const existing = await tx.card.findFirst({ where: { ownerId: user.id, brand: card.brand } });
        if (existing) {
          cardIds[card.key] = existing.id;
          continue;
        }
        const created = await tx.card.create({
          data: {
            ownerId: user.id,
            name: card.name,
            brand: card.brand,
            logoUrl: card.logo,
            isDefault: card.key === 'nubank',
          },
        });
        cardIds[card.key] = created.id;
        createdCardIds.push(created.id);
      }
      for (const entry of entries) {
        let installmentGroupId: string | null = null;
        if (entry.groupKey) {
          const existingGroupId = groupIds.get(entry.groupKey);
          installmentGroupId = existingGroupId ?? randomUUID();
          groupIds.set(entry.groupKey, installmentGroupId);
        }
        const created = await tx.transaction.create({
          data: {
            ownerId: user.id,
            description: entry.description,
            amountCents: entry.amountCents,
            type: entry.type,
            category: entry.category,
            paymentMethod: entry.paymentMethod,
            cardId: entry.cardKey ? cardIds[entry.cardKey] ?? null : null,
            dueDate: null,
            month: entry.month,
            year: entry.year,
            isPaid: entry.isPaid,
            installmentGroupId,
          },
        });
        createdTransactionIds.push(created.id);
      }
    }, {
      maxWait: 10000,
      timeout: 120000,
    });
  } finally {
    await prisma.$disconnect();
  }
  const manifest: Manifest = {
    version: 1,
    sourceFile,
    shiftMonths: 1,
    ownerEmail: normalizedEmail,
    ownerId: user.id,
    createdAt: new Date().toISOString(),
    createdCardIds,
    createdTransactionIds,
  };
  const manifestDir = path.resolve(__dirname, '../../../imports');
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `spreadsheet-${Date.now()}.json`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ mode: 'applied', email: normalizedEmail, transactions: createdTransactionIds.length, cards: createdCardIds.length, manifest: manifestPath }, null, 2));
}

async function rollback(manifestPath: string): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
  const prisma = createPrisma();
  try {
    const transactions = await prisma.transaction.deleteMany({
      where: { ownerId: manifest.ownerId, id: { in: manifest.createdTransactionIds } },
    });
    const cards = await prisma.card.deleteMany({
      where: { ownerId: manifest.ownerId, id: { in: manifest.createdCardIds } },
    });
    console.log(JSON.stringify({ mode: 'rolled-back', transactions: transactions.count, cards: cards.count }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const rollbackPath = argValue('--rollback');
  if (rollbackPath) {
    if (!process.argv.includes('--confirm')) throw new Error('Use --confirm para confirmar o rollback.');
    await rollback(rollbackPath);
    return;
  }
  const sourceFile = argValue('--file');
  if (!sourceFile) throw new Error('Informe --file caminho/da/planilha.xlsx');
  const { entries, sheets } = await readPlan(sourceFile);
  printPlan(entries, sheets);
  if (!process.argv.includes('--apply')) return;
  const email = argValue('--email');
  if (!email) throw new Error('Use --email usuario@example.com ao aplicar.');
  if (!process.argv.includes('--confirm')) throw new Error('Use --confirm para confirmar a importação.');
  await applyPlan(entries, sourceFile, email);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
