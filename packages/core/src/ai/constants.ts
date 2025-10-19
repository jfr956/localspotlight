import type { AiModel, ModelPricing } from "./types";

export const DEFAULT_MODEL: AiModel = "gpt-4o-mini";
export const FALLBACK_MODEL: AiModel = "gpt-4o";

export const MODEL_PRICING: Record<AiModel, ModelPricing> = {
  "gpt-4o-mini": {
    inputTokensPerUsd: 1 / 0.00015 * 1000, // approximate tokens per $1
    outputTokensPerUsd: 1 / 0.0006 * 1000,
  },
  "gpt-4o": {
    inputTokensPerUsd: 1 / 0.0025 * 1000,
    outputTokensPerUsd: 1 / 0.01 * 1000,
  },
} as const;

export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_RISK_THRESHOLD = 0.35;
