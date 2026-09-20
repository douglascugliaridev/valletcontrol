'use client';

import { useState } from 'react';
import Image from 'next/image';
import { resolveAssetUrl } from '@/lib/api';
import { cn } from '@/lib/cn';

interface CardLogoProps {
  logoUrl?: string | null;
  alt: string;
  className?: string;
  size?: number;
}

/** Espaço extra (px) do chip branco no dark mode — dá respiro à logo. */
const CHIP_PAD = 2;

export function CardLogo({ logoUrl, alt, className, size = 20 }: CardLogoProps) {
  const [broken, setBroken] = useState(false);
  const src = logoUrl && !broken ? resolveAssetUrl(logoUrl) : undefined;
  if (!src) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'dark:bg-white',
        className,
      )}
      style={{ width: size + CHIP_PAD * 2, height: size + CHIP_PAD * 2 }}
    >
      <Image
        src={src}
        alt={`Logo de ${alt}`}
        width={size}
        height={size}
        unoptimized
        className="pointer-events-none h-auto w-auto rounded object-contain"
        onError={() => setBroken(true)}
      />
    </span>
  );
}
