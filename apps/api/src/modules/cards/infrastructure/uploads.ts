import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Logos que existem no bundle. A chave é o arquivo em `prisma/logos`. */
export const BRAND_SLUGS = ['nubank', 'itaucard', 'havan'] as const;
export type BrandSlug = (typeof BRAND_SLUGS)[number];

/**
 * Logos que não são de uma bandeira do enum, e sim de um cartão específico.
 *
 * `CardBrand` só tem NUBANK/ITAUCARD/OTHERS, então um cartão Havan entra como OTHERS:
 * não há onde guardar a identidade dele. O nome é o único sinal disponível, e o
 * usuário digita o nome do cartão como quiser — "Havan", "havan", "Cartão Havan" — daí
 * a comparação por "contém" em vez de igualdade exata.
 */
const NAME_LOGOS: readonly { needle: string; slug: BrandSlug }[] = [
  { needle: 'havan', slug: 'havan' },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Logo de um cartão: a bandeira decide quando ela tem logo própria; senão o nome
 * resolve. A bandeira tem precedência — um cartão chamado "Havan" cadastrado como
 * Nubank é um Nubank.
 */
function brandLogoSlug(
  brand: 'NUBANK' | 'ITAUCARD' | 'OTHERS',
  name?: string | null,
): BrandSlug | null {
  switch (brand) {
    case 'NUBANK':
      return 'nubank';
    case 'ITAUCARD':
      return 'itaucard';
    default: {
      const key = name ? normalize(name) : '';
      return NAME_LOGOS.find(({ needle }) => key.includes(needle))?.slug ?? null;
    }
  }
}

const API_PREFIX = process.env.API_PREFIX ?? 'api';

export function readBrandLogo(brand: BrandSlug): Buffer | null {
  const localPath = join(process.cwd(), 'prisma', 'logos', `${brand}.png`);
  const vercelPath = join(process.cwd(), 'apps', 'api', 'dist', 'prisma', 'logos', `${brand}.png`);
  for (const path of [localPath, vercelPath]) {
    try {
      return readFileSync(path);
    } catch {
      continue;
    }
  }
  return null;
}

export function installBrandLogo(
  brand: 'NUBANK' | 'ITAUCARD' | 'OTHERS',
  name?: string | null,
): string | null {
  const slug = brandLogoSlug(brand, name);
  if (!slug || !readBrandLogo(slug)) return null;
  return `/${API_PREFIX}/cards/logos/${slug}`;
}
