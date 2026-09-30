import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsIn, IsString, Length } from 'class-validator';

export const TEST_DELIVERIES = ['DELIVERED_TODAY', 'DELIVERED_45_DAYS_AGO', 'IN_TRANSIT'] as const;
export type TestDelivery = (typeof TEST_DELIVERIES)[number];

export class PlaceTestOrderDto {
  @ApiProperty({
    description: 'Product SKUs from GET /v1/store/products',
    example: ['KIT-KETL-01'],
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 32, { each: true })
  skus: string[];

  @ApiProperty({ enum: TEST_DELIVERIES })
  @IsIn(TEST_DELIVERIES)
  delivery: TestDelivery;
}
