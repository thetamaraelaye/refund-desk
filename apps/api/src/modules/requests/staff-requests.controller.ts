import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffOnly, type StaffSession } from '@common';
import { ListRequestsQuery, ResolveRequestDto } from './dto/requests.dto';
import { StaffRequestsService } from './staff-requests.service';

@ApiTags('Refund requests (support staff)')
@StaffOnly()
@Controller('admin/requests')
export class StaffRequestsController {
  constructor(private readonly requests: StaffRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Recent requests, newest activity first, with counts by status' })
  list(@Query() query: ListRequestsQuery) {
    return this.requests.list(query);
  }

  @Get('metrics')
  @ApiOperation({ summary: "Headline numbers: open queue, oldest wait, today's approvals" })
  metrics() {
    return this.requests.metrics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'A request with its conversation, order history and full audit trail' })
  detail(@Param('id') id: string) {
    return this.requests.detail(id);
  }

  @Post(':id/resolution')
  @ApiOperation({ summary: 'Approve or deny an escalated request; recorded under your name' })
  resolve(
    @CurrentStaff() staff: StaffSession,
    @Param('id') id: string,
    @Body() body: ResolveRequestDto,
  ) {
    return this.requests.resolve(staff, id, body);
  }
}
