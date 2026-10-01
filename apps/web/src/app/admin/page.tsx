'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { MetricsStrip } from '@/components/console/metrics-strip';
import { RequestCard, StatusIcon } from '@/components/console/request-card';
import { RulingDialog, type Ruling } from '@/components/console/ruling-dialog';
import { RequestDetail } from '@/components/request-detail';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useConsoleMetrics, useSession, useStaffRequests } from '@/lib/queries';
import type { RequestStatus, StaffListItem } from '@/lib/types';

export default function ConsolePage() {
  return (
    <Suspense>
      <Console />
    </Suspense>
  );
}

type TabKey = 'attention' | 'all' | RequestStatus;

// The console opens on the working queue: everything waiting on a person, longest waiting first.
const TABS: { key: TabKey; label: string }[] = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'ESCALATED', label: 'Escalated' },
  { key: 'NEEDS_INFO', label: 'Needs info' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'DENIED', label: 'Denied' },
  { key: 'all', label: 'All' },
];

const STATUSES = new Set<string>(['ESCALATED', 'NEEDS_INFO', 'APPROVED', 'DENIED']);

// "Needs attention" groups its cards by status, the way Linear groups issues.
const GROUPS: { status: RequestStatus; label: string }[] = [
  { status: 'ESCALATED', label: 'Escalated' },
  { status: 'NEEDS_INFO', label: 'Needs info' },
];

function Console() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The URL is the state: tab, page and open request survive a reload and can be shared.
  const rawStatus = params.get('status');
  const status = rawStatus && STATUSES.has(rawStatus) ? (rawStatus as RequestStatus) : undefined;
  const tab: TabKey = status ?? (params.get('view') === 'all' ? 'all' : 'attention');
  const page = Math.max(1, Number(params.get('page')) || 1);
  const selectedId = params.get('request');

  const session = useSession();
  const metrics = useConsoleMetrics();
  const [ruling, setRuling] = useState<Ruling | null>(null);
  const list = useStaffRequests({
    status,
    view: tab === 'attention' ? 'attention' : undefined,
    page,
  });

  const navigate = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const meta = list.data?.meta;
  const counts = meta?.counts;
  const countFor = (key: TabKey) =>
    !counts
      ? undefined
      : key === 'all'
        ? counts.ESCALATED + counts.NEEDS_INFO + counts.APPROVED + counts.DENIED
        : key === 'attention'
          ? counts.ESCALATED + counts.NEEDS_INFO
          : counts[key];
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const items = list.data?.items ?? [];

  const card = (request: StaffListItem) => (
    <li key={request.id}>
      <RequestCard
        request={request}
        selected={request.id === selectedId}
        onOpen={() => navigate({ request: request.id })}
        onApprove={
          (request.status === 'ESCALATED' || request.status === 'NEEDS_INFO') &&
          request.orderItem &&
          request.amountMinor !== null
            ? () =>
                setRuling({
                  action: 'APPROVE',
                  target: {
                    id: request.id,
                    reference: request.reference,
                    customerName: request.customer.name,
                    itemName: request.orderItem?.name ?? null,
                    amountMinor: request.amountMinor,
                    currency: request.currency,
                  },
                })
            : undefined
        }
      />
    </li>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        brand="console"
        person={session.data?.staff?.name}
        aside={
          <Link
            href="/"
            className="hidden rounded-button px-3 py-1.5 text-[13px] text-ink-soft hover:bg-sunken sm:inline"
          >
            Customer help centre
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-360 px-4 pt-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Requests</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Review customer requests and make policy-backed decisions.
        </p>
        <div className="mt-4">
          <MetricsStrip metrics={metrics.data} />
        </div>

        <nav aria-label="Requests by status" className="mt-5 border-b border-line">
          <ul className="flex gap-1 overflow-x-auto">
            {TABS.map(({ key, label }) => {
              const count = countFor(key);
              const active = key === tab;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() =>
                      navigate({
                        status: key === 'all' || key === 'attention' ? null : key,
                        view: key === 'all' ? 'all' : null,
                        page: null,
                        request: null,
                      })
                    }
                    className={cn(
                      '-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-[13px] font-medium whitespace-nowrap',
                      active
                        ? 'border-moss text-ink'
                        : 'border-transparent text-muted hover:text-ink',
                    )}
                  >
                    {label}
                    {count !== undefined && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-xs',
                          active ? 'bg-moss-tint text-moss' : 'bg-sunken text-ink-soft',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <main className="mx-auto grid w-full max-w-360 flex-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(400px,580px)_minmax(0,1fr)]">
        <section
          aria-label="Request list"
          // While a new tab loads, the previous cards stay visible but dimmed and marked busy.
          aria-busy={list.isPlaceholderData || undefined}
          className={cn(
            'h-fit transition-opacity duration-200 ease-in-out',
            list.isPlaceholderData && 'opacity-60',
            selectedId && 'hidden lg:block',
          )}
        >
          {list.isPending && <LoadingState label="Loading requests…" />}
          {list.isError && !list.data && (
            <ErrorState
              title="Couldn't load the requests"
              message={list.error.message}
              onRetry={() => void list.refetch()}
            />
          )}
          {list.data && items.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-line-strong">
              {tab === 'attention' ? (
                <EmptyState
                  title="All caught up"
                  message="No request is waiting on a person right now."
                />
              ) : (
                <EmptyState
                  title="Nothing here yet"
                  message="Requests appear here as soon as a customer writes in from the help centre."
                />
              )}
            </div>
          )}

          {tab === 'attention' ? (
            GROUPS.map(({ status: groupStatus, label }) => {
              const group = items.filter((item) => item.status === groupStatus);
              if (group.length === 0) return null;
              return (
                <div key={groupStatus} className="mb-5">
                  <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-ink">
                    <StatusIcon status={groupStatus} />
                    {label}
                    <span className="font-normal text-muted">{group.length}</span>
                  </h2>
                  <ul aria-label={`${label} requests`} className="flex flex-col gap-2">
                    {group.map(card)}
                  </ul>
                </div>
              );
            })
          ) : (
            <ul aria-label="Requests" className="flex flex-col gap-2">
              {items.map(card)}
            </ul>
          )}

          {meta && meta.total > meta.limit && (
            <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
              <span>
                Showing {from}–{to} of {meta.total} requests
              </span>
              <div className="ml-auto flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => navigate({ page: String(meta.page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => navigate({ page: String(meta.page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>

        <section
          aria-label="Request detail"
          className={cn('min-w-0', !selectedId && 'hidden lg:block')}
        >
          {selectedId ? (
            <RequestDetail id={selectedId} onBack={() => navigate({ request: null })} />
          ) : (
            <div className="rounded-[12px] border border-dashed border-line-strong">
              <EmptyState
                title="Choose a request"
                message="Open a request to see the conversation, the rules that decided it, the order's payment and delivery history, and the full audit trail."
              />
            </div>
          )}
        </section>
      </main>
      <RulingDialog ruling={ruling} onClose={() => setRuling(null)} />
    </div>
  );
}
