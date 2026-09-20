import Image from 'next/image';

export function Logo({ className = 'size-15' }: { className?: string }) {
  return (
    <Image
      src="/valletcontrol-mark.png"
      alt="ValletControl"
      width={384}
      height={384}
      className={className}
      unoptimized
    />
  );
}