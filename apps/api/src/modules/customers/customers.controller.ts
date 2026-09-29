import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer, CustomerOnly, type CustomerSession } from '@common';
import { CustomersService } from './customers.service';

@ApiTags('Customers')
@CustomerOnly()
@Controller('me')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('orders')
  @ApiOperation({ summary: "The signed-in customer's orders, newest first" })
  listOrders(@CurrentCustomer() customer: CustomerSession) {
    return this.customers.listOrders(customer.customerId);
  }
}
