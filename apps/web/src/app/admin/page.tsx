'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppHeader } from '@/components/app-header';
import { RequestDetail } from '@/components/request-detail';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { FLAG_LABELS } from '@/lib/labels';
import { formatMoney, formatRelative } from '@/lib/format';
import { useSession, useStaffRequests } from '@/lib/queries';
import type { RequestStatus, StaffListItem } from '@/lib/types';

export default function AdminPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

const TABS: { status?: RequestStatus; label: string }[] = [
  { label: 'All' },
  { status: 'ESCALATED', label: 'Escalated' },
  { status: 'NEEDS_INFO', label: 'Needs info' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'DENIED', label: 'Denied' },
];

const STATUSES = new Set<string>(['ESCALATED', 'NEEDS_INFO', 'APPROVED', 'DENIED']);

const COLUMNS: Column<StaffListItem>[] = [
  {
    key: 'request',
    header: 'Request',
    className: 'w-[42%]',
    render: (row) => (
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">
          #{row.reference} <span className="font-normal text-ink-soft">{row.customer.name}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">
          {row.summary ?? 'No message yet'}
        </p>
        {row.flags.length > 0 && (
          <p className="mt-1 text-xs text-escalated">
            {row.flags.map((flag) => FLAG_LABELS[flag] ?? flag).join(', ')}
          </p>
        )}
      </div>
    ),
  },
  {
    key: 'order',
    header: 'Order',
    className: 'hidden sm:table-cell',
    render: (row) => (
      <div className="text-[13px]">
        <p className="text-ink">{row.orderNumber ?? 'None'}</p>
        {row.amountMinor !== null && row.currency && (
          <p className="text-muted tabular-nums">{formatMoney(row.amountMinor, row.currency)}</p>
        )}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Outcome',
    render: (row) => (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge status={row.status} />
        <span className="text-xs text-muted">{formatRelative(row.updatedAt)}</span>
      </div>
    ),
  },
];

function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The URL is the state: filter, page and open request survive a reload and can be shared.
  const rawStatus = params.get('status');
  const status = rawStatus && STATUSES.has(rawStatus) ? (rawStatus as RequestStatus) : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const selectedId = params.get('request');

  const session = useSession();
  const list = useStaffRequests({ status, page });

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
  const total = meta ? Object.values(meta.counts).reduce((sum, n) => sum + n, 0) : null;
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        area="Support dashboard"
        person={session.data?.staff?.name}
        role="staff"
        aside={
          <Link
            href="/"
            className="hidden rounded-button px-3 py-1.5 text-[13px] text-ink-soft hover:bg-sunken sm:inline"
          >
            Try the customer chat
          </Link>
        }
      />

      <nav aria-label="Filter by outcome" className="border-b border-line bg-surface">
        <ul className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((tab) => {
            const count = tab.status ? meta?.counts[tab.status] : total;
            const active = tab.status === status;
            return (
              <li key={tab.label}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() =>
                    navigate({ status: tab.status ?? null, page: null, request: null })
                  }
                  className={cn(
                    'flex h-11 items-center gap-2 border-b-2 px-3 text-[13px] font-medium whitespace-nowrap',
                    active
                      ? 'border-ink text-ink'
                      : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {tab.label}
                  {count !== undefined && count !== null && (
                    <span className="rounded-full bg-sunken px-1.5 text-xs tabular-nums text-ink-soft">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        <section
          aria-label="Requests"
          // While a new filter loads, the previous rows stay visible but dimmed and marked busy.
          aria-busy={list.isPlaceholderData || undefined}
          className={cn(
            'h-fit overflow-hidden rounded-panel border border-line bg-surface transition-opacity duration-200 ease-in-out',
            list.isPlaceholderData && 'opacity-60',
            selectedId && 'hidden lg:block',
          )}
        >
          <DataTable
            caption="Refund requests, newest activity first"
            columns={COLUMNS}
            rows={list.data?.items}
            getRowId={(row) => row.id}
            selectedId={selectedId}
            onRowActivate={(row) => navigate({ request: row.id })}
            isLoading={list.isPending}
            error={list.error}
            onRetry={() => void list.refetch()}
            empty={{
              title: status ? 'Nothing here' : 'No requests yet',
              message: status
                ? 'No requests have this outcome yet.'
                : 'Requests appear here as soon as a customer writes in. Try the customer chat to send one.',
            }}
          />
          {meta && meta.total > 0 && (
            <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[13px] text-muted">
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
            <div className="rounded-panel border border-dashed border-line-strong">
              <EmptyState
                title="Choose a request"
                message="Open a request to see the conversation, the rules that decided it, the order's payment and delivery history, and the full audit trail. Escalated requests can be approved or denied here."
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
