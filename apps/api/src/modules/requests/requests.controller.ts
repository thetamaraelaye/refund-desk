import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentCustomer, CustomerOnly, type CustomerSession } from '@common';
import { HandoffDto, SendMessageDto } from './dto/requests.dto';
import { RequestsService } from './requests.service';

@ApiTags('Refund requests (customer)')
@CustomerOnly()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  // Each message costs up to two model calls. 60 a minute per IP bounds that cost while leaving room
  // for a reviewer, or a team behind one office IP, running through the scenarios.
  @Post('messages')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a message; starts a request or continues an open one' })
  sendMessage(@CurrentCustomer() customer: CustomerSession, @Body() body: SendMessageDto) {
    return this.requests.sendMessage(customer, body.requestId, body.message);
  }

  @Post('handoff')
  @ApiOperation({ summary: 'Hand the request to a person' })
  handoff(@CurrentCustomer() customer: CustomerSession, @Body() body: HandoffDto) {
    return this.requests.handoff(customer, body.requestId);
  }

  @Get('mine')
  @ApiOperation({ summary: "The signed-in customer's recent requests" })
  listOwn(@CurrentCustomer() customer: CustomerSession) {
    return this.requests.listOwn(customer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One of your requests, with its conversation' })
  view(@CurrentCustomer() customer: CustomerSession, @Param('id') id: string) {
    return this.requests.view(customer, id);
  }
}
