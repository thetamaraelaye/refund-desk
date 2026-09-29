import { cn } from '@/components/ui/cn';
import { statusLabel } from '@/components/ui/status-badge';
import { formatDateTime } from '@/lib/format';
import type { Audit, RequestStatus, RuleResult } from '@/lib/types';

const RESULT_WORD: Record<RuleResult['result'], string> = {
  PASS: 'pass',
  FAIL: 'fail',
  SKIPPED: 'skip',
};

const OUTCOME_TONE: Record<RequestStatus, string> = {
  APPROVED: 'bg-approved-tint shadow-[inset_3px_0_0_var(--color-approved)]',
  DENIED: 'bg-denied-tint shadow-[inset_3px_0_0_var(--color-denied)]',
  ESCALATED: 'bg-escalated-tint shadow-[inset_3px_0_0_var(--color-escalated)]',
  NEEDS_INFO: 'bg-waiting-tint shadow-[inset_3px_0_0_var(--color-waiting)]',
};

// The rule trace, printed like an itemised till receipt: every rule the policy ran, in order, with the
// facts behind it. The first failing line decided the outcome and is marked.
export function DecisionReceipt({ audit, reference }: { audit: Audit; reference: number }) {
  const trace = audit.ruleTrace ?? [];
  const decisive = trace.find((line) => line.result === 'FAIL') ?? null;
  const readBy =
    audit.llmMode === 'mock'
      ? 'Mock model (no API key)'
      : audit.llmMode === 'anthropic'
        ? (audit.model ?? 'Claude')
        : 'No model call';

  return (
    <figure className="receipt-edge bg-receipt font-mono text-[12.5px] leading-relaxed text-ink">
      <figcaption className="px-5 pt-5">
        <p className="text-center text-[13px] font-semibold">Refund Desk</p>
        <p className="text-center text-muted">Decision for request #{reference}</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 text-muted">
          <dt>Decided</dt>
          <dd className="text-right">{formatDateTime(audit.createdAt)}</dd>
          <dt>Policy version</dt>
          <dd className="text-right">{audit.policyVersion}</dd>
          <dt>Message read by</dt>
          <dd className="text-right">{readBy}</dd>
          {audit.latencyMs !== null && audit.llmMode === 'anthropic' && (
            <>
              <dt>Model time</dt>
              <dd className="text-right">{(audit.latencyMs / 1000).toFixed(1)} s</dd>
            </>
          )}
          <dt>Reply</dt>
          <dd className="text-right">
            {audit.replySource === 'MODEL' ? 'Written by the model, checked' : 'Template'}
          </dd>
        </dl>
      </figcaption>

      <div aria-hidden="true" className="mx-5 my-4 border-t border-dashed border-line-strong" />

      <ol aria-label="Rules checked, in order">
        {trace.map((line) => {
          const isDecisive = line === decisive;
          return (
            <li
              key={line.rule}
              aria-current={isDecisive ? 'true' : undefined}
              className={cn(
                'px-5 py-1.5',
                line.result === 'SKIPPED' && 'text-muted',
                isDecisive && OUTCOME_TONE[audit.outcome],
              )}
            >
              <div className="flex gap-3">
                <span className="w-9 shrink-0">{line.clause}</span>
                <span className={cn('min-w-0 flex-1', isDecisive && 'font-semibold')}>
                  {line.title}
                </span>
                <span
                  className={cn(
                    'shrink-0',
                    line.result === 'FAIL' && 'font-semibold',
                    line.result === 'PASS' && 'text-approved',
                  )}
                >
                  {RESULT_WORD[line.result]}
                </span>
              </div>
              <p className="pl-12 text-muted">
                {line.detail}
                {isDecisive && <span className="sr-only"> This rule decided the outcome.</span>}
              </p>
            </li>
          );
        })}
      </ol>

      <div aria-hidden="true" className="mx-5 my-4 border-t border-dashed border-line-strong" />

      <div className="flex items-baseline justify-between px-5 text-[13px] font-semibold">
        <span>Outcome</span>
        <span>
          {statusLabel(audit.outcome)}
          {decisive ? ` under ${decisive.clause}` : ', every rule passed'}
        </span>
      </div>
    </figure>
  );
}
