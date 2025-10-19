import {
  AiService,
  OpenAiProvider,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
} from "@localspotlight/core";

let cachedService: AiService | null = null;

export const getAiService = (): AiService => {
  if (cachedService) {
    return cachedService;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Set it in your environment before generating content.");
  }

  const provider = new OpenAiProvider({
    apiKey,
    model: DEFAULT_MODEL,
    userAgent: "LocalSpotlight/ai-service",
  });

  cachedService = new AiService({
    provider,
    logger: {
      info: (message, meta) => console.log(`[AI] ${message}`, meta ?? {}),
      warn: (message, meta) => console.warn(`[AI] ${message}`, meta ?? {}),
      error: (message, meta) => console.error(`[AI] ${message}`, meta ?? {}),
    },
  });

  return cachedService;
};

export const DEFAULT_FALLBACK_MODEL = FALLBACK_MODEL;
