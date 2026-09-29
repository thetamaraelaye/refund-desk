import { Module } from '@nestjs/common';
import { GlobalModule } from './global.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [GlobalModule, HealthModule],
})
export class AppModule {}
