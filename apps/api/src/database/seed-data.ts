// Synthetic CRM. Dates are relative to the moment the seed runs, so the demo never goes stale.
export const SEED_CURRENCY = 'USD';

export interface SeedItem {
  sku: string;
  name: string;
  unitPriceMinor: number;
  quantity?: number;
  finalSale?: boolean;
  // Present when the item was refunded before this system existed.
  refundedDaysAgo?: number;
}

export interface SeedOrder {
  orderNumber: string;
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  placedDaysAgo: number;
  deliveredDaysAgo?: number;
  cancelledDaysAgo?: number;
  // Present when the charge was refunded in full on cancellation.
  cancellationRefundDaysAgo?: number;
  items: SeedItem[];
}

export interface SeedCustomer {
  name: string;
  email: string;
  customerSinceDaysAgo: number;
  orders: SeedOrder[];
}

export const SEED_CUSTOMERS: readonly SeedCustomer[] = [
  {
    name: 'Amara Okafor',
    email: 'amara.okafor@example.com',
    customerSinceDaysAgo: 420,
    orders: [
      {
        orderNumber: 'ORD-1001',
        status: 'DELIVERED',
        placedDaysAgo: 9,
        deliveredDaysAgo: 6,
        items: [
          { sku: 'KIT-POUR-01', name: 'Stoneware pour-over coffee set', unitPriceMinor: 4800 },
        ],
      },
      {
        orderNumber: 'ORD-0931',
        status: 'DELIVERED',
        placedDaysAgo: 84,
        deliveredDaysAgo: 80,
        items: [{ sku: 'HOM-NAPK-04', name: 'Linen napkin set (4)', unitPriceMinor: 3200 }],
      },
    ],
  },
  {
    name: 'Daniel Reyes',
    email: 'daniel.reyes@example.com',
    customerSinceDaysAgo: 210,
    orders: [
      {
        orderNumber: 'ORD-1002',
        status: 'DELIVERED',
        placedDaysAgo: 12,
        deliveredDaysAgo: 9,
        items: [
          {
            sku: 'APP-COAT-MW',
            name: 'Merino wool overcoat',
            unitPriceMinor: 18000,
            finalSale: true,
          },
        ],
      },
    ],
  },
  {
    name: 'Grace Kim',
    email: 'grace.kim@example.com',
    customerSinceDaysAgo: 365,
    orders: [
      {
        orderNumber: 'ORD-1003',
        status: 'DELIVERED',
        placedDaysAgo: 49,
        deliveredDaysAgo: 45,
        items: [{ sku: 'LGT-DESK-02', name: 'Adjustable LED desk lamp', unitPriceMinor: 8900 }],
      },
    ],
  },
  {
    name: 'Marcus Webb',
    email: 'marcus.webb@example.com',
    customerSinceDaysAgo: 150,
    orders: [
      {
        orderNumber: 'ORD-1004',
        status: 'DELIVERED',
        placedDaysAgo: 7,
        deliveredDaysAgo: 4,
        items: [{ sku: 'ELC-TV-55', name: '55-inch 4K smart TV', unitPriceMinor: 65000 }],
      },
    ],
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    customerSinceDaysAgo: 95,
    orders: [
      {
        orderNumber: 'ORD-1005',
        status: 'DELIVERED',
        placedDaysAgo: 10,
        deliveredDaysAgo: 7,
        items: [
          { sku: 'AUD-EARB-01', name: 'Wireless noise-isolating earbuds', unitPriceMinor: 12900 },
        ],
      },
    ],
  },
  {
    name: 'Tom Becker',
    email: 'tom.becker@example.com',
    customerSinceDaysAgo: 260,
    orders: [
      {
        orderNumber: 'ORD-1006',
        status: 'DELIVERED',
        placedDaysAgo: 8,
        deliveredDaysAgo: 5,
        items: [
          { sku: 'AUD-HEAD-02', name: 'Over-ear wireless headphones', unitPriceMinor: 12000 },
        ],
      },
    ],
  },
  {
    name: 'Chris Morgan',
    email: 'chris.morgan@example.com',
    customerSinceDaysAgo: 540,
    orders: [
      {
        orderNumber: 'ORD-0951',
        status: 'DELIVERED',
        placedDaysAgo: 74,
        deliveredDaysAgo: 70,
        items: [
          {
            sku: 'GDN-PLNT-03',
            name: 'Ceramic planter',
            unitPriceMinor: 2600,
            refundedDaysAgo: 65,
          },
        ],
      },
      {
        orderNumber: 'ORD-0967',
        status: 'DELIVERED',
        placedDaysAgo: 49,
        deliveredDaysAgo: 45,
        items: [{ sku: 'FIT-MAT-01', name: 'Yoga mat', unitPriceMinor: 3800, refundedDaysAgo: 40 }],
      },
      {
        orderNumber: 'ORD-0983',
        status: 'DELIVERED',
        placedDaysAgo: 29,
        deliveredDaysAgo: 25,
        items: [
          {
            sku: 'FIT-BOTL-02',
            name: 'Insulated water bottle',
            unitPriceMinor: 2200,
            refundedDaysAgo: 20,
          },
        ],
      },
      {
        orderNumber: 'ORD-1007',
        status: 'DELIVERED',
        placedDaysAgo: 6,
        deliveredDaysAgo: 3,
        items: [{ sku: 'AUD-SPKR-01', name: 'Portable Bluetooth speaker', unitPriceMinor: 7500 }],
      },
    ],
  },
  {
    name: 'Lena Fischer',
    email: 'lena.fischer@example.com',
    customerSinceDaysAgo: 40,
    orders: [
      {
        orderNumber: 'ORD-1008',
        status: 'SHIPPED',
        placedDaysAgo: 3,
        items: [{ sku: 'KIT-KETL-01', name: 'Glass pour-over kettle', unitPriceMinor: 6400 }],
      },
    ],
  },
  {
    name: 'Omar Haddad',
    email: 'omar.haddad@example.com',
    customerSinceDaysAgo: 300,
    orders: [
      {
        orderNumber: 'ORD-1009',
        status: 'DELIVERED',
        placedDaysAgo: 15,
        deliveredDaysAgo: 12,
        items: [
          {
            sku: 'KIT-BLND-01',
            name: 'Countertop blender',
            unitPriceMinor: 30000,
            refundedDaysAgo: 6,
          },
          { sku: 'KIT-MIXR-01', name: 'Stand mixer', unitPriceMinor: 30000 },
        ],
      },
    ],
  },
  {
    name: 'Sofia Rossi',
    email: 'sofia.rossi@example.com',
    customerSinceDaysAgo: 180,
    orders: [
      {
        orderNumber: 'ORD-1010',
        status: 'DELIVERED',
        placedDaysAgo: 8,
        deliveredDaysAgo: 5,
        items: [
          { sku: 'KIT-MUGS-04', name: 'Ceramic mug set (4)', unitPriceMinor: 3600 },
          { sku: 'KIT-PRES-01', name: 'French press, 1 litre', unitPriceMinor: 4200 },
          { sku: 'KIT-GRND-01', name: 'Burr coffee grinder', unitPriceMinor: 9500 },
        ],
      },
    ],
  },
  {
    name: 'Ethan Brooks',
    email: 'ethan.brooks@example.com',
    customerSinceDaysAgo: 75,
    orders: [
      {
        orderNumber: 'ORD-1011',
        status: 'DELIVERED',
        placedDaysAgo: 9,
        deliveredDaysAgo: 6,
        items: [{ sku: 'APP-SHOE-RN', name: 'Running shoes', unitPriceMinor: 9500 }],
      },
    ],
  },
  {
    name: 'Aisha Bello',
    email: 'aisha.bello@example.com',
    customerSinceDaysAgo: 130,
    orders: [
      {
        orderNumber: 'ORD-1012',
        status: 'DELIVERED',
        placedDaysAgo: 7,
        deliveredDaysAgo: 4,
        items: [{ sku: 'BED-PILW-SK', name: 'Silk pillowcase', unitPriceMinor: 4500 }],
      },
    ],
  },
  {
    name: 'Hannah Lee',
    email: 'hannah.lee@example.com',
    customerSinceDaysAgo: 60,
    orders: [
      {
        orderNumber: 'ORD-1013',
        status: 'DELIVERED',
        placedDaysAgo: 6,
        deliveredDaysAgo: 3,
        items: [{ sku: 'APP-SCRF-SK', name: 'Silk scarf', unitPriceMinor: 6500, finalSale: true }],
      },
    ],
  },
  {
    name: 'Kwame Mensah',
    email: 'kwame.mensah@example.com',
    customerSinceDaysAgo: 400,
    orders: [
      {
        orderNumber: 'ORD-1014',
        status: 'DELIVERED',
        placedDaysAgo: 13,
        deliveredDaysAgo: 10,
        items: [{ sku: 'OFF-STND-01', name: 'Aluminium laptop stand', unitPriceMinor: 5900 }],
      },
      {
        orderNumber: 'ORD-0990',
        status: 'DELIVERED',
        placedDaysAgo: 64,
        deliveredDaysAgo: 60,
        items: [{ sku: 'OFF-HUB-07', name: 'USB-C hub, 7-port', unitPriceMinor: 4900 }],
      },
      {
        orderNumber: 'ORD-1016',
        status: 'CANCELLED',
        placedDaysAgo: 6,
        cancelledDaysAgo: 5,
        cancellationRefundDaysAgo: 5,
        items: [{ sku: 'OFF-CHAIR-01', name: 'Ergonomic office chair', unitPriceMinor: 24900 }],
      },
    ],
  },
  {
    name: 'Julia Santos',
    email: 'julia.santos@example.com',
    customerSinceDaysAgo: 230,
    orders: [
      {
        orderNumber: 'ORD-1015',
        status: 'DELIVERED',
        placedDaysAgo: 11,
        deliveredDaysAgo: 8,
        items: [{ sku: 'BTH-TOWL-GR', name: 'Cotton bath towel set, grey', unitPriceMinor: 5400 }],
      },
      {
        orderNumber: 'ORD-0977',
        status: 'DELIVERED',
        placedDaysAgo: 39,
        deliveredDaysAgo: 35,
        items: [{ sku: 'HOM-CNDL-03', name: 'Scented candle trio', unitPriceMinor: 2800 }],
      },
      {
        orderNumber: 'ORD-1017',
        status: 'CANCELLED',
        placedDaysAgo: 3,
        cancelledDaysAgo: 2,
        items: [{ sku: 'APP-RAIN-JK', name: 'Packable rain jacket', unitPriceMinor: 8900 }],
      },
    ],
  },
];

