'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { DemoDrawer } from '@/components/demo-drawer';
import { OrderCard } from '@/components/store/order-card';
import { Button, Spinner } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import {
  useCustomerRequest,
  useDemoCustomers,
  useHandoff,
  useMyOrders,
  useMyRequests,
  useSendMessage,
  useSession,
} from '@/lib/queries';
import type { ChatMessage, CustomerRequest } from '@/lib/types';

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

  // Starting from the item, as real help centres do: the message opens already naming the order and
  // item, so the customer only has to say what went wrong.
  const getHelp = (orderNumber: string, itemName: string) => {
    const opener = `I need help with the ${itemName} from ${orderNumber}. `;
    if (!open) {
      send.reset();
      router.replace('/chat', { scroll: false });
      setEdited(opener);
    } else {
      setEdited((text) => {
        const base = (text ?? draft).trimEnd();
        return base ? `${base} ${opener}` : opener;
      });
    }
    requestAnimationFrame(() => document.getElementById('message')?.focus());
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader brand="store" person={session.data?.customer?.name} />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div>
            <h1 className="font-display text-[34px] leading-tight font-medium tracking-tight text-ink">
              Your orders
            </h1>
            <p className="mt-1 text-[15px] text-ink-soft">
              Choose the item that needs attention, or just tell us what happened.
            </p>
          </div>
          <OrdersPanel onGetHelp={getHelp} />
          <PastRequests activeId={requestId} />
        </div>
        <section
          aria-labelledby="chat-heading"
          className="flex min-h-[70dvh] flex-col rounded-[14px] border border-line bg-surface lg:sticky lg:top-6 lg:h-[calc(100dvh-10rem)] lg:min-h-0 lg:self-start"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
            <div className="min-w-0">
              <h2 id="chat-heading" className="text-[15px] font-semibold text-ink">
                {request ? `Request #${request.reference}` : 'New request'}
              </h2>
              <p className="text-[13px] text-muted">Larkfield help</p>
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
            working={send.isPending ? 'message' : handoff.isPending ? 'handoff' : null}
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
                      : 'Tell us what went wrong, for example "my pour-over set arrived cracked".'
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
      </main>
      <DemoDrawer />
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
  working,
}: {
  request: CustomerRequest | null;
  loading: boolean;
  pendingText: string | null;
  working: WorkingMode | null;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = (request?.messages.length ?? 0) + (pendingText ? 1 : 0);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [count, working]);

  if (loading) return <LoadingState label="Loading the conversation…" className="flex-1" />;

  const messages = request?.messages ?? [];
  return (
    <div
      // A labelled, focusable log: keyboard users can scroll it, and new messages are announced.
      role="log"
      aria-label="Conversation"
      tabIndex={0}
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
    >
      {messages.length === 0 && !pendingText && (
        <div className="max-w-md py-6">
          <p className="text-[15px] font-medium text-ink">How can we help?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Choose &ldquo;Get help with this item&rdquo; next to the item in your orders, or just
            tell us what went wrong. If it&rsquo;s clear which order you mean, you don&rsquo;t need
            the order number.
          </p>
        </div>
      )}
      {messages.map((message) => (
        <Bubble key={message.id} role={message.role} body={message.body} at={message.createdAt} />
      ))}
      {pendingText && <Bubble role="CUSTOMER" body={pendingText} />}
      {working && <Working mode={working} />}
      <div ref={end} />
    </div>
  );
}

type WorkingMode = 'message' | 'handoff';

// The stages every message really goes through, in order. The API answers in one response, so the
// steps advance on a schedule close to typical timings, and the last one holds until the reply lands.
const STEPS: Record<WorkingMode, { label: string; at: number }[]> = {
  message: [
    { label: 'Reading your message', at: 0 },
    { label: 'Finding your order and payments', at: 1_800 },
    { label: 'Checking our refund policy', at: 3_000 },
    { label: 'Writing your reply', at: 4_000 },
  ],
  handoff: [
    { label: 'Saving your conversation', at: 0 },
    { label: 'Passing it to our support team', at: 900 },
  ],
};

function Working({ mode }: { mode: WorkingMode }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(timer);
  }, []);

  const steps = STEPS[mode];
  const current = steps.findLastIndex((step) => elapsed >= step.at);

  return (
    <div className="flex max-w-[85%] flex-col gap-1 self-start">
      <p className="text-xs text-muted">AI assistant</p>
      <div className="rounded-panel rounded-bl-sm border border-line bg-surface px-4 py-3">
        <p className="sr-only">{steps[current].label}…</p>
        <ol aria-hidden="true" className="flex flex-col gap-2">
          {steps.map((step, index) => {
            const done = index < current;
            const active = index === current;
            return (
              <li
                key={step.label}
                className={cn(
                  'flex items-center gap-2.5 text-sm transition-all duration-300 ease-in-out',
                  index > current && 'translate-y-0.5 opacity-40',
                  active ? 'font-medium text-ink' : done ? 'text-ink-soft' : 'text-muted',
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {done ? (
                    <span className="text-[13px] leading-none text-approved">✓</span>
                  ) : active ? (
                    <Spinner className="size-3.5 text-ink-soft" />
                  ) : (
                    <span className="size-2 rounded-full border border-line-strong" />
                  )}
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>
        {elapsed > 12_000 && (
          <p className="mt-2 text-xs text-muted">
            Taking a little longer than usual. Still working on it.
          </p>
        )}
      </div>
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

function OrdersPanel({
  onGetHelp,
}: {
  onGetHelp: (orderNumber: string, itemName: string) => void;
}) {
  const orders = useMyOrders();
  return (
    <section aria-label="Order history" className="flex flex-col gap-4">
      {orders.isPending && <LoadingState label="Loading your orders…" />}
      {orders.isError && (
        <ErrorState
          title="Couldn't load your orders"
          message={orders.error.message}
          onRetry={() => void orders.refetch()}
        />
      )}
      {orders.data?.map((order) => (
        <OrderCard key={order.orderNumber} order={order} onGetHelp={onGetHelp} />
      ))}
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
