import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  controllers: [StoreController, DemoController],
  providers: [StoreService],
})
export class StoreModule {}
