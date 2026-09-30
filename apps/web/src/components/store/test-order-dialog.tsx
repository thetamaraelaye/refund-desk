'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProductArt } from '@/components/product-art';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { formatMoney } from '@/lib/format';
import { usePlaceTestOrder } from '@/lib/queries';
import type { Product, TestDelivery } from '@/lib/types';

// Each state sets up a different part of the refund policy to try.
const DELIVERIES: { value: TestDelivery; label: string; tries: string }[] = [
  {
    value: 'DELIVERED_TODAY',
    label: 'Delivered today',
    tries: 'Inside the 30-day window. Say it arrived damaged, or that we sent the wrong one.',
  },
  {
    value: 'DELIVERED_45_DAYS_AGO',
    label: 'Delivered 45 days ago',
    tries: 'Outside the 30-day window, so a refund is declined.',
  },
  {
    value: 'IN_TRANSIT',
    label: 'Still on its way',
    tries: "Not delivered yet. Say it never arrived, or claim it's broken.",
  },
];

// Demo shop: places a real order, with its charge and tracking, so a tester can try the policy on it.
export function TestOrderDialog({
  product,
  signedIn,
  onClose,
}: {
  product: Product | null;
  signedIn: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const place = usePlaceTestOrder();
  const [delivery, setDelivery] = useState<TestDelivery>('DELIVERED_TODAY');

  const submit = () => {
    if (!product) return;
    place.mutate(
      { skus: [product.sku], delivery },
      { onSuccess: ({ orderNumber }) => router.push(`/chat?placed=${orderNumber}`) },
    );
  };

  return (
    <Dialog open={product !== null} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink/40 transition-opacity duration-200 ease-in-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          className="w-full max-w-md rounded-[16px] border border-line bg-surface p-6 shadow-xl transition duration-200 ease-in-out data-closed:translate-y-2 data-closed:scale-[0.98] data-closed:opacity-0"
        >
          {product && (
            <>
              <div className="flex items-center gap-4">
                <ProductArt sku={product.sku} className="w-20 shrink-0" />
                <div className="min-w-0">
                  <DialogTitle className="font-display text-[22px] leading-tight font-medium text-ink">
                    {product.name}
                  </DialogTitle>
                  <p className="mt-1 text-sm text-muted">
                    {formatMoney(product.priceMinor, product.currency)}
                    {product.finalSale && <span className="ml-2 text-escalated">Final sale</span>}
                  </p>
                </div>
              </div>

              {signedIn ? (
                <>
                  <fieldset className="mt-6">
                    <legend className="text-[13px] font-medium text-ink">
                      Place a test order, as if it was
                    </legend>
                    <div className="mt-2 flex flex-col gap-2">
                      {DELIVERIES.map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            'flex cursor-pointer gap-3 rounded-input border px-3 py-2.5 transition-colors duration-150 ease-in-out',
                            delivery === option.value
                              ? 'border-moss bg-moss-tint/60'
                              : 'border-line hover:border-line-strong',
                          )}
                        >
                          <input
                            type="radio"
                            name="delivery"
                            value={option.value}
                            checked={delivery === option.value}
                            onChange={() => setDelivery(option.value)}
                            className="mt-1 accent-moss"
                          />
                          <span>
                            <span className="block text-sm font-medium text-ink">
                              {option.label}
                            </span>
                            <span className="block text-[13px] text-muted">{option.tries}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p className="mt-4 text-xs text-muted">
                    A demo tool: it charges your demo card and creates real tracking, and
                    &ldquo;Reset demo data&rdquo; removes it.
                  </p>
                  {place.isError && (
                    <p role="alert" className="mt-3 text-sm font-medium text-denied">
                      {place.error.message}
                    </p>
                  )}
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={place.isPending}>
                      Cancel
                    </Button>
                    <Button variant="brand" onClick={submit} isLoading={place.isPending}>
                      Place test order
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-6 text-sm leading-relaxed text-ink-soft">
                    Sign in with a demo account to place a test order, then ask for help with it.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                      Cancel
                    </Button>
                    <a
                      href="#help"
                      onClick={onClose}
                      className="inline-flex h-10 items-center rounded-button bg-moss px-4 text-sm font-medium text-white hover:bg-moss-strong"
                    >
                      Sign in
                    </a>
                  </div>
                </>
              )}
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
