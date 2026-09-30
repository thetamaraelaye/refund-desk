import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentCustomer, CustomerOnly, Public, type CustomerSession } from '@common';
import { PlaceTestOrderDto } from './dto/store.dto';
import { StoreService } from './store.service';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Get('products')
  @Public()
  @ApiOperation({ summary: "The store's products, for the storefront" })
  products() {
    return this.store.products();
  }

  // Demo shop (DEMO_MODE only): lets a tester create fresh orders to try the refund policy on.
  @Post('orders')
  @CustomerOnly()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Place a test order, delivered today, 45 days ago, or still on its way',
  })
  placeTestOrder(@CurrentCustomer() customer: CustomerSession, @Body() body: PlaceTestOrderDto) {
    return this.store.placeTestOrder(customer, body.skus, body.delivery);
  }
}
