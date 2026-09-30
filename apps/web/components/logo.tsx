import Image from 'next/image';

export function Logo({ className = 'size-15' }: { className?: string }) {
  return (
    <Image
      src="/walletcontrol-mark.png"
      alt="WalletControl"
      width={384}
      height={384}
      className={className}
      unoptimized
    />
  );
}

/**
 * Lockup completo: ícone + "Wallet control" + "controle financeiro pessoal".
 *
 * O texto é DOM, e não a imagem `/walletcontrol-logo.png`, de propósito: no PNG o texto é
 * quase preto (rgb 11,11,11) e ficaria invisível no tema dark, cujo fundo é
 * `hsl(222 47% 4%)`. Aqui ele herda `text-foreground`/`text-muted-foreground` e acompanha o
 * tema, além de ficar nítido em qualquer escala.
 */
export function LogoLockup({ className = 'size-24' }: { className?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Logo className={className} />
      <div>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          Wallet <span className="text-muted-foreground">control</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">controle financeiro pessoal</p>
      </div>
    </div>
  );
}
