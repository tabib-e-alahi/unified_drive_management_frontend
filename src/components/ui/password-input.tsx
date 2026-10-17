'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'trailing'>;

/**
 * Password field with a reveal toggle.
 *
 * The button is `type="button"` so it never submits the form, and it is
 * excluded from the tab order: keyboard users tabbing through a login form
 * expect to land on the submit button next, not on a reveal control. It stays
 * reachable by pointer and by screen readers, which announce the pressed state.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((shown) => !shown)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            title={visible ? 'Hide password' : 'Show password'}
            className="text-muted-foreground hover:bg-surface-muted hover:text-foreground rounded-md p-1.5 transition-colors"
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        }
        {...props}
      />
    );
  },
);
