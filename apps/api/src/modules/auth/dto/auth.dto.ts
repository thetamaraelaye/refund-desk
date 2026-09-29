import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CustomerSessionDto {
  @ApiProperty({ description: 'A demo customer id from GET /v1/auth/demo-customers' })
  @IsString()
  @Length(1, 64)
  customerId: string;
}

export class StaffSessionDto {
  @ApiProperty({ description: 'Shown on every decision this person makes', example: 'Ada Obi' })
  @IsString()
  @Length(2, 60)
  name: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  password: string;
}
