'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface PromptDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  placeholder?: string;
  loading?: boolean;
  error?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/**
 * Single-text-field dialog, used for creating and renaming folders.
 *
 * Built on <dialog> so focus trapping and Escape come from the browser. The
 * field is re-seeded each time it opens, and for a name with an extension the
 * stem is pre-selected so typing replaces the name but keeps the suffix.
 */
export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  confirmLabel = 'Save',
  placeholder,
  loading = false,
  error,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setValue(initialValue);
      dialog.showModal();

      // Select the stem, not the extension: renaming "report.pdf" should not
      // make it easy to accidentally drop the ".pdf".
      queueMicrotask(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        const lastDot = initialValue.lastIndexOf('.');
        if (lastDot > 0) input.setSelectionRange(0, lastDot);
        else input.select();
      });
    }

    if (!open && dialog.open) dialog.close();
  }, [open, initialValue]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length > 0 && !loading) onSubmit(trimmed);
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onCancel();
      }}
      onClose={onCancel}
      className="border-border bg-surface text-foreground m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border p-0 backdrop:bg-black/50"
    >
      <form onSubmit={handleSubmit} className="p-5">
        <h2 className="mb-4 text-base font-semibold">{title}</h2>

        <Input
          ref={inputRef}
          label={label}
          value={value}
          placeholder={placeholder}
          maxLength={255}
          error={error}
          onChange={(event) => setValue(event.target.value)}
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={value.trim().length === 0}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
