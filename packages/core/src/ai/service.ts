import { z } from "zod";
import type { PromptTemplate } from "../prompts";
import { DEFAULT_MAX_RETRIES, DEFAULT_MODEL, DEFAULT_RISK_THRESHOLD, FALLBACK_MODEL, MODEL_PRICING } from "./constants";
import type {
  AiGenerationResult,
  AiModel,
  AiProvider,
  GenerateOptions,
  ModerationResult,
} from "./types";

const sleep = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const MAX_BACKOFF_MS = 2000;

export interface AiServiceOptions {
  provider: AiProvider;
  logger?: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
}

export class AiService {
  private readonly provider: AiProvider;

  private readonly logger: Required<AiServiceOptions>["logger"];

  constructor(options: AiServiceOptions) {
    this.provider = options.provider;
    this.logger =
      options.logger ??
      ({
        info: () => {},
        warn: () => {},
        error: () => {},
      } as const);
  }

  async generate<TInputSchema extends z.ZodTypeAny, TOutputSchema extends z.ZodTypeAny>(
    prompt: PromptTemplate<TInputSchema, TOutputSchema>,
    rawInput: unknown,
    options: GenerateOptions = {},
  ): Promise<AiGenerationResult<z.infer<TOutputSchema>>> {
    const input = prompt.inputSchema.parse(rawInput);
    const model = options.model ?? DEFAULT_MODEL;
    const fallbackModel = options.fallbackModel ?? FALLBACK_MODEL;
    const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
    const desiredRiskThreshold = options.riskThreshold ?? DEFAULT_RISK_THRESHOLD;

    let lastError: unknown = null;
    let attempt = 0;
    let currentModel: AiModel = model;

    while (attempt <= maxRetries) {
      try {
        const structured = await this.provider.generateStructured(prompt, input, {
          model: currentModel,
          metadata: options.metadata,
        });

        let moderation: ModerationResult | undefined;
        if (options.moderation !== false && this.provider.moderate) {
          moderation = await this.provider.moderate(structured.rawText);
          if (moderation.flagged) {
            this.logger.warn("AI moderation flagged content", {
              prompt: prompt.name,
              categories: moderation.categories,
            });
          }
        }

        const policyFindings = Array.isArray(structured.parsed.policyFindings)
          ? structured.parsed.policyFindings
          : [];
        const riskScore =
          typeof (structured.parsed as { riskScore?: number }).riskScore === "number"
            ? (structured.parsed as { riskScore: number }).riskScore
            : null;

        const usage = structured.usage
          ? this.withCost(currentModel, structured.usage)
          : null;

        const blocked =
          (riskScore !== null && riskScore > desiredRiskThreshold) ||
          moderation?.flagged === true;

        return {
          output: structured.parsed,
          rawText: structured.rawText,
          promptName: prompt.name,
          model: currentModel,
          usage,
          moderation,
          riskScore,
          blocked,
          policyFindings,
          retries: attempt,
          responseId: structured.responseId,
          meta: options.metadata,
        };
      } catch (error) {
        lastError = error;
        this.logger.warn("AI generation attempt failed", {
          prompt: prompt.name,
          attempt,
          model: currentModel,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt === maxRetries) {
          this.logger.error("AI generation exhausted retries", {
            prompt: prompt.name,
            model: currentModel,
          });
          throw error;
        }

        attempt += 1;

        if (currentModel !== fallbackModel) {
          currentModel = fallbackModel;
        }

        const backoffMs = Math.min(MAX_BACKOFF_MS, 250 * attempt);
        await sleep(backoffMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("AI generation failed");
  }

  private withCost(model: AiModel, usage: { inputTokens: number; outputTokens: number; totalTokens: number }) {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      return usage;
    }

    const inputCost = usage.inputTokens / pricing.inputTokensPerUsd;
    const outputCost = usage.outputTokens / pricing.outputTokensPerUsd;
    return {
      ...usage,
      costUsd: Number((inputCost + outputCost).toFixed(6)),
    };
  }
}
