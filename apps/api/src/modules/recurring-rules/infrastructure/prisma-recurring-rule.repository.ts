import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Category,
  Month,
  RecurringRule,
  RecurringRuleInput,
  RecurringRuleUpdate,
} from '@valletcontrol/shared';
import type { Prisma, $Enums } from '../../../generated/prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RecurringRuleRepositoryPort } from '../application/ports/recurring-rule-repository.port';
import { EnumMapper } from './enum-mapper';

interface PrismaRecurringRuleRow {
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  type: $Enums.TransactionType;
  category: $Enums.Category;
  startMonth: number;
  startYear: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(row: PrismaRecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    ownerId: row.ownerId,
    description: row.description,
    amountCents: row.amountCents,
    type: EnumMapper.toSharedType(row.type),
    category: EnumMapper.toSharedCategory(row.category) as Category,
    startMonth: row.startMonth as Month,
    startYear: row.startYear,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Linha do domínio (type/categoria compartilhados) → dado bruto aceito pelo Prisma. */
function toDbData(
  input: RecurringRuleInput,
): Omit<Prisma.RecurringRuleCreateInput, 'owner' | 'ownerId'> {
  return {
    description: input.description,
    amountCents: input.amountCents,
    type: EnumMapper.toDbType(input.type),
    category: EnumMapper.toDbCategory(input.category),
    startMonth: input.startMonth,
    startYear: input.startYear,
    isActive: input.isActive ?? true,
  };
}

function toDbPatch(patch: RecurringRuleUpdate): Prisma.RecurringRuleUpdateInput {
  const data: Prisma.RecurringRuleUpdateInput = {};
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
    data.category = EnumMapper.toDbCategory(patch.category);
  }
  if (patch.isActive !== undefined) {
    data.isActive = patch.isActive;
  }
  return data;
}

/**
 * Adapter (driven) de persistência de regras recorrentes sobre Prisma.
 * Todo acesso é escopado por `ownerId` (RLS em nível de aplicação).
 */
@Injectable()
export class PrismaRecurringRuleRepository implements RecurringRuleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOwner(ownerId: string): Promise<RecurringRule[]> {
    const rows = await this.prisma.recurringRule.findMany({
      where: { ownerId },
      orderBy: [{ isActive: 'desc' }, { startYear: 'asc' }, { startMonth: 'asc' }],
    });
    return rows.map(toDomain);
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<RecurringRule | null> {
    const row = await this.prisma.recurringRule.findFirst({ where: { id, ownerId } });
    return row ? toDomain(row) : null;
  }

  async create(ownerId: string, input: RecurringRuleInput): Promise<RecurringRule> {
    const row = await this.prisma.recurringRule.create({
      data: { ...toDbData(input), owner: { connect: { id: ownerId } } },
    });
    return toDomain(row);
  }

  async updateByIdAndOwner(
    id: string,
    ownerId: string,
    patch: RecurringRuleUpdate,
  ): Promise<RecurringRule> {
    const existing = await this.prisma.recurringRule.findFirst({ where: { id, ownerId } });
    if (!existing) {
      throw new NotFoundException('Regra recorrente não encontrada.');
    }
    const row = await this.prisma.recurringRule.update({
      where: { id },
      data: toDbPatch(patch),
    });
    return toDomain(row);
  }

  async deleteByIdAndOwner(id: string, ownerId: string): Promise<void> {
    const deleted = await this.prisma.recurringRule.deleteMany({ where: { id, ownerId } });
    if (deleted.count === 0) {
      throw new NotFoundException('Regra recorrente não encontrada.');
    }
  }
}
