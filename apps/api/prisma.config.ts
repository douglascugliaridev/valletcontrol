import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const cwd = process.cwd();
const rootEnvPath = path.resolve(cwd, '../../.env');
const localEnvPath = path.resolve(cwd, '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
