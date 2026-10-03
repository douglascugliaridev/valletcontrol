import { Injectable, NotFoundException } from '@nestjs/common';
import type { Card, CardInput, CardUpdate } from '@walletcontrol/shared';
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
    return Promise.all(rows.map((row) => this.ensureBrandLogo(row))).then((cards) =>
      cards.map(toDomain),
    );
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<Card | null> {
    const row = await this.prisma.card.findFirst({ where: { id, ownerId } });
    return row ? toDomain(await this.ensureBrandLogo(row)) : null;
  }

  /**
   * Mantém o `logoUrl` do cartão coerente com a bandeira dele.
   *
   * Não basta preencher quando está vazio: cartões criados antes de `13a0ba3` guardam
   * paths de `/api/uploads/...`, que dejaram de existir junto com o upload em runtime. O
   * `if (row.logoUrl) return row` antigo confiava em qualquer valor, então esses cartões
   * ficavam com imagem quebrada para sempre. Aqui qualquer divergência entre o path
   * guardado e o da bandeira é reescrita — inclusive para `null` quando a bandeira não
   * tem logo, o que devolve o cartão ao ícone genérico.
   */
  private async ensureBrandLogo(row: PrismaCardRow): Promise<PrismaCardRow> {
    // O nome entra porque `CardBrand` não tem valor para um cartão como o Havan: ele é
    // OTHERS, e sem o nome não há como saber qual logo usar.
    const expected = installBrandLogo(row.brand, row.name);
    const current = row.logoUrl ?? null;
    if (current === expected) return row;
    return this.prisma.card.update({ where: { id: row.id }, data: { logoUrl: expected } });
  }

  async create(ownerId: string, input: CardInput): Promise<Card> {
    const row = await this.prisma.card.create({
      data: { ...toDbData(input), owner: { connect: { id: ownerId } } },
    });
    return toDomain(await this.ensureBrandLogo(row));
  }

  async updateByIdAndOwner(id: string, ownerId: string, patch: CardUpdate): Promise<Card> {
    const existing = await this.prisma.card.findFirst({ where: { id, ownerId } });
    if (!existing) {
      throw new NotFoundException('Cartão não encontrado.');
    }
    const data = toDbPatch(patch);
    // A logo é sempre derivada da bandeira, mesmo que o patch traga logoUrl: o
    // upload em runtime não existe mais (13a0ba3), então o bundle é a única fonte.
    delete data.logoUrl;
    const row = await this.prisma.card.update({ where: { id }, data });
    return toDomain(await this.ensureBrandLogo(row));
  }

  async deleteByIdAndOwner(id: string, ownerId: string): Promise<void> {
    const deleted = await this.prisma.card.deleteMany({ where: { id, ownerId } });
    if (deleted.count === 0) {
      throw new NotFoundException('Cartão não encontrado.');
    }
  }
}
