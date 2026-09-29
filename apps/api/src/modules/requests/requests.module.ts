import { Module } from '@nestjs/common';
import { AssistantModule } from '@modules/assistant/assistant.module';
import { PolicyFactsService } from './policy-facts.service';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { StaffRequestsController } from './staff-requests.controller';
import { StaffRequestsService } from './staff-requests.service';

@Module({
  imports: [AssistantModule],
  controllers: [RequestsController, StaffRequestsController],
  providers: [PolicyFactsService, RequestsService, StaffRequestsService],
})
export class RequestsModule {}
