'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { Button } from './button';

// Headless UI keeps focus inside, closes on Escape and restores focus afterwards; the panel eases in
// and out (and appears instantly for people who prefer reduced motion).
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  isLoading = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'destructive';
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={isLoading ? () => undefined : onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink/40 transition-opacity duration-200 ease-in-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          className="w-full max-w-md rounded-panel border border-line bg-surface p-6 shadow-xl transition duration-200 ease-in-out data-closed:translate-y-2 data-closed:scale-[0.98] data-closed:opacity-0"
        >
          <DialogTitle className="text-base font-semibold text-ink">{title}</DialogTitle>
          <Description as="div" className="mt-2 text-sm leading-relaxed text-ink-soft">
            {description}
          </Description>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-denied">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant={tone === 'destructive' ? 'destructive' : 'primary'}
              onClick={onConfirm}
              isLoading={isLoading}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
