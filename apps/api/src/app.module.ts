import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SessionGuard } from '@common';
import { env } from '@configs';
import { GlobalModule } from './global.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    GlobalModule,
    JwtModule.register({ global: true, secret: env.JWT_SECRET }),
    // 120 requests a minute per client IP by default; sign-in and chat routes set tighter limits.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    HealthModule,
    CustomersModule,
    AuthModule,
  ],
  providers: [
    // Order matters: throttle first, then require a session.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
