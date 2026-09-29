'use client';

import { useEffect, useState } from 'react';

interface DemoCustomer {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  scenarios: { key: string; title: string; featured: boolean }[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; customers: DemoCustomer[] };

// Placeholder until the support chat lands: proves browser -> Next rewrite -> API -> Postgres.
export default function Home() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    fetch('/api/v1/auth/demo-customers')
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean;
          message?: string;
          data: DemoCustomer[];
        };
        if (!response.ok || !body.success) {
          throw new Error(body.message ?? `Request failed with ${response.status}`);
        }
        setState({ kind: 'ready', customers: body.data });
      })
      .catch((error: unknown) => {
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Refund Desk</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Demo customers, served by the API through the rewrite.
      </p>

      {state.kind === 'loading' && <p className="mt-8 text-sm text-zinc-500">Loading customers…</p>}
      {state.kind === 'error' && (
        <p role="alert" className="mt-8 text-sm text-red-700">
          Could not load customers: {state.message}
        </p>
      )}
      {state.kind === 'ready' && (
        <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {state.customers.map((customer) => (
            <li
              key={customer.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-zinc-500">{customer.email}</p>
              </div>
              <p className="text-right text-zinc-500">
                {customer.scenarios.map((scenario) => scenario.title).join(' · ') ||
                  `${customer.orderCount} orders`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
