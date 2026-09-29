'use client';

import { useState } from 'react';
import { DecisionReceipt } from '@/components/decision-receipt';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TextArea } from '@/components/ui/field';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api';
import { formatDateTime, formatDay, formatMoney, formatRelative } from '@/lib/format';
import { AUDIT_KIND_LABELS, FLAG_LABELS, REASON_LABELS } from '@/lib/labels';
import { useResolveRequest, useStaffRequest } from '@/lib/queries';
import type { StaffRequestDetail } from '@/lib/types';

export function RequestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const detail = useStaffRequest(id);

  if (detail.isPending) {
    return (
      <Panel>
        <LoadingState label="Loading the request…" />
      </Panel>
    );
  }
  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <Panel>
        <ErrorState
          title={notFound ? 'This request no longer exists' : "Couldn't load this request"}
          message={notFound ? 'It may have been removed by a demo reset.' : detail.error.message}
          onRetry={notFound ? undefined : () => void detail.refetch()}
        />
      </Panel>
    );
  }

  const request = detail.data;
  // The decision the engine made; a specialist's ruling (if any) is listed in the audit trail.
  const decision = [...request.audits].reverse().find((audit) => audit.ruleTrace);

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start lg:hidden">
        Back to the list
      </Button>

      <Panel>
        <div className="flex flex-wrap items-start gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              Request #{request.reference}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {request.customer.name}, {request.customer.email}. Opened{' '}
              {formatRelative(request.createdAt)}.
            </p>
          </div>
          <StatusBadge status={request.status} className="h-7 px-3 text-[13px]" />
        </div>
        <dl className="grid gap-x-6 gap-y-3 border-t border-line p-5 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Order" value={request.order?.orderNumber ?? 'Not identified'} />
          <Fact label="Item" value={request.orderItem?.name ?? 'Not identified'} />
          <Fact
            label="Amount, from the order"
            value={
              request.amountMinor !== null && request.currency
                ? formatMoney(request.amountMinor, request.currency)
                : 'None'
            }
          />
          <Fact
            label="Reason given"
            value={REASON_LABELS[request.reasonCategory ?? ''] ?? 'Not given'}
          />
        </dl>
        {(request.summary || request.flags.length > 0) && (
          <div className="flex flex-col gap-2 border-t border-line p-5">
            {request.summary && (
              <p className="text-[13px] text-ink-soft">
                <span className="font-medium text-ink">Summary by the model: </span>
                {request.summary}
              </p>
            )}
            {request.flags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Flags">
                {request.flags.map((flag) => (
                  <li
                    key={flag}
                    className="rounded-full border border-escalated/30 bg-escalated-tint px-2.5 py-0.5 text-xs font-medium text-escalated"
                  >
                    {FLAG_LABELS[flag] ?? flag}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>

      {(request.status === 'ESCALATED' || request.status === 'NEEDS_INFO') && (
        <Resolution request={request} />
      )}
      {request.resolvedByName && request.resolvedAt && (
        <Panel className="p-5 text-[13px]">
          <p className="text-ink">
            <span className="font-semibold">{request.resolvedByName}</span>{' '}
            {request.status === 'APPROVED' ? 'approved' : 'denied'} this on{' '}
            {formatDateTime(request.resolvedAt)}.
          </p>
          {request.resolutionNote && (
            <p className="mt-1 text-ink-soft">Note: {request.resolutionNote}</p>
          )}
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold text-ink">How the policy decided</h3>
          {decision ? (
            <DecisionReceipt audit={decision} reference={request.reference} />
          ) : (
            <Panel className="p-5 text-[13px] text-muted">No automated decision yet.</Panel>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <OrderHistory request={request} />
          <CustomerCard request={request} />
        </div>
      </div>

      <Transcript request={request} />
      <AuditTrail request={request} />
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-panel border border-line bg-surface', className)}>{children}</div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink">{value}</dd>
    </div>
  );
}

function Resolution({ request }: { request: StaffRequestDetail }) {
  const resolve = useResolveRequest(request.id);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState<'APPROVE' | 'DENY' | null>(null);

  const noteError =
    touched && note.trim().length < 3 ? 'Add a short note for the audit trail.' : null;
  const refundable = request.amountMinor !== null && request.currency && request.orderItem;
  const amount = refundable ? formatMoney(request.amountMinor!, request.currency!) : null;

  const ask = (action: 'APPROVE' | 'DENY') => {
    setTouched(true);
    if (note.trim().length < 3) return;
    resolve.reset();
    setConfirming(action);
  };

  const confirm = () => {
    if (!confirming) return;
    resolve.mutate(
      { action: confirming, note: note.trim() },
      { onSuccess: () => setConfirming(null) },
    );
  };

  return (
    <Panel
      className={cn(
        'p-5',
        request.status === 'ESCALATED' ? 'border-escalated/40' : 'border-waiting/40',
      )}
    >
      <h3 className="text-sm font-semibold text-ink">Your ruling</h3>
      {request.status === 'NEEDS_INFO' && (
        <p className="mt-1 text-[13px] text-ink-soft">
          The assistant is waiting for the customer to reply. You can rule now, for example if they
          have gone quiet or you can see the answer in their order history.
        </p>
      )}
      <p className="mt-1 text-[13px] text-muted">
        {refundable
          ? `Approving refunds ${amount} for the ${request.orderItem!.name}, the price on the order. The customer is told either way.`
          : 'No item was identified, so this request can only be denied. The customer can start a new request with the details.'}
      </p>
      <div className="mt-4">
        <TextArea
          label="Note for the audit trail"
          hint="Not sent to the customer."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          error={noteError}
          rows={2}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {refundable && <Button onClick={() => ask('APPROVE')}>Approve refund of {amount}</Button>}
        <Button variant="destructive" onClick={() => ask('DENY')}>
          Deny request
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming === 'APPROVE' ? `Refund ${amount}?` : 'Deny this request?'}
        description={
          confirming === 'APPROVE' ? (
            <>
              {amount} goes back to {request.customer.name}&rsquo;s card for the{' '}
              {request.orderItem?.name}. This is recorded under your name and can&rsquo;t be undone
              here.
            </>
          ) : (
            <>
              {request.customer.name} is told a refund can&rsquo;t be approved. Your note stays on
              the audit trail.
            </>
          )
        }
        confirmLabel={confirming === 'APPROVE' ? `Refund ${amount}` : 'Deny request'}
        tone={confirming === 'DENY' ? 'destructive' : 'primary'}
        isLoading={resolve.isPending}
        error={resolve.error?.message ?? null}
        onConfirm={confirm}
        onClose={() => setConfirming(null)}
      />
    </Panel>
  );
}

function OrderHistory({ request }: { request: StaffRequestDetail }) {
  const order = request.order;
  if (!order) {
    return (
      <Panel className="p-5 text-[13px] text-muted">
        No order on this customer&rsquo;s account was identified.
        {request.flags.includes('CROSS_ACCOUNT') &&
          ' The message named an order that belongs to another customer; nothing about it was shown to them.'}
      </Panel>
    );
  }
  return (
    <Panel>
      <div className="flex items-baseline gap-2 border-b border-line px-5 py-3">
        <h3 className="text-sm font-semibold text-ink">{order.orderNumber}</h3>
        <p className="text-xs text-muted">
          Ordered {formatDay(order.placedAt)}
          {order.deliveredAt && `, delivered ${formatDay(order.deliveredAt)}`}
          {order.cancelledAt && `, cancelled ${formatDay(order.cancelledAt)}`}
        </p>
      </div>

      <table className="w-full text-[13px]">
        <caption className="sr-only">Items in {order.orderNumber}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="px-5 pt-3 pb-1 font-medium">
              Item
            </th>
            <th scope="col" className="px-5 pt-3 pb-1 text-right font-medium">
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.sku}>
              <td className="px-5 py-1 text-ink">
                {item.name}
                {item.quantity > 1 && <span className="text-muted"> × {item.quantity}</span>}
                {item.finalSale && <span className="ml-2 text-xs text-escalated">Final sale</span>}
                {item.refund && (
                  <span className="ml-2 text-xs text-approved">
                    Refunded {formatDay(item.refund.issuedAt)}
                  </span>
                )}
              </td>
              <td className="px-5 py-1 text-right tabular-nums text-ink">
                {formatMoney(item.unitPriceMinor * item.quantity, order.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="mt-4 px-5 text-xs font-medium text-muted">Payments</h4>
      <ul className="px-5 pt-1 pb-3 text-[13px]">
        {order.payments.map((payment) => (
          <li key={payment.reference} className="flex gap-3 py-0.5">
            <span className="w-16 shrink-0 text-muted">{formatDay(payment.occurredAt)}</span>
            <span className="min-w-0 flex-1 truncate text-ink-soft">
              {payment.kind === 'CHARGE' ? 'Charged' : 'Refunded'} to {payment.method}
            </span>
            <span
              className={cn(
                'tabular-nums',
                payment.kind === 'REFUND' ? 'text-approved' : 'text-ink',
              )}
            >
              {payment.kind === 'REFUND' ? '−' : ''}
              {formatMoney(payment.amountMinor, payment.currency)}
            </span>
          </li>
        ))}
      </ul>

      {order.shipmentEvents.length > 0 && (
        <>
          <h4 className="border-t border-line px-5 pt-3 text-xs font-medium text-muted">
            Tracking, {order.shipmentEvents[0].carrier}
          </h4>
          <ol className="px-5 pt-1 pb-4 text-[13px]">
            {order.shipmentEvents.map((event) => (
              <li key={`${event.status}-${event.occurredAt}`} className="flex gap-3 py-0.5">
                <span className="w-16 shrink-0 text-muted">{formatDay(event.occurredAt)}</span>
                <span className="text-ink-soft">{event.detail}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}

function CustomerCard({ request }: { request: StaffRequestDetail }) {
  const { customer } = request;
  return (
    <Panel className="p-5 text-[13px]">
      <h3 className="text-sm font-semibold text-ink">{customer.name}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-3">
        <Fact label="Customer since" value={formatDay(customer.createdAt)} />
        <Fact label="Refunds, last 90 days" value={String(customer.recentRefunds)} />
      </dl>
    </Panel>
  );
}

const SPEAKERS = { CUSTOMER: 'Customer', ASSISTANT: 'AI assistant', STAFF: 'Support team' };

function Transcript({ request }: { request: StaffRequestDetail }) {
  return (
    <Panel>
      <h3 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">
        Conversation
      </h3>
      <ol className="flex flex-col gap-3 p-5">
        {request.messages.map((message) => (
          <li key={message.id} className="text-[13px]">
            <p className="text-xs text-muted">
              {SPEAKERS[message.role]}, {formatDateTime(message.createdAt)}
            </p>
            <p
              className={cn(
                'mt-0.5 whitespace-pre-line leading-relaxed',
                message.role === 'CUSTOMER' ? 'text-ink' : 'text-ink-soft',
              )}
            >
              {message.body}
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function AuditTrail({ request }: { request: StaffRequestDetail }) {
  return (
    <Panel>
      <h3 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">
        Audit trail
        <span className="ml-2 font-normal text-muted">append-only, one entry per decision</span>
      </h3>
      <ol className="divide-y divide-line">
        {request.audits.map((audit) => (
          <li key={audit.id} className="p-5 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">
                {AUDIT_KIND_LABELS[audit.kind] ?? audit.kind}
              </span>
              <StatusBadge status={audit.outcome} className="h-5 px-2 text-[11px]" />
              <span className="text-muted">
                by {audit.actorName}, {formatDateTime(audit.createdAt)}
              </span>
            </div>
            {audit.kind !== 'STAFF_RESOLUTION' && (
              <p className="mt-1 text-muted">
                {audit.llmMode === 'anthropic'
                  ? `Read by ${audit.model}${audit.latencyMs !== null ? ` in ${(audit.latencyMs / 1000).toFixed(1)} s` : ''}. `
                  : audit.llmMode === 'mock'
                    ? 'Read by the mock model. '
                    : ''}
                {audit.replySource === 'MODEL'
                  ? 'Reply written by the model and passed the reply check.'
                  : 'Reply from the template.'}
              </p>
            )}
            {audit.extractionError && (
              <p className="mt-1 font-medium text-denied">Model failure: {audit.extractionError}</p>
            )}
            {audit.note && <p className="mt-1 text-ink-soft">{audit.note}</p>}
            {audit.extraction && (
              <details className="mt-2">
                <summary className="cursor-pointer rounded-button text-[13px] font-medium text-focus">
                  What the model read from the message
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-input bg-sunken p-3 font-mono text-xs leading-relaxed text-ink-soft">
                  {JSON.stringify(audit.extraction, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
