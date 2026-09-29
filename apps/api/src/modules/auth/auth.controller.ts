import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '@common';
import { CustomersService } from '@modules/customers/customers.service';
import { AuthService } from './auth.service';
import { CustomerSessionDto, StaffSessionDto } from './dto/auth.dto';

// Five password attempts per minute per client IP. The demo customer picker has no secret to guess,
// so it only gets a looser limit that still stops a script hammering it.
const STAFF_SIGN_IN_LIMIT = { default: { limit: 5, ttl: 60_000 } };
const CUSTOMER_SIGN_IN_LIMIT = { default: { limit: 30, ttl: 60_000 } };

@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly customers: CustomersService,
    private readonly auth: AuthService,
  ) {}

  @Get('demo-customers')
  @ApiOperation({
    summary: 'Demo customers for the sign-in picker, with the scenarios each one covers',
  })
  listDemoCustomers() {
    return this.customers.listDemoCustomers();
  }

  @Post('customer-session')
  @Throttle(CUSTOMER_SIGN_IN_LIMIT)
  @ApiOperation({ summary: 'Sign in as a demo customer (sets an httpOnly cookie)' })
  startCustomerSession(
    @Body() body: CustomerSessionDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.startCustomerSession(body.customerId, response);
  }

  @Post('staff-session')
  @Throttle(STAFF_SIGN_IN_LIMIT)
  @ApiOperation({ summary: 'Sign in to the support dashboard (sets an httpOnly cookie)' })
  startStaffSession(@Body() body: StaffSessionDto, @Res({ passthrough: true }) response: Response) {
    return this.auth.startStaffSession(body.name, body.password, response);
  }

  @Get('session')
  @ApiOperation({ summary: 'Who is signed in, as a customer and as staff' })
  currentSessions(@Req() request: Request) {
    return this.auth.currentSessions(request.cookies as Record<string, string | undefined>);
  }

  @Delete('customer-session')
  @HttpCode(204)
  endCustomerSession(@Res({ passthrough: true }) response: Response) {
    this.auth.endSession('customer', response);
  }

  @Delete('staff-session')
  @HttpCode(204)
  endStaffSession(@Res({ passthrough: true }) response: Response) {
    this.auth.endSession('staff', response);
  }
}
