import type { z } from "zod";
import type { PromptTemplate } from "../prompts";

export type AiModel = "gpt-4o-mini" | "gpt-4o";

export interface ModelPricing {
  inputTokensPerUsd: number;
  outputTokensPerUsd: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
}

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
}

export interface GenerateOptions {
  model?: AiModel;
  fallbackModel?: AiModel;
  maxRetries?: number;
  riskThreshold?: number;
  moderation?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AiGenerationResult<TOutput> {
  output: TOutput;
  rawText: string;
  promptName: string;
  model: AiModel;
  usage: AiUsage | null;
  moderation?: ModerationResult;
  riskScore: number | null;
  blocked: boolean;
  policyFindings: string[];
  retries: number;
  responseId?: string;
  meta?: Record<string, unknown>;
}

export interface AiProvider {
  generateStructured<TInputSchema extends z.ZodTypeAny, TOutputSchema extends z.ZodTypeAny>(
    prompt: PromptTemplate<TInputSchema, TOutputSchema>,
    input: z.infer<TInputSchema>,
    options: {
      model: AiModel;
      userId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{
    rawText: string;
    parsed: z.infer<TOutputSchema>;
    usage: AiUsage | null;
    responseId?: string;
  }>;
  moderate?(input: string): Promise<ModerationResult>;
}
