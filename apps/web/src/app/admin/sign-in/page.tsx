'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { useSession, useStaffSignIn } from '@/lib/queries';

// The support console's own door. A real deployment would put company SSO here.
export default function StaffSignInPage() {
  const session = useSession();
  const signIn = useStaffSignIn();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError =
    touched && name.trim().length < 2 ? 'Enter your name (it goes on your rulings).' : null;
  const passwordError = touched && !password ? 'Enter the console password.' : null;
  const serverError =
    signIn.error instanceof ApiError && signIn.error.status === 429
      ? 'Too many attempts. Wait a minute and try again.'
      : (signIn.error?.message ?? null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (name.trim().length < 2 || !password) return;
    // A full navigation, not router.push: the router may hold a prefetched redirect to this sign-in
    // page from before the session existed, and would replay it.
    signIn.mutate(
      { name: name.trim(), password },
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a session change must not replay a cached prefetch
      { onSuccess: () => window.location.assign('/admin') },
    );
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader brand="console" />
      <main className="flex flex-1 items-start justify-center px-4 py-16">
        <section
          aria-labelledby="staff-heading"
          className="w-full max-w-sm rounded-panel border border-line bg-surface p-6"
        >
          <h1 id="staff-heading" className="text-lg font-semibold tracking-tight text-ink">
            Sign in to the support console
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Review every refund decision with the rules behind it, and rule on the requests that
            need a person.
          </p>
          {session.data?.staff ? (
            <Link
              href="/admin"
              className="mt-5 flex h-10 items-center justify-center rounded-button bg-ink text-sm font-medium text-white hover:bg-ink-soft"
            >
              Continue as {session.data.staff.name}
            </Link>
          ) : (
            <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
              <TextField
                label="Your name"
                autoComplete="name"
                autoFocus
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
                hint="Demo password: refund-desk-admin (unless ADMIN_PASSWORD was changed)."
              />
              <Button type="submit" isLoading={signIn.isPending} className="mt-1">
                Sign in
              </Button>
            </form>
          )}
          <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
            Looking for help with an order?{' '}
            <Link href="/" className="font-medium text-focus underline">
              Go to the help centre
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
