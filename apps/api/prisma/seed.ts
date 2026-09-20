import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { installBrandLogo } from '../src/modules/cards/infrastructure/uploads';

const cwd = process.cwd();
if (fs.existsSync(path.resolve(cwd, '../../.env'))) {
  dotenv.config({ path: path.resolve(cwd, '../../.env') });
}
dotenv.config({ path: path.resolve(cwd, '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL não definida. Verifique o .env.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** Hash scrypt compatível com o PasswordHasher de produção (salt = Buffer de 16 bytes). */
async function hashPassword(plain: string, salt = crypto.randomBytes(16)): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(plain, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`);
    });
  });
}

async function main() {
  const email = 'demo@valletcontrol.app';
  const passwordHash = await hashPassword('senha-segura-123');

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'Usuário Demo', passwordHash },
    create: { name: 'Usuário Demo', email, passwordHash },
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  interface SeedTransaction {
    description: string;
    amountCents: number;
    type: 'RECEITA' | 'DESPESA' | 'DEVEDOR';
    category: 'RECEITA' | 'CONTAS_FIXAS' | 'OUTROS' | 'DEVEDORES' | null;
    paymentMethod?: 'NUBANK' | 'ITAUCARD' | null;
    cardId?: string | null;
    dueDate: Date;
    isPaid?: boolean;
  }

  const [nubankCard, itaucardCard] = [
    await prisma.card.upsert({
      where: { id: `${user.id}-cartao-nubank` },
      update: {},
      create: {
        id: `${user.id}-cartao-nubank`,
        ownerId: user.id,
        name: 'Nubank',
        brand: 'NUBANK',
        last4: '4321',
        color: '#8b5cf6',
        isDefault: true,
      },
    }),
    await prisma.card.upsert({
      where: { id: `${user.id}-cartao-itaucard` },
      update: {},
      create: {
        id: `${user.id}-cartao-itaucard`,
        ownerId: user.id,
        name: 'Itaucard',
        brand: 'ITAUCARD',
        last4: '9876',
        color: '#f59e0b',
        isDefault: false,
      },
    }),
  ];

  for (const card of [nubankCard, itaucardCard]) {
    if (card.logoUrl) continue;
    const logoUrl = installBrandLogo(card.id, card.brand);
    if (logoUrl) {
      await prisma.card.update({ where: { id: card.id }, data: { logoUrl } });
    }
  }

  const transactions: SeedTransaction[] = [
    {
      description: 'Salário',
      amountCents: 4500_00,
      type: 'RECEITA',
      category: 'RECEITA',
      dueDate: new Date(year, month - 1, 5),
      isPaid: true,
    },
    {
      description: 'Freela projeto X',
      amountCents: 1200_00,
      type: 'RECEITA',
      category: 'RECEITA',
      dueDate: new Date(year, month - 1, 15),
    },
    {
      description: 'Aluguel',
      amountCents: 1800_00,
      type: 'DESPESA',
      category: 'CONTAS_FIXAS',
      dueDate: new Date(year, month - 1, 10),
      isPaid: true,
    },
    {
      description: 'Conta de luz',
      amountCents: 320_00,
      type: 'DESPESA',
      category: 'CONTAS_FIXAS',
      dueDate: new Date(year, month - 1, 12),
      isPaid: true,
    },
    {
      description: 'Internet',
      amountCents: 120_00,
      type: 'DESPESA',
      category: 'CONTAS_FIXAS',
      dueDate: new Date(year, month - 1, 20),
    },
    {
      description: 'Mercado',
      amountCents: 540_00,
      type: 'DESPESA',
      category: null,
      cardId: nubankCard.id,
      dueDate: new Date(year, month - 1, 3),
      isPaid: true,
    },
    {
      description: 'Combustível',
      amountCents: 280_00,
      type: 'DESPESA',
      category: null,
      cardId: itaucardCard.id,
      dueDate: new Date(year, month - 1, 25),
      isPaid: true,
    },
    {
      description: 'Pizza com amigos',
      amountCents: 180_00,
      type: 'DESPESA',
      category: 'OUTROS',
      dueDate: new Date(year, month - 1, 22),
    },
    {
      description: 'Compra Notebook',
      amountCents: 3500_00,
      type: 'DEVEDOR',
      category: 'DEVEDORES',
      paymentMethod: 'ITAUCARD',
      dueDate: new Date(year, month - 1, 27),
    },
    {
      description: 'Venda Xbox',
      amountCents: 900_00,
      type: 'DEVEDOR',
      category: 'DEVEDORES',
      paymentMethod: 'NUBANK',
      dueDate: new Date(year, month - 1, 30),
      isPaid: true,
    },
  ];

  for (const tx of transactions) {
    await prisma.transaction.upsert({
      where: { id: `${user.id}-${tx.description}` },
      update: {},
      create: {
        id: `${user.id}-${tx.description}`,
        ownerId: user.id,
        description: tx.description,
        amountCents: tx.amountCents,
        type: tx.type,
        category: tx.category,
        paymentMethod: tx.paymentMethod ?? null,
        cardId: tx.cardId ?? null,
        dueDate: tx.dueDate,
        month,
        year,
        isPaid: tx.isPaid ?? false,
      },
    });
  }

  await prisma.$disconnect();
  console.log(
    `Seed concluído: usuário ${user.email} com 10 transações e 2 cartões em ${month}/${year}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
