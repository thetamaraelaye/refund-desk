import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Provided once by GlobalModule. A second instance would open a second connection pool.
@Injectable()
export class PrismaConfig extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static instances = 0;
  private readonly logger = new Logger(PrismaConfig.name);

  constructor() {
    super();
    PrismaConfig.instances += 1;
    if (PrismaConfig.instances > 1) {
      this.logger.error(
        'PrismaConfig was created more than once; provide it only from GlobalModule',
      );
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
