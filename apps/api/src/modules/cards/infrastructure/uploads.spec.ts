import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { BRAND_SLUGS, installBrandLogo } from './uploads';

/**
 * Estes testes dependem de `prisma/logos/*.png` estar presente no repositório, porque
 * `installBrandLogo` só devolve um caminho quando o arquivo existe de fato — é assim
 * que o app evita apontar para uma imagem que não foi copiada para o bundle.
 */
const temLogo = (slug: string) =>
  existsSync(join(process.cwd(), 'prisma', 'logos', `${slug}.png`)) ||
  existsSync(join(process.cwd(), 'apps', 'api', 'dist', 'prisma', 'logos', `${slug}.png`));

describe('installBrandLogo', () => {
  it('resolve a bandeira quando ela tem logo própria', () => {
    expect(installBrandLogo('NUBANK')).toBe('/api/cards/logos/nubank');
    expect(installBrandLogo('ITAUCARD')).toBe('/api/cards/logos/itaucard');
  });

  it('dá logo ao cartão Havan, que é OTHERS no enum', () => {
    // O bug: `havan.png` existia no repositório desde sempre e o cartão ficava sem
    // logo porque `CardBrand` não tem valor para ele e o mapeamento só olhava a
    // bandeira.
    expect(installBrandLogo('OTHERS', 'Havan')).toBe('/api/cards/logos/havan');
  });

  it('aceita o nome do cartão como o usuário digitar', () => {
    for (const name of ['havan', 'HAVAN', ' Cartão Havan ', 'Havan Havanna', 'cartao havan']) {
      expect(installBrandLogo('OTHERS', name)).toBe('/api/cards/logos/havan');
    }
  });

  it('ignora acento e caixa no nome', () => {
    expect(installBrandLogo('OTHERS', 'Hàvan')).toBe('/api/cards/logos/havan');
  });

  it('a bandeira tem precedência sobre o nome', () => {
    // Um cartão chamado "Havan" cadastrado como Nubank é um Nubank — o usuário pode ter
    // errado o cadastro, e a bandeira é o dado mais confiável.
    expect(installBrandLogo('NUBANK', 'Havan')).toBe('/api/cards/logos/nubank');
  });

  it('devolve null para cartão OTHERS sem logo conhecida', () => {
    expect(installBrandLogo('OTHERS', 'Cartão Genérico')).toBeNull();
    expect(installBrandLogo('OTHERS', null)).toBeNull();
    expect(installBrandLogo('OTHERS')).toBeNull();
  });

  it('não aponta para um slug cujo arquivo não existe no bundle', () => {
    // Um slug cadastrado no código sem o PNG correspondente geraria um 404 em produção.
    for (const slug of BRAND_SLUGS) {
      expect(temLogo(slug)).toBe(true);
    }
  });

  it('todos os slugs declarados são servidos pelo mesmo endpoint', () => {
    expect(BRAND_SLUGS).toEqual(['nubank', 'itaucard', 'havan']);
  });
});
