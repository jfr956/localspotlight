import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { PromptTemplate } from "../prompts";
import type { AiModel, AiProvider, AiUsage, ModerationResult } from "./types";

const usageSchema = z
  .object({
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
  })
  .nullish();

const moderationCategorySchema = z
  .record(z.union([z.boolean(), z.null()]))
  .catch({})
  .transform((record) =>
    Object.entries(record).reduce<Record<string, boolean>>((acc, [key, value]) => {
      acc[key] = Boolean(value);
      return acc;
    }, {}),
  );

const moderationScoreSchema = z
  .record(z.union([z.number(), z.null()]))
  .catch({})
  .transform((record) =>
    Object.entries(record).reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = typeof value === "number" ? value : 0;
      return acc;
    }, {}),
  );

export interface OpenAiProviderOptions {
  apiKey: string;
  model: AiModel;
  baseURL?: string;
  userAgent?: string;
}

export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;

  private readonly defaultModel: AiModel;

  constructor(options: OpenAiProviderOptions) {
    const { apiKey, baseURL, userAgent, model } = options;
    this.client = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: userAgent
        ? {
            "User-Agent": userAgent,
          }
        : undefined,
    });
    this.defaultModel = model;
  }

  async generateStructured<TInputSchema extends z.ZodTypeAny, TOutputSchema extends z.ZodTypeAny>(
    prompt: PromptTemplate<TInputSchema, TOutputSchema>,
    input: z.infer<TInputSchema>,
    options: { model: AiModel; userId?: string; metadata?: Record<string, unknown> },
  ): Promise<{
    rawText: string;
    parsed: z.infer<TOutputSchema>;
    usage: AiUsage | null;
    responseId?: string;
  }> {
    const model = options.model ?? this.defaultModel;

    const schemaJson = JSON.stringify(
      zodToJsonSchema(prompt.outputSchema, prompt.name),
      null,
      2,
    );

    const compositeInput = [
      prompt.system,
      "### Task Context",
      prompt.buildUserMessage(input),
      "### Output Contract",
      `Reply with a single JSON object that matches this schema: ${schemaJson}`,
      "Do not include markdown fences or commentary. Respond with compact JSON.",
    ].join("\n\n");

    const response = await this.client.responses.create({
      model,
      input: compositeInput,
      metadata: options.metadata
        ? (Object.fromEntries(
            Object.entries(options.metadata).map(([key, value]) => [key, JSON.stringify(value)]),
          ) as Record<string, string>)
        : undefined,
      user: options.userId,
    });

    const outputText = (response as { output_text?: string }).output_text;

    if (!outputText) {
      throw new Error(`OpenAI returned no structured output for prompt ${prompt.name}`);
    }

    const parsedJson = prompt.outputSchema.parse(JSON.parse(outputText));
    const usagePayload = usageSchema.parse(response.usage);

    const usage: AiUsage | null = usagePayload
      ? {
          inputTokens: usagePayload.input_tokens ?? 0,
          outputTokens: usagePayload.output_tokens ?? 0,
          totalTokens: usagePayload.total_tokens ?? 0,
        }
      : null;

    return {
      rawText: outputText,
      parsed: parsedJson,
      usage,
      responseId: response.id,
    };
  }

  async moderate(input: string): Promise<ModerationResult> {
    const result = await this.client.moderations.create({
      model: "omni-moderation-latest",
      input,
    });

    const outcome = result.results?.[0];
    if (!outcome) {
      return {
        flagged: false,
        categories: {},
        scores: {},
      };
    }

    return {
      flagged: Boolean(outcome.flagged),
      categories: moderationCategorySchema.parse(outcome.categories ?? {}),
      scores: moderationScoreSchema.parse(outcome.category_scores ?? {}),
    };
  }
}
