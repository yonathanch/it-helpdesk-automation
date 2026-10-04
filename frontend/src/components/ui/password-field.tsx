'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';

/** Input password dengan tombol tampil/sembunyikan (aksesibel via aria-pressed). */
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`pr-10 ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-controls={props.id}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
});
PasswordField.displayName = 'PasswordField';
