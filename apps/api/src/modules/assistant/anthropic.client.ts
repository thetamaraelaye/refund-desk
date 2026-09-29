import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { ReplyBrief, ReplyDraft } from '@domain';
import type { z } from 'zod';
import {
  ExtractionSchema,
  LlmFailure,
  ReplyDraftSchema,
  type Extraction,
  type LlmCall,
  type LlmClient,
  type LlmResult,
  type ReadInput,
} from './assistant.types';
import { EXTRACTION_SYSTEM, REPLY_SYSTEM, extractionPrompt, replyPrompt } from './prompts';

export interface AnthropicClientConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

// Two narrow calls, no tools: the model reads and writes, and cannot act (D11). Structured outputs
// guarantee the shape; the zod schema checks it again. Any failure raises LlmFailure, which the caller
// turns into an escalation (D9).
export class AnthropicLlmClient implements LlmClient {
  readonly mode = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(private readonly config: AnthropicClientConfig) {
    // One retry for transient errors (429, 5xx, connection), then give up and escalate.
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: 1,
    });
  }

  extract(input: ReadInput): Promise<LlmResult<Extraction>> {
    return this.parse(EXTRACTION_SYSTEM, extractionPrompt(input), ExtractionSchema);
  }

  async writeReply(brief: ReplyBrief): Promise<LlmResult<ReplyDraft>> {
    const result = await this.parse(REPLY_SYSTEM, replyPrompt(brief), ReplyDraftSchema);
    return {
      data: { message: result.data.message, statedOutcome: result.data.stated_outcome },
      call: result.call,
    };
  }

  private async parse<Schema extends z.ZodType>(
    system: string,
    content: string,
    schema: Schema,
  ): Promise<LlmResult<z.infer<Schema>>> {
    const started = Date.now();
    const call = (usage: LlmCall['usage'] = null): LlmCall => ({
      mode: this.mode,
      model: this.config.model,
      latencyMs: Date.now() - started,
      usage,
    });

    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.config.model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content }],
        // Reading a message and writing two sentences are routine: low effort keeps latency down.
        output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
        // A declined request is re-run on a fallback model inside the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (error) {
      throw new LlmFailure(describeApiError(error), call());
    }

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    if (response.stop_reason === 'refusal') {
      throw new LlmFailure('The model declined the request', call(usage));
    }
    if (response.stop_reason === 'max_tokens') {
      throw new LlmFailure('The model ran out of output tokens', call(usage));
    }
    const parsed = schema.safeParse(response.parsed_output);
    if (!parsed.success) {
      throw new LlmFailure('The model returned output that failed validation', call(usage));
    }
    return { data: parsed.data, call: call(usage) };
  }
}

function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'The model timed out';
  if (error instanceof Anthropic.RateLimitError) return 'The model was rate limited';
  if (error instanceof Anthropic.AuthenticationError) return 'The model API key was rejected';
  if (error instanceof Anthropic.APIError) return `Model API error ${error.status ?? ''}`.trim();
  return 'The model call failed';
}
