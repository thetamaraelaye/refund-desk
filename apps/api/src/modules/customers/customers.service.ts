import { Injectable } from '@nestjs/common';
import { PrismaConfig } from '@configs';
import { DEMO_SCENARIOS, type DemoScenario } from '../../database/demo-scenarios';

export interface DemoCustomer {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  scenarios: DemoScenario[];
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaConfig) {}

  // What a customer sees of their own orders: enough to name the order and item in a request.
  listOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      select: {
        orderNumber: true,
        status: true,
        currency: true,
        placedAt: true,
        deliveredAt: true,
        cancelledAt: true,
        items: {
          select: {
            sku: true,
            name: true,
            quantity: true,
            unitPriceMinor: true,
            finalSale: true,
            refund: { select: { issuedAt: true } },
          },
          orderBy: { sku: 'asc' },
        },
      },
      orderBy: { placedAt: 'desc' },
    });
  }

  // Customers behind the brief's six cases come first, in scenario order, then everyone else.
  async listDemoCustomers(): Promise<DemoCustomer[]> {
    const customers = await this.prisma.customer.findMany({
      select: { id: true, name: true, email: true, _count: { select: { orders: true } } },
      orderBy: { name: 'asc' },
    });

    const rank = (email: string) => {
      const index = DEMO_SCENARIOS.findIndex((s) => s.featured && s.customerEmail === email);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };

    return customers
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        orderCount: customer._count.orders,
        scenarios: DEMO_SCENARIOS.filter((s) => s.customerEmail === customer.email),
      }))
      .sort((a, b) => rank(a.email) - rank(b.email));
  }
}
