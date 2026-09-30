'use client';

import Link from 'next/link';
import { useSignOut } from '@/lib/queries';
import { Button } from './ui/button';

// Two products share this app, as they would in a real company: the store's help centre for customers,
// and Refund Desk, the internal console the support team works in.
export const STORE_NAME = 'Larkfield';

const BRANDS = {
  store: { name: STORE_NAME, area: '', home: '/' },
  console: { name: 'Refund Desk', area: 'Support console', home: '/admin' },
} as const;

export function AppHeader({
  brand,
  person,
  aside,
}: {
  brand: keyof typeof BRANDS;
  person?: string;
  aside?: React.ReactNode;
}) {
  const role = brand === 'store' ? 'customer' : 'staff';
  const signOut = useSignOut(role);
  const { name, area, home } = BRANDS[brand];

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-360 items-center gap-4 px-4 sm:px-6">
        <Link href={home} className="flex items-center gap-2.5 rounded-button">
          {brand === 'store' ? (
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white"
            >
              L
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-button border border-line-strong font-mono text-[11px] font-semibold text-ink"
            >
              RD
            </span>
          )}
          <span className="text-[15px] font-semibold tracking-tight text-ink">{name}</span>
          {area && <span className="hidden text-[13px] text-muted sm:inline">{area}</span>}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {aside}
          {person && (
            <>
              <span className="hidden text-[13px] text-ink-soft md:inline">{person}</span>
              <Button
                variant="ghost"
                size="sm"
                isLoading={signOut.isPending}
                onClick={() =>
                  signOut.mutate(undefined, {
                    onSuccess: () =>
                      window.location.assign(brand === 'store' ? '/' : '/admin/sign-in'),
                  })
                }
              >
                Sign out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
