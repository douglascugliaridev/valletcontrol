import { Injectable, NotFoundException } from '@nestjs/common';
import type { Card, CardInput, CardUpdate } from '@valletcontrol/shared';
import type { Prisma } from '../../../generated/prisma/client';
import { CardBrandMapper } from './enum-mapper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { $Enums } from '../../../generated/prisma/client';
import { CardRepositoryPort } from '../application/ports/card-repository.port';
import { installBrandLogo } from './uploads';

interface PrismaCardRow {
  id: string;
  ownerId: string;
  name: string;
  brand: $Enums.CardBrand;
  last4: string | null;
  color: string | null;
  logoUrl: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(row: PrismaCardRow): Card {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    brand: CardBrandMapper.toShared(row.brand),
    last4: row.last4,
    color: row.color,
    logoUrl: row.logoUrl,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Linha do domínio (brand compartilhada) → dado bruto aceito pelo Prisma. */
function toDbData(input: CardInput): Omit<Prisma.CardCreateInput, 'owner' | 'ownerId'> {
  return {
    name: input.name,
    brand: CardBrandMapper.toDb(input.brand),
    last4: input.last4 ?? null,
    color: input.color ?? null,
    logoUrl: input.logoUrl ?? null,
    isDefault: input.isDefault ?? false,
  };
}

function toDbPatch(patch: CardUpdate): Prisma.CardUpdateInput {
  const data: Prisma.CardUpdateInput = {};
  if (patch.name !== undefined) {
    data.name = patch.name;
  }
  if (patch.brand !== undefined) {
    data.brand = CardBrandMapper.toDb(patch.brand);
  }
  if ('last4' in patch) {
    data.last4 = patch.last4 ?? null;
  }
  if ('color' in patch) {
    data.color = patch.color ?? null;
  }
  if ('logoUrl' in patch) {
    data.logoUrl = patch.logoUrl ?? null;
  }
  if (patch.isDefault !== undefined) {
    data.isDefault = patch.isDefault;
  }
  return data;
}

@Injectable()
export class PrismaCardRepository implements CardRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOwner(ownerId: string): Promise<Card[]> {
    const rows = await this.prisma.card.findMany({
      where: { ownerId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toDomain);
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<Card | null> {
    const row = await this.prisma.card.findFirst({ where: { id, ownerId } });
    return row ? toDomain(row) : null;
  }

  async create(ownerId: string, input: CardInput): Promise<Card> {
    const row = await this.prisma.card.create({
      data: { ...toDbData(input), owner: { connect: { id: ownerId } } },
    });
    if (!row.logoUrl) {
      const logoUrl = installBrandLogo(row.id, row.brand);
      if (logoUrl) {
        const updated = await this.prisma.card.update({
          where: { id: row.id },
          data: { logoUrl },
        });
        return toDomain(updated);
      }
    }
    return toDomain(row);
  }

  async updateByIdAndOwner(id: string, ownerId: string, patch: CardUpdate): Promise<Card> {
    const existing = await this.prisma.card.findFirst({ where: { id, ownerId } });
    if (!existing) {
      throw new NotFoundException('Cartão não encontrado.');
    }
    const row = await this.prisma.card.update({
      where: { id },
      data: toDbPatch(patch),
    });
    return toDomain(row);
  }

  async deleteByIdAndOwner(id: string, ownerId: string): Promise<void> {
    const deleted = await this.prisma.card.deleteMany({ where: { id, ownerId } });
    if (deleted.count === 0) {
      throw new NotFoundException('Cartão não encontrado.');
    }
  }
}
