import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

function withoutSslMode(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return url.toString();
}

/**
 * Adaptador de banco (driven adapter) — encapsula o Prisma Client.
 * A camada de aplicação nunca depende desta classe, apenas dos ports.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const databaseUrl = config.getOrThrow<string>('databaseUrl');
    const sslRejectUnauthorized = config.get<boolean | undefined>('databaseSslRejectUnauthorized');
    const connectionString =
      sslRejectUnauthorized === false ? withoutSslMode(databaseUrl) : databaseUrl;
    const adapter = new PrismaPg({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ...(sslRejectUnauthorized === false
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    });
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
