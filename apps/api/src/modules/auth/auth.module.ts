import { Module } from '@nestjs/common';
import { CustomersModule } from '@modules/customers/customers.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [CustomersModule],
  controllers: [AuthController],
})
export class AuthModule {}
