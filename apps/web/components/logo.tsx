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