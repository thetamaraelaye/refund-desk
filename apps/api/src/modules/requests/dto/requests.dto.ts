import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Continue this open request; omit to start a new one' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  requestId?: string;

  @ApiProperty({ example: 'My pour-over set from ORD-1001 arrived with a cracked carafe.' })
  @IsString()
  @Length(1, 2000)
  message: string;
}

export class HandoffDto {
  @ApiPropertyOptional({ description: 'The request to hand over; omit to open a new one' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  requestId?: string;
}

export class ListRequestsQuery {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  // The working queue: escalated and waiting requests, oldest first. Ignored when status is set.
  @ApiPropertyOptional({ enum: ['attention'] })
  @IsOptional()
  @IsIn(['attention'])
  view?: 'attention';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  // Capped: the dashboard pages instead of asking the database for everything.
  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class ResolveRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'DENY'] })
  @IsIn(['APPROVE', 'DENY'])
  action: 'APPROVE' | 'DENY';

  @ApiProperty({ description: 'Why; kept on the audit trail, not sent to the customer' })
  @IsString()
  @Length(3, 500)
  note: string;
}
