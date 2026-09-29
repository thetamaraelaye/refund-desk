import { Module } from '@nestjs/common';
import { CustomersModule } from '@modules/customers/customers.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [CustomersModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