// Seeded payment references share this prefix, so a reset can remove only what the app wrote.
export const SEED_REFERENCE_PREFIX = 'seed_';

const SEED_CARDS = [
  'Visa •••• 4242',
  'Mastercard •••• 4444',
  'Visa •••• 1881',
  'Amex •••• 0005',
  'Mastercard •••• 5100',
] as const;

export const seedCardFor = (customerIndex: number) => SEED_CARDS[customerIndex % SEED_CARDS.length];

export const seedLineMinor = (item: SeedItem) => item.unitPriceMinor * (item.quantity ?? 1);

export const seedOrderTotalMinor = (order: SeedOrder) =>
  order.items.reduce((sum, item) => sum + seedLineMinor(item), 0);

export interface SeedPayment {
  kind: 'CHARGE' | 'REFUND';
  reference: string;
  amountMinor: number;
  daysAgo: number;
  // The item a refund pays out; absent for the charge and for a cancellation refund.
  sku?: string;
}

// Every seeded order was charged in full at checkout; refunds follow item refunds and cancellations.
export function seedPayments(order: SeedOrder): SeedPayment[] {
  const payments: SeedPayment[] = [
    {
      kind: 'CHARGE',
      reference: `${SEED_REFERENCE_PREFIX}ch_${order.orderNumber}`,
      amountMinor: seedOrderTotalMinor(order),
      daysAgo: order.placedDaysAgo,
    },
  ];
  for (const item of order.items) {
    if (item.refundedDaysAgo === undefined) continue;
    payments.push({
      kind: 'REFUND',
      reference: `${SEED_REFERENCE_PREFIX}re_${order.orderNumber}_${item.sku}`,
      amountMinor: seedLineMinor(item),
      daysAgo: item.refundedDaysAgo,
      sku: item.sku,
    });
  }
  if (order.cancellationRefundDaysAgo !== undefined) {
    payments.push({
      kind: 'REFUND',
      reference: `${SEED_REFERENCE_PREFIX}re_${order.orderNumber}`,
      amountMinor: seedOrderTotalMinor(order),
      daysAgo: order.cancellationRefundDaysAgo,
    });
  }
  return payments;
}

