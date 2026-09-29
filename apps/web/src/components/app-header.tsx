'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignOut } from '@/lib/queries';
import { Button } from './ui/button';

export function AppHeader({
  area,
  person,
  role,
  aside,
}: {
  area: string;
  person?: string;
  role?: 'customer' | 'staff';
  aside?: React.ReactNode;
}) {
  const router = useRouter();
  const signOut = useSignOut(role ?? 'customer');

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 rounded-button">
          <span className="text-[15px] font-semibold tracking-tight text-ink">Refund Desk</span>
          <span className="hidden text-[13px] text-muted sm:inline">{area}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {aside}
          {person && role && (
            <>
              <span className="hidden text-[13px] text-ink-soft md:inline">{person}</span>
              <Button
                variant="ghost"
                size="sm"
                isLoading={signOut.isPending}
                onClick={() => signOut.mutate(undefined, { onSuccess: () => router.push('/') })}
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
