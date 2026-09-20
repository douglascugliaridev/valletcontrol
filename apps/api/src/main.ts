import { Logger, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { resolveUploadsDir, uploadsPrefix } from './modules/cards/infrastructure/uploads';

/** Configura pipes/filtros/decorators globais da aplicação. */
function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(app.get(ConfigService).getOrThrow<string>('apiPrefix'));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  configureApp(app);

  app.useStaticAssets(resolveUploadsDir(), {
    prefix: `/${uploadsPrefix(config.getOrThrow<string>('apiPrefix'))}`,
    setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*'),
  });

  app.enableCors({
    origin: config.get<string[]>('cors.allowedOrigins'),
    credentials: true,
  });

  const port = config.getOrThrow<number>('port');
  await app.listen(port);
  new Logger('Bootstrap').log(
    `API valletcontrol rodando em http://localhost:${port}/${config.getOrThrow<string>('apiPrefix')}`,
  );
}

void bootstrap();