export interface SeedShipmentEvent {
  status: 'LABEL_CREATED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  carrier: string;
  detail: string;
  daysAgo: number;
}

const CARRIERS = ['UPS', 'FedEx', 'DHL'] as const;

// A plain tracking history for every order that left the warehouse; the DELIVERED scan is deliveredAt.
export function seedShipmentEvents(order: SeedOrder): SeedShipmentEvent[] {
  if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') return [];
  const carrier = CARRIERS[Number(order.orderNumber.replace(/\D/g, '')) % CARRIERS.length];
  const events: SeedShipmentEvent[] = [
    {
      status: 'LABEL_CREATED',
      carrier,
      detail: 'Label created, awaiting pickup',
      daysAgo: order.placedDaysAgo - 0.25,
    },
    {
      status: 'IN_TRANSIT',
      carrier,
      detail: 'Departed carrier facility',
      daysAgo: order.placedDaysAgo - 1,
    },
  ];
  if (order.deliveredDaysAgo !== undefined) {
    events.push(
      {
        status: 'OUT_FOR_DELIVERY',
        carrier,
        detail: 'Out for delivery',
        daysAgo: order.deliveredDaysAgo + 0.25,
      },
      {
        status: 'DELIVERED',
        carrier,
        detail: 'Delivered, left at front door',
        daysAgo: order.deliveredDaysAgo,
      },
    );
  }
  return events;
}
