import { Module } from '@nestjs/common';
import { GlobalModule } from './global.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [GlobalModule, HealthModule, CustomersModule, AuthModule],
})
export class AppModule {}
