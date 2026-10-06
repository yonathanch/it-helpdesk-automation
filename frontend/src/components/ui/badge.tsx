import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL, STATUS_TONE } from '@/lib/labels';
import type { TicketPriority, TicketStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge dengan titik warna + label teks.
 * Warna tidak pernah menjadi satu-satunya pembawa informasi (aksesibilitas).
 */
function ToneBadge({
  tone,
  label,
  className,
  title,
}: {
  tone: string;
  label: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn(
        badgeVariants({ variant: 'outline' }),
        'bg-card font-medium text-foreground',
        className,
      )}
      title={title}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tone }}
      />
      {label}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const label = STATUS_LABEL[status];
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium leading-5 min-w-[100px] text-center',
        className,
      )}
      style={{ backgroundColor: tone, color: 'white' }}
      title={label}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  const label = PRIORITY_LABEL[priority];
  const tone = PRIORITY_TONE[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 min-w-[80px] text-center',
        className,
      )}
      style={{ borderColor: tone, color: tone }}
      title={label}
    >
      {label}
    </span>
  );
}


function Badge({ className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants(), className)} {...props} />;
}

export { Badge, ToneBadge };
