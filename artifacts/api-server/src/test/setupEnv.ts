// Vitest setup: dummy env so modules with import-time env assertions
// (e.g. the OpenAI integration client) can be imported in unit tests.
// No test actually talks to these endpoints — network calls are mocked.
process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??= "http://localhost:9/test-openai";
process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??= "test-key";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:9/test";
