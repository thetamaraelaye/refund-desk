import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from '@modules/customers/customers.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly customers: CustomersService) {}

  @Get('demo-customers')
  @ApiOperation({
    summary: 'Demo customers for the sign-in picker, with the scenarios each one covers',
  })
  listDemoCustomers() {
    return this.customers.listDemoCustomers();
  }
}
