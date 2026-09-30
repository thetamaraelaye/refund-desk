'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useCustomerSignIn, useDemoCustomers, useDemoReset } from '@/lib/queries';
import type { DemoCustomer } from '@/lib/types';
import { Button } from './ui/button';
import { ErrorState, LoadingState } from './ui/states';
import { StatusBadge } from './ui/status-badge';

// Reviewer tools, kept out of the product surface: one click signs in as a demo customer with a
// scenario's message ready to send. A real deployment would not ship this.
export function DemoDrawer() {
  const [open, setOpen] = useState(false);
  const customers = useDemoCustomers();
  const signIn = useCustomerSignIn();
  const [pending, setPending] = useState<string | null>(null);

  const start = (customer: DemoCustomer, scenarioKey: string) => {
    setPending(scenarioKey);
    signIn.mutate(customer.id, {
      // Full navigation: the session just changed (possibly to a different customer).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a session change must not replay a cached prefetch
      onSuccess: () => window.location.assign(`/chat?try=${scenarioKey}`),
      onSettled: () => setPending(null),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-dashed border-line-strong bg-surface px-4 py-2 text-[13px] font-medium text-ink-soft shadow-sm hover:border-ink hover:text-ink"
      >
        <span aria-hidden="true" className="size-2 rounded-full bg-escalated" />
        Demo scenarios
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-ink/30 transition-opacity duration-200 ease-in-out data-closed:opacity-0"
        />
        <div className="fixed inset-0 flex justify-end">
          <DialogPanel
            transition
            className="flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-xl transition duration-200 ease-in-out data-closed:translate-x-6 data-closed:opacity-0"
          >
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-start gap-3">
                <div>
                  <DialogTitle className="text-base font-semibold text-ink">
                    Demo scenarios
                  </DialogTitle>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Reviewer tools, not part of the product. Each scenario signs you in as its
                    customer with the message ready to send. The badge is the expected outcome.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="-mr-2">
                  Close
                </Button>
              </div>
              <p className="mt-3 text-[13px] text-ink-soft">
                Support console:{' '}
                <Link href="/admin/sign-in" className="font-medium text-focus underline">
                  /admin
                </Link>
                , password <span className="font-mono text-xs">refund-desk-admin</span>
              </p>
              <ResetDemoData />
            </div>

            {signIn.isError && (
              <p role="alert" className="border-b border-line px-5 py-3 text-sm text-denied">
                {signIn.error instanceof ApiError && signIn.error.status === 429
                  ? 'Too many sign-ins in a minute. Wait a moment and try again.'
                  : signIn.error.message}
              </p>
            )}

            <div className="flex-1 overflow-y-auto">
              {customers.isPending && <LoadingState label="Loading scenarios…" />}
              {customers.isError && (
                <ErrorState
                  title="Couldn't load the scenarios"
                  message={customers.error.message}
                  onRetry={() => void customers.refetch()}
                />
              )}
              <ul className="divide-y divide-line">
                {customers.data?.map((customer) => (
                  <li key={customer.id} className="px-5 py-3">
                    <p className="text-[13px] font-semibold text-ink">{customer.name}</p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {customer.scenarios.map((scenario) => (
                        <li key={scenario.key}>
                          <button
                            type="button"
                            onClick={() => start(customer, scenario.key)}
                            disabled={signIn.isPending}
                            aria-busy={pending === scenario.key || undefined}
                            title={scenario.message}
                            className="flex w-full items-center gap-2 rounded-button border border-line px-2.5 py-1.5 text-left text-[13px] text-ink hover:border-line-strong hover:bg-sunken disabled:opacity-60"
                          >
                            <span className="min-w-0 flex-1">{scenario.title}</span>
                            <StatusBadge
                              status={scenario.expected}
                              className="h-5 px-2 text-[11px]"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}

// Restores every order and payment to the seeded demo and clears all requests, so every scenario can be
// tried again. Asks once before wiping anything.
function ResetDemoData() {
  const reset = useDemoReset();
  const [confirming, setConfirming] = useState(false);

  if (reset.isSuccess && !confirming) {
    return (
      <p role="status" className="mt-3 text-[13px] text-approved">
        Demo data restored. Every scenario is ready to try again.
      </p>
    );
  }
  return (
    <div className="mt-3 rounded-input border border-dashed border-line-strong p-3 text-[13px]">
      {confirming ? (
        <>
          <p className="text-ink-soft">
            This clears every request, refund and audit made in the demo and restores the original
            orders.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              isLoading={reset.isPending}
              onClick={() => reset.mutate(undefined, { onSuccess: () => setConfirming(false) })}
            >
              Reset now
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
          {reset.isError && (
            <p role="alert" className="mt-2 text-denied">
              {reset.error instanceof ApiError && reset.error.status === 404
                ? 'Demo tools are switched off on this server (DEMO_MODE).'
                : reset.error.message}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-ink-soft">
            Used up the scenarios? Start again from fresh orders.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Reset demo data
          </Button>
        </div>
      )}
    </div>
  );
}
