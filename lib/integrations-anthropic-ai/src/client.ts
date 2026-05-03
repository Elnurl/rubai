import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy Anthropic client.
 *
 * The original template threw at module load when env vars were
 * missing, but in this project Anthropic is the *failover* provider —
 * the API server must keep running on OpenAI alone if Anthropic is not
 * configured. Importing this module is therefore side-effect free; the
 * client is only constructed (and the env check enforced) on first
 * call to `getAnthropic()`.
 *
 * Use `isAnthropicConfigured()` from a hot path to skip failover when
 * Anthropic isn't set up rather than relying on the throw.
 */
let client: Anthropic | null = null;

export function isAnthropicConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL &&
      process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  );
}

export function getAnthropic(): Anthropic {
  if (client) return client;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "Anthropic AI integration is not configured. Set AI_INTEGRATIONS_ANTHROPIC_BASE_URL and AI_INTEGRATIONS_ANTHROPIC_API_KEY (run setupReplitAIIntegrations).",
    );
  }
  client = new Anthropic({ apiKey, baseURL });
  return client;
}

export type AnthropicClient = Anthropic;
