'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AppHeader, STORE_NAME } from '@/components/app-header';
import { DemoDrawer } from '@/components/demo-drawer';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { useCustomerSignIn, useDemoCustomers, useSession } from '@/lib/queries';

// The store's help centre: customers sign in to get help with an order. Staff never see a sign-in form
// here; they use the support console at /admin.
export default function HelpCentreSignIn() {
  const session = useSession();
  const customers = useDemoCustomers();
  const signIn = useCustomerSignIn();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const wanted = email.trim().toLowerCase();
    if (!wanted.includes('@')) {
      setError('Enter the email address you ordered with.');
      return;
    }
    // Demo sign-in: accounts have no passwords, so an email is enough to find one.
    const customer = customers.data?.find((c) => c.email.toLowerCase() === wanted);
    if (!customer) {
      setError("We couldn't find an account with that email. Try one of the demo accounts below.");
      return;
    }
    setError(null);
    // Full navigation after the session changes, so no route prefetched while signed out is replayed.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a session change must not replay a cached prefetch
    signIn.mutate(customer.id, { onSuccess: () => window.location.assign('/chat') });
  };

  const serverError =
    signIn.error instanceof ApiError && signIn.error.status === 429
      ? 'Too many sign-ins in a minute. Wait a moment and try again.'
      : (signIn.error?.message ?? null);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader brand="store" />
      <main className="mx-auto grid w-full max-w-[1100px] flex-1 items-start gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:py-20">
        <div className="max-w-xl">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[34px]">
            Something wrong with an order?
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
            Sign in, pick the item, and tell our assistant what happened. Damaged or wrong items
            within 30 days of delivery are usually refunded straight away, and anything our refund
            policy can&rsquo;t settle goes to a member of our support team.
          </p>
          <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-soft">
            <li>Refunds go back to the card you paid with, within 5–10 business days.</li>
            <li>You can ask for a person at any point in the conversation.</li>
          </ul>
        </div>

        <section
          aria-labelledby="signin-heading"
          className="rounded-panel border border-line bg-surface p-6"
        >
          {session.data?.customer ? (
            <>
              <h2 id="signin-heading" className="text-base font-semibold text-ink">
                Welcome back, {session.data.customer.name.split(' ')[0]}
              </h2>
              <Link
                href="/chat"
                className="mt-4 flex h-10 items-center justify-center rounded-button bg-ink text-sm font-medium text-white hover:bg-ink-soft"
              >
                Go to your orders
              </Link>
            </>
          ) : (
            <>
              <h2 id="signin-heading" className="text-base font-semibold text-ink">
                Sign in to {STORE_NAME}
              </h2>
              <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
                <TextField
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error ?? serverError}
                  placeholder="you@example.com"
                />
                <Button type="submit" isLoading={signIn.isPending}>
                  Continue
                </Button>
              </form>
              <details className="mt-5 rounded-input border border-line bg-sunken/50 px-3 py-2 text-[13px]">
                <summary className="cursor-pointer rounded-button font-medium text-ink-soft">
                  Demo accounts (no password needed)
                </summary>
                <ul className="mt-2 flex flex-col gap-1 pb-1">
                  {customers.data?.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => setEmail(customer.email)}
                        className="w-full rounded-button px-2 py-1 text-left text-ink-soft hover:bg-surface hover:text-ink"
                      >
                        {customer.name} <span className="text-muted">{customer.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-4 px-4 py-5 pr-48 text-[13px] text-muted sm:px-6 sm:pr-48">
          <span>&copy; {STORE_NAME}. Refunds follow our written policy.</span>
          <Link href="/admin/sign-in" className="hover:text-ink">
            Staff sign-in
          </Link>
        </div>
      </footer>
      <DemoDrawer />
    </div>
  );
}
