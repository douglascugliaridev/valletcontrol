import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../../common/auth/jwt.strategy';
import { TokenServicePort } from './application/ports/token-service.port';
import { PasswordHasherPort } from './application/ports/password-hasher.port';
import { UserRepositoryPort } from './application/ports/user-repository.port';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher';
import { AuthController } from './ui/auth.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: { expiresIn: config.getOrThrow<string>('jwt.expiresIn') } as JwtSignOptions,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    RegisterUseCase,
    LoginUseCase,
    GetMeUseCase,
    { provide: UserRepositoryPort, useClass: PrismaUserRepository },
    { provide: PasswordHasherPort, useClass: ScryptPasswordHasher },
    { provide: TokenServicePort, useClass: JwtTokenService },
  ],
  exports: [UserRepositoryPort, PasswordHasherPort, TokenServicePort],
})
export class AuthModule {}
