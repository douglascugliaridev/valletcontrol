import { existsSync, mkdirSync } from 'node:fs';
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
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Em serverless (Vercel, AWS Lambda), filesystem é read-only.
    // Usa /tmp/uploads como fallback gravável.
  }
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
 * Retorna a URL pública da logo da marca via endpoint /api/cards/logos/:brand.
 * Funciona em serverless (não copia arquivos).
 */
export function installBrandLogo(
  cardId: string,
  brand: 'NUBANK' | 'ITAUCARD' | 'OTHERS',
): string | null {
  const slug = brandLogoSlug(brand);
  if (!slug) return null;
  const src = join(BRAND_ASSETS_DIR, `${slug}.png`);
  if (!existsSync(src)) return null;
  return `/${API_PREFIX}/cards/logos/${slug}`;
}