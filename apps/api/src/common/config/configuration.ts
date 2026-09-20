/**
 * Configuração tipada da aplicação. Elege as variáveis de ambiente
 * necessárias e falha rápido em caso de ausência/valor inválido.
 */
export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  password: {
    saltRounds: number;
  };
  cors: {
    allowedOrigins: string[];
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function int(envName: string, fallback: number, name: string): number {
  const raw = process.env[envName];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `Variável de ambiente inválida ${envName}: "${raw}" não é um inteiro. (campo ${name})`,
    );
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    env: (process.env.NODE_ENV ?? 'development') as AppConfig['env'],
    port: int('API_PORT', 3001, 'port'),
    apiPrefix: required('API_PREFIX') ?? 'api',
    databaseUrl: required('DATABASE_URL'),
    jwt: {
      secret: required('JWT_SECRET'),
      expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    },
    password: {
      saltRounds: int('BCRYPT_SALT_ROUNDS', 10, 'saltRounds'),
    },
    cors: {
      allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
  };
}
