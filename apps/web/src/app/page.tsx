'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

const FIRST_LOOK = 8;
import { AppHeader, STORE_NAME } from '@/components/app-header';
import { DemoDrawer } from '@/components/demo-drawer';
import { ProductArt } from '@/components/product-art';
import { TestOrderDialog } from '@/components/store/test-order-dialog';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useCustomerSignIn, useDemoCustomers, useProducts, useSession } from '@/lib/queries';
import type { Product } from '@/lib/types';

// The hero's still life: one piece from each corner of the shop.
const FEATURED = ['KIT-POUR-01', 'LGT-DESK-02', 'APP-COAT-MW', 'AUD-HEAD-02'];

// Larkfield's front page: the shop first, and a plain route to help with an order. Staff never see a
// sign-in form here; the support console has its own door at /admin.
export default function StoreHome() {
  const session = useSession();
  const products = useProducts();
  const signedIn = Boolean(session.data?.customer);
  const [showAll, setShowAll] = useState(false);
  const [ordering, setOrdering] = useState<Product | null>(null);
  const shown = showAll ? products.data : products.data?.slice(0, FIRST_LOOK);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        brand="store"
        aside={
          <nav aria-label="Store" className="flex items-center gap-1 text-[13px]">
            <a href="#shop" className="rounded-button px-3 py-1.5 text-ink-soft hover:text-ink">
              Shop
            </a>
            <a href="#help" className="rounded-button px-3 py-1.5 text-ink-soft hover:text-ink">
              Help
            </a>
            {signedIn ? (
              <Link
                href="/chat"
                className="ml-1 rounded-button bg-moss px-3 py-1.5 font-medium text-white hover:bg-moss-strong"
              >
                Your orders
              </Link>
            ) : (
              <a
                href="#help"
                className="ml-1 rounded-button border border-line bg-surface px-3 py-1.5 font-medium text-ink hover:border-line-strong"
              >
                Sign in
              </a>
            )}
          </nav>
        }
      />

      <main className="flex-1">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="font-display text-[44px] leading-[1.04] font-medium tracking-tight text-ink sm:text-[58px]">
              Made for the rooms you live in.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
              Home, kitchen and lifestyle goods, chosen to last. And if something arrives wrong,
              help that settles it fairly, usually in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#shop"
                className="inline-flex h-11 items-center rounded-button bg-moss px-5 text-sm font-medium text-white hover:bg-moss-strong"
              >
                Shop the collection
              </a>
              <a
                href="#help"
                className="inline-flex h-11 items-center rounded-button border border-line-strong bg-surface px-5 text-sm font-medium text-ink hover:border-ink"
              >
                Get help with an order
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pb-10 sm:gap-5">
            {FEATURED.map((sku, index) => (
              <ProductArt
                key={sku}
                sku={sku}
                className={index % 2 === 1 ? 'translate-y-10' : undefined}
              />
            ))}
          </div>
        </section>

        <section
          id="shop"
          aria-labelledby="shop-heading"
          className="border-y border-line bg-surface"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2
                id="shop-heading"
                className="font-display text-[34px] leading-tight font-medium tracking-tight text-ink"
              >
                The collection
              </h2>
              {products.data && (
                <p className="text-[15px] text-muted">
                  {products.data.length} pieces for the kitchen, the home and every day.
                </p>
              )}
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {shown?.map((product) => (
                <li key={product.sku}>
                  <ProductArt sku={product.sku} className="w-full" />
                  <p className="mt-3 text-[15px] font-medium text-ink">{product.name}</p>
                  <p className="mt-0.5 text-[14px] text-muted">
                    {formatMoney(product.priceMinor, product.currency)}
                  </p>
                  <button
                    type="button"

                    onClick={() => setOrdering(product)}

                    aria-label={`Place a test order for the ${product.name}`}

                    className="mt-2 rounded-button border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-moss hover:text-moss"
                  >
                    Place a test order
                  </button>
                </li>
              ))}
            </ul>
            {products.data && products.data.length > FIRST_LOOK && (
              <div className="mt-10 flex justify-center">
                <Button variant="secondary" onClick={() => setShowAll((all) => !all)}>
                  {showAll ? 'Show fewer' : `Show all ${products.data.length} pieces`}
                </Button>
              </div>
            )}
          </div>
        </section>

        <section
          id="help"
          className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]"
        >
          <div className="max-w-xl">
            <h2 className="font-display text-[34px] leading-tight font-medium tracking-tight text-ink">
              Something wrong with an order?
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
              Sign in, choose the item, and tell our assistant what happened. Damaged or wrong items
              within 30 days of delivery are usually refunded straight away, and anything our refund
              policy can&rsquo;t settle goes to a member of our support team.
            </p>
            <ul className="mt-6 flex flex-col gap-2 text-[15px] text-ink-soft">
              <li>Refunds go back to the card you paid with, within 5–10 business days.</li>
              <li>You can ask for a person at any point in the conversation.</li>
            </ul>
          </div>
          <SignInCard />
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-6 pr-48 text-[13px] text-muted sm:px-6 sm:pr-48">
          <span>&copy; {STORE_NAME}. Refunds follow our written policy.</span>
          <Link href="/admin/sign-in" className="hover:text-ink">
            Staff sign-in
          </Link>
        </div>
      </footer>
      <TestOrderDialog product={ordering} signedIn={signedIn} onClose={() => setOrdering(null)} />
      <DemoDrawer />
    </div>
  );
}

function SignInCard() {
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
    signIn.mutate(customer.id, {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a session change must not replay a cached prefetch
      onSuccess: () => window.location.assign('/chat'),
    });
  };

  const serverError =
    signIn.error instanceof ApiError && signIn.error.status === 429
      ? 'Too many sign-ins in a minute. Wait a moment and try again.'
      : (signIn.error?.message ?? null);

  return (
    <section
      aria-labelledby="signin-heading"
      className="rounded-[14px] border border-line bg-surface p-6 shadow-sm"
    >
      {session.data?.customer ? (
        <>
          <h3 id="signin-heading" className="text-base font-semibold text-ink">
            Welcome back, {session.data.customer.name.split(' ')[0]}
          </h3>
          <Link
            href="/chat"
            className="mt-4 flex h-10 items-center justify-center rounded-button bg-moss text-sm font-medium text-white hover:bg-moss-strong"
          >
            Go to your orders
          </Link>
        </>
      ) : (
        <>
          <h3 id="signin-heading" className="text-base font-semibold text-ink">
            Sign in to {STORE_NAME}
          </h3>
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
            <Button type="submit" variant="brand" isLoading={signIn.isPending}>
              Continue
            </Button>
          </form>
          <details className="mt-5 rounded-input border border-line bg-paper px-3 py-2 text-[13px]">
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
  );
}
