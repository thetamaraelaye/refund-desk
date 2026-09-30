import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common';
import { StoreService } from './store.service';

@ApiTags('Store')
@Public()
@Controller('store')
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Get('products')
  @ApiOperation({ summary: "The store's products, for the help centre's shop grid" })
  products() {
    return this.store.products();
  }
}
