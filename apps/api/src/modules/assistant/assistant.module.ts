import { Logger, Module } from '@nestjs/common';
import { env } from '@configs';
import { AnthropicLlmClient } from './anthropic.client';
import { AssistantService } from './assistant.service';
import { LLM_CLIENT, type LlmClient } from './assistant.types';
import { MockLlmClient } from './mock.client';

function createLlmClient(): LlmClient {
  const logger = new Logger('Assistant');
  if (env.ANTHROPIC_API_KEY && !env.MOCK_LLM) {
    logger.log(`Using Claude (${env.ANTHROPIC_MODEL})`);
    return new AnthropicLlmClient({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      timeoutMs: env.LLM_TIMEOUT_MS,
    });
  }
  logger.log('No ANTHROPIC_API_KEY (or MOCK_LLM=true): using the deterministic mock model');
  return new MockLlmClient();
}

@Module({
  providers: [{ provide: LLM_CLIENT, useFactory: createLlmClient }, AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
