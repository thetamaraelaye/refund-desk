import { Controller, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@common';
import { PrismaConfig, env } from '@configs';
import { runSeed } from '../../database/seed-runner';

// Reviewer tools. They exist only with DEMO_MODE=true (docker-compose's default); otherwise every
// route here answers 404, as if it were not there.
@ApiTags('Demo')
@Public()
@Controller('demo')
export class DemoController {
  constructor(private readonly prisma: PrismaConfig) {}

  @Post('reset')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Restore the demo data: clears requests, app refunds and audits' })
  async reset() {
    if (!env.DEMO_MODE) throw new NotFoundException();
    await this.prisma.$transaction((tx) => runSeed(tx, true), {
      timeout: 30_000,
      maxWait: 10_000,
    });
  }
}
