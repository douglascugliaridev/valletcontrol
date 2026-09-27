import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type BrandSlug = 'nubank' | 'itaucard';

function brandLogoSlug(brand: 'NUBANK' | 'ITAUCARD' | 'OTHERS'): BrandSlug | null {
  switch (brand) {
    case 'NUBANK':
      return 'nubank';
    case 'ITAUCARD':
      return 'itaucard';
    default:
      return null;
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

export function installBrandLogo(brand: 'NUBANK' | 'ITAUCARD' | 'OTHERS'): string | null {
  const slug = brandLogoSlug(brand);
  if (!slug || !readBrandLogo(slug)) return null;
  return `/${API_PREFIX}/cards/logos/${slug}`;
}
