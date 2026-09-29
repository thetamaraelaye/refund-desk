'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api';
import { formatDay, formatMoney, formatRelative } from '@/lib/format';
import {
  useCustomerRequest,
  useDemoCustomers,
  useHandoff,
  useMyOrders,
  useMyRequests,
  useSendMessage,
  useSession,
} from '@/lib/queries';
import type { ChatMessage, CustomerOrder, CustomerRequest } from '@/lib/types';

export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}

const MAX_MESSAGE = 2000;

function Chat() {
  const router = useRouter();
  const params = useSearchParams();
  // The URL is the state: which request is open, and which demo scenario to prefill.
  const requestId = params.get('request');
  const scenarioKey = params.get('try');

  const session = useSession();
  const demoCustomers = useDemoCustomers();
  const current = useCustomerRequest(requestId);
  const send = useSendMessage();
  const handoff = useHandoff();

  const scenarioMessage = scenarioKey
    ? demoCustomers.data?.flatMap((c) => c.scenarios).find((s) => s.key === scenarioKey)?.message
    : undefined;
  const [edited, setEdited] = useState<string | null>(null);
  const draft = edited ?? scenarioMessage ?? '';
  const [pendingText, setPendingText] = useState<string | null>(null);

  const request = current.data ?? null;
  const open = request === null || request.open;
  const signedOut = current.error instanceof ApiError && current.error.status === 401;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || send.isPending || !open) return;
    setPendingText(message);
    send.mutate(
      { requestId: request?.open ? request.id : undefined, message },
      {
        onSuccess: (updated) => {
          setEdited('');
          router.replace(`/chat?request=${updated.id}`, { scroll: false });
        },
        onSettled: () => setPendingText(null),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const askForPerson = () =>
    handoff.mutate(request?.id, {
      onSuccess: (updated) => router.replace(`/chat?request=${updated.id}`, { scroll: false }),
    });

  const startNew = () => {
    setEdited('');
    send.reset();
    router.replace('/chat', { scroll: false });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader area="Help with an order" person={session.data?.customer?.name} role="customer" />
      <main className="mx-auto grid w-full max-w-[1200px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-labelledby="chat-heading"
          className="flex min-h-[70dvh] flex-col rounded-panel border border-line bg-surface"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
            <div className="min-w-0">
              <h1 id="chat-heading" className="text-[15px] font-semibold text-ink">
                {request ? `Request #${request.reference}` : 'New request'}
              </h1>
              <p className="text-[13px] text-muted">Refund Desk assistant</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {request && <StatusBadge status={request.status} audience="customer" />}
              {request?.status !== 'ESCALATED' && request?.status !== 'APPROVED' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={askForPerson}
                  isLoading={handoff.isPending}
                  disabled={send.isPending}
                >
                  Talk to a person
                </Button>
              )}
            </div>
          </div>

          <p className="border-b border-line bg-sunken/60 px-5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
            You&rsquo;re talking to an AI assistant. It explains decisions; our written refund
            policy makes them, using your order records. You can ask for a person at any time.
          </p>

          <Conversation
            request={request}
            loading={Boolean(requestId) && current.isPending}
            pendingText={pendingText}
            reading={send.isPending || handoff.isPending}
          />

          {current.isError && !signedOut && (
            <ErrorState
              title="Couldn't load this conversation"
              message={current.error.message}
              onRetry={() => void current.refetch()}
            />
          )}
          {signedOut && (
            <EmptyState
              title="Your session has ended"
              message="Sign in again to carry on with this request."
              action={
                <Link href="/" className="text-sm font-medium text-focus underline">
                  Go to sign in
                </Link>
              }
            />
          )}

          <div className="border-t border-line p-4">
            {open ? (
              <form onSubmit={submit} className="flex flex-col gap-2">
                <label htmlFor="message" className="sr-only">
                  Your message
                </label>
                <textarea
                  id="message"
                  value={draft}
                  onChange={(e) => setEdited(e.target.value)}
                  onKeyDown={onKeyDown}
                  maxLength={MAX_MESSAGE}
                  rows={3}
                  placeholder={
                    request
                      ? 'Reply to the assistant…'
                      : 'Tell us what went wrong, and include your order number (it starts with ORD-).'
                  }
                  aria-describedby="message-help"
                  className="w-full resize-none rounded-input border border-line bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted hover:border-line-strong"
                />
                <div className="flex items-center gap-3">
                  <p id="message-help" className="text-xs text-muted">
                    Enter to send, Shift+Enter for a new line.
                  </p>
                  {send.isError && (
                    <p role="alert" className="text-xs font-medium text-denied">
                      {send.error.message}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="ml-auto"
                    isLoading={send.isPending}
                    disabled={!draft.trim()}
                  >
                    Send
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink-soft">
                  {request?.status === 'ESCALATED'
                    ? 'A member of our support team has this request. Their reply will appear here.'
                    : request?.status === 'APPROVED'
                      ? 'Your refund is on its way. Need help with something else?'
                      : 'This request is closed. If something else went wrong, start a new request.'}
                </p>
                <Button variant="secondary" className="ml-auto" onClick={startNew}>
                  Start a new request
                </Button>
              </div>
            )}
            {handoff.isError && (
              <p role="alert" className="mt-2 text-xs font-medium text-denied">
                {handoff.error.message}
              </p>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6" aria-label="Your orders and requests">
          <OrdersPanel
            onUseOrder={(orderNumber) =>
              setEdited((text) => {
                const base = text ?? draft;
                return base.includes(orderNumber)
                  ? base
                  : `${base}${base ? ' ' : ''}${orderNumber}`;
              })
            }
            canUse={open}
          />
          <PastRequests activeId={requestId} />
        </aside>
      </main>
    </div>
  );
}

const SPEAKERS: Record<ChatMessage['role'], string> = {
  CUSTOMER: 'You',
  ASSISTANT: 'AI assistant',
  STAFF: 'Support team',
};

function Conversation({
  request,
  loading,
  pendingText,
  reading,
}: {
  request: CustomerRequest | null;
  loading: boolean;
  pendingText: string | null;
  reading: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = (request?.messages.length ?? 0) + (pendingText ? 1 : 0);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [count, reading]);

  if (loading) return <LoadingState label="Loading the conversation…" className="flex-1" />;

  const messages = request?.messages ?? [];
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5" aria-live="polite">
      {messages.length === 0 && !pendingText && (
        <div className="max-w-md py-6">
          <p className="text-[15px] font-medium text-ink">How can we help?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Tell us what went wrong with an order, for example a damaged or wrong item. Your orders
            are listed alongside, so you can add the order number with one click.
          </p>
        </div>
      )}
      {messages.map((message) => (
        <Bubble key={message.id} role={message.role} body={message.body} at={message.createdAt} />
      ))}
      {pendingText && <Bubble role="CUSTOMER" body={pendingText} />}
      {reading && (
        <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
          <span aria-hidden="true" className="flex gap-1">
            <span className="reading-dot size-1.5 rounded-full bg-muted" />
            <span className="reading-dot size-1.5 rounded-full bg-muted [animation-delay:150ms]" />
            <span className="reading-dot size-1.5 rounded-full bg-muted [animation-delay:300ms]" />
          </span>
          Checking your order records…
        </p>
      )}
      <div ref={end} />
    </div>
  );
}

function Bubble({ role, body, at }: { role: ChatMessage['role']; body: string; at?: string }) {
  const mine = role === 'CUSTOMER';
  return (
    <div
      className={cn('flex max-w-[85%] flex-col gap-1', mine ? 'self-end items-end' : 'self-start')}
    >
      <p className="text-xs text-muted">
        {SPEAKERS[role]}
        {at && <span className="sr-only">, {formatRelative(at)}</span>}
      </p>
      <p
        className={cn(
          'rounded-panel px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line',
          mine && 'rounded-br-sm bg-ink text-white',
          role === 'ASSISTANT' && 'rounded-bl-sm border border-line bg-surface text-ink',
          role === 'STAFF' && 'rounded-bl-sm border border-waiting/30 bg-waiting-tint text-ink',
        )}
      >
        {body}
      </p>
    </div>
  );
}

const ORDER_STATUS: Record<CustomerOrder['status'], string> = {
  PROCESSING: 'Processing',
  SHIPPED: 'On its way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function OrdersPanel({
  onUseOrder,
  canUse,
}: {
  onUseOrder: (orderNumber: string) => void;
  canUse: boolean;
}) {
  const orders = useMyOrders();
  return (
    <section
      aria-labelledby="orders-heading"
      className="rounded-panel border border-line bg-surface"
    >
      <h2
        id="orders-heading"
        className="border-b border-line px-4 py-3 text-sm font-semibold text-ink"
      >
        Your orders
      </h2>
      {orders.isPending && <LoadingState label="Loading orders…" />}
      {orders.isError && (
        <ErrorState
          title="Couldn't load your orders"
          message={orders.error.message}
          onRetry={() => void orders.refetch()}
        />
      )}
      <ul className="divide-y divide-line">
        {orders.data?.map((order) => {
          const when =
            order.status === 'DELIVERED' && order.deliveredAt
              ? `Delivered ${formatDay(order.deliveredAt)}`
              : order.status === 'CANCELLED' && order.cancelledAt
                ? `Cancelled ${formatDay(order.cancelledAt)}`
                : `${ORDER_STATUS[order.status]}, ordered ${formatDay(order.placedAt)}`;
          return (
            <li key={order.orderNumber} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink">{order.orderNumber}</p>
                <button
                  type="button"
                  onClick={() => onUseOrder(order.orderNumber)}
                  disabled={!canUse}
                  className="ml-auto rounded-button px-2 py-1 text-xs font-medium text-focus hover:bg-sunken disabled:text-muted"
                  aria-label={`Add ${order.orderNumber} to your message`}
                >
                  Add to message
                </button>
              </div>
              <p className="text-xs text-muted">{when}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {order.items.map((item) => (
                  <li
                    key={item.sku}
                    className="flex items-baseline gap-2 text-[13px] text-ink-soft"
                  >
                    <span className="min-w-0 flex-1">
                      {item.name}
                      {item.finalSale && (
                        <span className="ml-1.5 text-xs text-escalated">Final sale</span>
                      )}
                      {item.refund && (
                        <span className="ml-1.5 text-xs text-approved">Refunded</span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(item.unitPriceMinor * item.quantity, order.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PastRequests({ activeId }: { activeId: string | null }) {
  const requests = useMyRequests();
  if (!requests.data?.length) return null;
  return (
    <section aria-labelledby="past-heading" className="rounded-panel border border-line bg-surface">
      <h2
        id="past-heading"
        className="border-b border-line px-4 py-3 text-sm font-semibold text-ink"
      >
        Your requests
      </h2>
      <ul className="divide-y divide-line">
        {requests.data.map((request) => {
          const first = request.messages.find((m) => m.role === 'CUSTOMER');
          return (
            <li key={request.id}>
              <Link
                href={`/chat?request=${request.id}`}
                scroll={false}
                aria-current={request.id === activeId ? 'page' : undefined}
                className="flex flex-col gap-1.5 px-4 py-3 hover:bg-sunken aria-[current=page]:bg-sunken"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">#{request.reference}</span>
                  <span className="text-xs text-muted">{formatRelative(request.updatedAt)}</span>
                  <StatusBadge
                    status={request.status}
                    audience="customer"
                    className="ml-auto h-5 px-2 text-[11px]"
                  />
                </span>
                {first && (
                  <span className="line-clamp-2 text-[13px] text-ink-soft">{first.body}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
