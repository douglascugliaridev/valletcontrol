import { Injectable } from '@nestjs/common';
import type {
  Month,
  PaymentMethod,
  Transaction,
  TransactionInput,
  TransactionQuery,
  TransactionUpdate,
} from '@valletcontrol/shared';
import type { Prisma, $Enums } from '../../../generated/prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotFoundError } from '../../../common/errors/app-errors';
import { TransactionRepositoryPort } from '../application/ports/transaction-repository.port';
import { EnumMapper } from './enum-mapper';

interface PrismaTransactionRow {
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  type: $Enums.TransactionType;
  category: $Enums.Category | null;
  paymentMethod: $Enums.PaymentMethod | null;
  cardId: string | null;
  dueDate: Date | null;
  month: number;
  year: number;
  isPaid: boolean;
  installmentGroupId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Data do Postgres (Date) para o formato ISO aceito no domínio. */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDomain(row: PrismaTransactionRow): Transaction {
  return {
    id: row.id,
    ownerId: row.ownerId,
    description: row.description,
    amountCents: row.amountCents,
    type: EnumMapper.toSharedType(row.type),
    category: row.category ? EnumMapper.toSharedCategory(row.category) : null,
    paymentMethod: row.paymentMethod
      ? (EnumMapper.toSharedMethod(row.paymentMethod) as PaymentMethod)
      : null,
    cardId: row.cardId,
    dueDate: row.dueDate ? toIsoDate(row.dueDate) : null,
    month: row.month as Month,
    year: row.year,
    isPaid: row.isPaid,
    installmentGroupId: row.installmentGroupId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDbDueDate(dueDate: string | null | undefined): Date | null {
  if (!dueDate) {
    return null;
  }
  const [year, month, day] = dueDate.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function toDbData(input: TransactionInput, ownerId: string): Prisma.TransactionCreateManyInput {
  return {
    ownerId,
    description: input.description,
    amountCents: input.amountCents,
    type: EnumMapper.toDbType(input.type),
    category: input.category ? EnumMapper.toDbCategory(input.category) : null,
    isPaid: input.isPaid ?? false,
    paymentMethod: input.paymentMethod ? EnumMapper.toDbMethod(input.paymentMethod) : null,
    cardId: input.cardId ?? null,
    dueDate: toDbDueDate(input.dueDate),
    month: input.month,
    year: input.year,
    installmentGroupId: input.installmentGroupId ?? null,
  };
}

function toDbPatch(patch: TransactionUpdate): Prisma.TransactionUpdateInput {
  const data: Prisma.TransactionUpdateInput = {};
  if (patch.description !== undefined) {
    data.description = patch.description;
  }
  if (patch.amountCents !== undefined) {
    data.amountCents = patch.amountCents;
  }
  if (patch.type !== undefined) {
    data.type = EnumMapper.toDbType(patch.type);
  }
  if (patch.category !== undefined) {
    data.category = patch.category ? EnumMapper.toDbCategory(patch.category) : null;
  }
  if (patch.isPaid !== undefined) {
    data.isPaid = patch.isPaid;
  }
  if ('paymentMethod' in patch) {
    data.paymentMethod = patch.paymentMethod ? EnumMapper.toDbMethod(patch.paymentMethod) : null;
  }
  if ('dueDate' in patch) {
    data.dueDate = toDbDueDate(patch.dueDate);
  }
  if (patch.month !== undefined) {
    data.month = patch.month;
  }
  if (patch.year !== undefined) {
    data.year = patch.year;
  }
  return data;
}

/**
 * Adapter (driven) de persistência de transações sobre Prisma.
 * Todo acesso é escopado por `ownerId` (RLS em nível de aplicação).
 */
@Injectable()
export class PrismaTransactionRepository implements TransactionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOwner(ownerId: string, query: TransactionQuery): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = { ownerId, month: query.month, year: query.year };

    if (query.search?.trim()) {
      where.description = { contains: query.search.trim(), mode: 'insensitive' };
    }
    if (query.type) {
      where.type = EnumMapper.toDbType(query.type);
    }
    if (query.category) {
      where.category = EnumMapper.toDbCategory(query.category);
    }
    if (query.isPaid !== undefined) {
      where.isPaid = query.isPaid;
    }

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map(toDomain);
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<Transaction | null> {
    const row = await this.prisma.transaction.findFirst({ where: { id, ownerId } });
    return row ? toDomain(row) : null;
  }

  async createMany(ownerId: string, items: TransactionInput[]): Promise<Transaction[]> {
    const rows = await this.prisma.transaction.createManyAndReturn({
      data: items.map((item) => toDbData(item, ownerId)),
    });
    return rows.map(toDomain);
  }

  async updateByIdAndOwner(
    id: string,
    ownerId: string,
    patch: TransactionUpdate,
  ): Promise<Transaction> {
    const existing = await this.prisma.transaction.findFirst({ where: { id, ownerId } });
    if (!existing) {
      throw new NotFoundError('Transação não encontrada.');
    }
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: toDbPatch(patch),
    });
    return toDomain(updated);
  }

  async deleteByIdAndOwner(id: string, ownerId: string): Promise<void> {
    const deleted = await this.prisma.transaction.deleteMany({ where: { id, ownerId } });
    if (deleted.count === 0) {
      throw new NotFoundError('Transação não encontrada.');
    }
  }

  async updateManyByInstallmentGroupAndOwner(
    groupId: string,
    ownerId: string,
    patch: TransactionUpdate,
  ): Promise<number> {
    const result = await this.prisma.transaction.updateMany({
      where: { installmentGroupId: groupId, ownerId },
      data: toDbPatch(patch),
    });
    return result.count;
  }

  async deleteManyByInstallmentGroupAndOwner(
    groupId: string,
    ownerId: string,
  ): Promise<number> {
    const result = await this.prisma.transaction.deleteMany({
      where: { installmentGroupId: groupId, ownerId },
    });
    return result.count;
  }
}
