import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** MIME aceito para logos de cartão → extensão de arquivo. */
export const ALLOWED_LOGO_MIMES: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Tamanho máximo de upload de logo (2 MB). */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Diretório de uploads da API (configurável via UPLOADS_DIR). */
export function resolveUploadsDir(): string {
  const dir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Prefixo público dos arquivos, ex.: "api/uploads". */
export function uploadsPrefix(apiPrefix: string): string {
  return `${apiPrefix}/uploads`;
}

/** Slug usado para buscar o asset da logo da marca em prisma/logos. */
function brandLogoSlug(brand: 'NUBANK' | 'ITAUCARD' | 'OTHERS'): string | null {
  switch (brand) {
    case 'NUBANK':
      return 'nubank';
    case 'ITAUCARD':
      return 'itaucard';
    default:
      return null;
  }
}

const BRAND_ASSETS_DIR = join(process.cwd(), 'prisma', 'logos');
const API_PREFIX = process.env.API_PREFIX ?? 'api';

/**
 * Se existir logo oficial da marca em prisma/logos, copia para uploads e
 * devolve a URL pública do arquivo. Retorna null se não houver asset.
 */
export function installBrandLogo(
  cardId: string,
  brand: 'NUBANK' | 'ITAUCARD' | 'OTHERS',
): string | null {
  const slug = brandLogoSlug(brand);
  if (!slug) return null;
  const src = join(BRAND_ASSETS_DIR, `${slug}.png`);
  if (!existsSync(src)) return null;
  const filename = `${cardId}-logo.png`;
  copyFileSync(src, join(resolveUploadsDir(), filename));
  return `/${uploadsPrefix(API_PREFIX)}/${filename}`;
}