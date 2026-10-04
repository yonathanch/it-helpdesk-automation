'use client';

import * as React from 'react';

/**
 * Slot minimal: menggabungkan props ke elemen child tunggal.
 * Mendukung pola `asChild` (mis. <Button asChild><Link/></Button>)
 * tanpa menambah dependensi @radix-ui/react-slot.
 */

type AnyProps = Record<string, unknown>;

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

export const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, ref) => {
    if (!React.isValidElement(children)) {
      return null;
    }

    const child = children as React.ReactElement<AnyProps>;
    const childProps = (child.props ?? {}) as AnyProps;

    // Gabungkan className agar utility Tailwind tidak saling menimpa.
    const mergedClassName = [slotProps.className, childProps.className]
      .filter(Boolean)
      .join(' ');

    const merged: AnyProps = {
      ...slotProps,
      ...childProps,
      ref,
    };
    if (mergedClassName) merged.className = mergedClassName;

    return React.cloneElement(child, merged);
  },
);
Slot.displayName = 'Slot';
