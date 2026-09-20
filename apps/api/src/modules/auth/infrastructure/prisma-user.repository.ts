import { Injectable } from '@nestjs/common';
import type { NewUser, User } from '@valletcontrol/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { UserWithPasswordHash } from '../application/ports/user-repository.port';
import { UserRepositoryPort } from '../application/ports/user-repository.port';

interface PrismaUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(user: PrismaUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Adapter (driven) de persistência de usuários sobre Prisma. */
@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithPasswordHash | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }
    return { ...toDomain(user), passwordHash: user.passwordHash };
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toDomain(user) : null;
  }

  async create(data: NewUser): Promise<User> {
    const user = await this.prisma.user.create({ data });
    return toDomain(user);
  }
}
