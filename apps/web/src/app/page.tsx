'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api';
import { useCustomerSignIn, useDemoCustomers, useSession, useStaffSignIn } from '@/lib/queries';
import type { DemoCustomer } from '@/lib/types';

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const session = useSession();
  const staffFirst = useSearchParams().get('signin') === 'staff';

  return (
    <div className="min-h-dvh">
      <AppHeader area="Sign in" />
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:py-14">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            Refunds decided by written policy, explained in plain words
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            A customer asks in the chat. Our refund policy decides from the order and payment
            records, and the AI assistant explains the decision. Anything the rules can&rsquo;t
            settle goes to a person, and every decision is on the support dashboard with the rules
            that made it.
          </p>
        </div>

        {(session.data?.customer || session.data?.staff) && (
          <div className="mt-6 flex flex-wrap gap-2">
            {session.data.customer && (
              <Link
                href="/chat"
                className="rounded-button border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-line-strong"
              >
                Continue as {session.data.customer.name}
              </Link>
            )}
            {session.data.staff && (
              <Link
                href="/admin"
                className="rounded-button border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-line-strong"
              >
                Back to the support dashboard
              </Link>
            )}
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <CustomerPicker />
          <div
            className={`lg:sticky lg:top-6 lg:self-start ${staffFirst ? 'order-first lg:order-none' : ''}`}
          >
            <StaffSignIn autoFocus={staffFirst} />
          </div>
        </div>
      </main>
    </div>
  );
}

function CustomerPicker() {
  const router = useRouter();
  const customers = useDemoCustomers();
  const signIn = useCustomerSignIn();
  const [pending, setPending] = useState<string | null>(null);

  const start = (customer: DemoCustomer, scenarioKey?: string) => {
    setPending(`${customer.id}:${scenarioKey ?? ''}`);
    signIn.mutate(customer.id, {
      onSuccess: () => router.push(scenarioKey ? `/chat?try=${scenarioKey}` : '/chat'),
      onSettled: () => setPending(null),
    });
  };

  return (
    <section
      aria-labelledby="customers-heading"
      className="rounded-panel border border-line bg-surface"
    >
      <div className="border-b border-line px-5 py-4">
        <h2 id="customers-heading" className="text-base font-semibold text-ink">
          Try it as a customer
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Each customer&rsquo;s orders are set up for a different part of the policy. Choose a
          scenario to sign in with its message ready to send, or sign in and write your own.
        </p>
      </div>

      {customers.isPending && <LoadingState label="Loading customers…" />}
      {customers.isError && (
        <ErrorState
          title="Couldn't load the demo customers"
          message={customers.error.message}
          onRetry={() => void customers.refetch()}
        />
      )}
      {signIn.isError && (
        <p role="alert" className="border-b border-line px-5 py-3 text-sm text-denied">
          {signIn.error instanceof ApiError && signIn.error.status === 429
            ? 'Too many sign-ins in a minute. Wait a moment and try again.'
            : signIn.error.message}
        </p>
      )}

      <ul className="divide-y divide-line">
        {customers.data?.map((customer) => (
          <li
            key={customer.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start"
          >
            <div className="min-w-0 sm:w-48 sm:shrink-0">
              <p className="text-sm font-semibold text-ink">{customer.name}</p>
              <p className="truncate text-[13px] text-muted">{customer.email}</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {customer.scenarios.map((scenario) => (
                <button
                  key={scenario.key}
                  type="button"
                  onClick={() => start(customer, scenario.key)}
                  disabled={signIn.isPending}
                  aria-busy={pending === `${customer.id}:${scenario.key}` || undefined}
                  title={scenario.message}
                  className="inline-flex items-center gap-2 rounded-button border border-line bg-surface px-2.5 py-1.5 text-left text-[13px] text-ink hover:border-line-strong hover:bg-sunken disabled:opacity-60"
                >
                  <span>{scenario.title}</span>
                  <StatusBadge status={scenario.expected} className="h-5 px-2 text-[11px]" />
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => start(customer)}
              isLoading={pending === `${customer.id}:`}
              disabled={signIn.isPending}
              aria-label={`Sign in as ${customer.name}`}
            >
              Sign in
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StaffSignIn({ autoFocus }: { autoFocus: boolean }) {
  const router = useRouter();
  const signIn = useStaffSignIn();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError =
    touched && name.trim().length < 2 ? 'Enter your name (it goes on your rulings).' : null;
  const passwordError = touched && !password ? 'Enter the dashboard password.' : null;
  const serverError =
    signIn.error instanceof ApiError && signIn.error.status === 429
      ? 'Too many attempts. Wait a minute and try again.'
      : (signIn.error?.message ?? null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (name.trim().length < 2 || !password) return;
    signIn.mutate({ name: name.trim(), password }, { onSuccess: () => router.push('/admin') });
  };

  return (
    <section
      aria-labelledby="staff-heading"
      className="rounded-panel border border-line bg-surface p-5"
    >
      <h2 id="staff-heading" className="text-base font-semibold text-ink">
        Support team
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Review every decision with the rules behind it, and rule on requests that need a person.
      </p>
      <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
        <TextField
          label="Your name"
          autoComplete="name"
          autoFocus={autoFocus}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          placeholder="Ada Obi"
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError ?? (serverError && !signIn.isPending ? serverError : null)}
          hint="The demo password is refund-desk-admin unless ADMIN_PASSWORD was changed."
        />
        <Button type="submit" isLoading={signIn.isPending} className="mt-1">
          Open the dashboard
        </Button>
      </form>
    </section>
  );
}
