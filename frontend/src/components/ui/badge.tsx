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
  return (
    <span className={cn('contents', className)}>
      <span className="sr-only">Status tiket: </span>
      <ToneBadge tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
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
  return (
    <span className={cn('contents', className)}>
      <span className="sr-only">Prioritas: </span>
      <ToneBadge tone={PRIORITY_TONE[priority]} label={PRIORITY_LABEL[priority]} />
    </span>
  );
}

function Badge({ className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants(), className)} {...props} />;
}

export { Badge, ToneBadge };
