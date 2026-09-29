import 'dotenv/config';
import { z } from 'zod';

// Validated once at boot, so a misconfigured deploy fails to start instead of failing its first request.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('Refund Desk API'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  DOCS_USERNAME: z.string().optional(),
  DOCS_PASSWORD: z.string().optional(),
  // Empty means no key: the deterministic mock model runs instead, and every demo scenario still works.
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((key) => key || undefined),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-5-5'),
  MOCK_LLM: z
    .enum(['true', 'false'])
    .default('false')
    .transform((flag) => flag === 'true'),
  // Per model call; a timeout escalates the request to a person rather than retrying without end (D9).
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
