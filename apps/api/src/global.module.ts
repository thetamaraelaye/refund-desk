import { Global, Module } from '@nestjs/common';
import { PrismaConfig } from '@configs';

@Global()
@Module({
  providers: [PrismaConfig],
  exports: [PrismaConfig],
})
export class GlobalModule {}
