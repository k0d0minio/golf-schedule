import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

// Placeholder logo — swap this component out when a real brand asset is ready.
export function Logo({ className }: LogoProps) {
  return (
    <span className={cn('font-bold tracking-tight text-foreground', className)}>
      Golf Schedule
    </span>
  );
}
