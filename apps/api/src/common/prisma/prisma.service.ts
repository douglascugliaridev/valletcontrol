import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Adaptador de banco (driven adapter) — encapsula o Prisma Client.
 * A camada de aplicação nunca depende desta classe, apenas dos ports.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const adapter = new PrismaPg({ connectionString: config.getOrThrow<string>('databaseUrl') });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao banco de dados.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
