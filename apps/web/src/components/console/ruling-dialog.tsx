'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/field';
import { formatMoney } from '@/lib/format';
import { useResolveRequest } from '@/lib/queries';

export interface RulingTarget {
  id: string;
  reference: number;
  customerName: string;
  itemName: string | null;
  amountMinor: number | null;
  currency: string | null;
}

export interface Ruling {
  target: RulingTarget;
  action: 'APPROVE' | 'DENY';
}

// Can this request be approved? Only with an identified item and its recorded price.
export const refundAmount = (target: RulingTarget) =>
  target.itemName && target.amountMinor !== null && target.currency
    ? formatMoney(target.amountMinor, target.currency)
    : null;

// One place to rule on a request, from a card or from the detail pane. States exactly what will
// happen, and takes the note that goes on the audit trail. Headless UI keeps focus inside and closes
// on Escape.
export function RulingDialog({ ruling, onClose }: { ruling: Ruling | null; onClose: () => void }) {
  return (
    <Dialog open={ruling !== null} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink/40 transition-opacity duration-200 ease-in-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          className="w-full max-w-md rounded-[14px] border border-line bg-surface p-6 shadow-xl transition duration-200 ease-in-out data-closed:translate-y-2 data-closed:scale-[0.98] data-closed:opacity-0"
        >
          {ruling && (
            <RulingForm
              key={`${ruling.target.id}-${ruling.action}`}
              ruling={ruling}
              onClose={onClose}
            />
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function RulingForm({ ruling, onClose }: { ruling: Ruling; onClose: () => void }) {
  const { target, action } = ruling;
  const resolve = useResolveRequest(target.id);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const amount = refundAmount(target);
  const approve = action === 'APPROVE';
  const noteError =
    touched && note.trim().length < 3 ? 'Add a short note for the audit trail.' : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (note.trim().length < 3) return;
    resolve.mutate({ action, note: note.trim() }, { onSuccess: onClose });
  };

  return (
    <form onSubmit={submit} noValidate>
      <DialogTitle className="text-base font-semibold text-ink">
        {approve ? `Approve a refund of ${amount}?` : `Deny request #${target.reference}?`}
      </DialogTitle>
      <Description as="p" className="mt-2 text-sm leading-relaxed text-ink-soft">
        {approve
          ? `${amount} goes back to ${target.customerName}'s card for the ${target.itemName}. It's recorded under your name and can't be undone here.`
          : `${target.customerName} is told a refund can't be approved. Your note stays on the audit trail.`}
      </Description>
      <div className="mt-4">
        <TextArea
          label="Note for the audit trail"
          hint="Not sent to the customer."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          error={noteError}
          rows={3}
          autoFocus
          placeholder={
            approve ? 'e.g. Photos confirm the damage.' : 'e.g. No reply after two days.'
          }
        />
      </div>
      {resolve.isError && (
        <p role="alert" className="mt-3 text-sm font-medium text-denied">
          {resolve.error.message}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} disabled={resolve.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={approve ? 'primary' : 'destructive'}
          isLoading={resolve.isPending}
        >
          {approve ? `Approve refund of ${amount}` : 'Deny request'}
        </Button>
      </div>
    </form>
  );
}
