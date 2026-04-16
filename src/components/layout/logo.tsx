import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const sizeMap = {
    sm: { h: 28, w: 62, text: 'text-sm' },
    md: { h: 36, w: 80, text: 'text-base' },
    lg: { h: 48, w: 107, text: 'text-lg' },
  };

  const { h, w } = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/logo.png"
        alt="AlertPort"
        width={w}
        height={h}
        priority
        className="h-auto w-auto"
        style={{ maxHeight: `${h}px` }}
      />
      {showText && (
        <span className={cn('sr-only', sizeMap[size].text)}>AlertPort</span>
      )}
    </div>
  );
}
