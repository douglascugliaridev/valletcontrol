import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './common/auth/guard/jwt-auth.guard';
import { loadConfig } from './common/config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { HealthController } from './modules/health/health.controller';
import { RecurringRulesModule } from './modules/recurring-rules/recurring-rules.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    AuthModule,
    CardsModule,
    RecurringRulesModule,
    TransactionsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guard global de autenticação (permite @Public() em rotas abertas).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
