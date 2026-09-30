import { Injectable } from '@nestjs/common';
import { PrismaConfig } from '@configs';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaConfig) {}

  // The synthetic store has no product table: its catalogue is every SKU that has been sold, at the
  // price it sold for.
  async products() {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['sku', 'name'],
      _min: { unitPriceMinor: true },
      orderBy: { sku: 'asc' },
    });
    return rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      priceMinor: row._min.unitPriceMinor ?? 0,
      currency: 'USD',
    }));
  }
}
