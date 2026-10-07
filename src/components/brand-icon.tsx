import Image from 'next/image';

type BrandIconProps = {
  className?: string;
};

export function BrandIcon({ className }: BrandIconProps) {
  return (
    <span className={className} aria-hidden="true">
      <Image src="/reposcope-icon.svg" alt="" width={64} height={64} priority />
    </span>
  );
}
