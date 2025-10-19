import { z } from "zod";
import type { PromptTemplate } from "./types";

const scheduleWindowSchema = z.object({
  targetDate: z.string().optional(),
  targetTime: z.string().optional(),
  cadenceHint: z.string().optional(),
});

const guardrailSchema = z.object({
  bannedTerms: z.array(z.string()).default([]),
  requiredPhrases: z.array(z.string()).default([]),
  disclaimers: z.array(z.string()).default([]),
  blockedCategories: z.array(z.string()).default([]),
});

const postInputSchema = z.object({
  org: z.object({
    name: z.string(),
    brandVoice: z
      .object({
        tone: z.string().default("confident and approachable"),
        styleNotes: z.array(z.string()).default([]),
      })
      .optional(),
  }),
  location: z.object({
    name: z.string(),
    address: z.string().optional(),
    categories: z.array(z.string()).default([]),
    differentiators: z.array(z.string()).default([]),
    seasonalNotes: z.array(z.string()).default([]),
  }),
  brief: z.object({
    headlineGoal: z.string().optional(),
    bodyGoal: z.string().optional(),
    campaign: z.string().optional(),
    focusKeywords: z.array(z.string()).default([]),
  }),
  guardrails: guardrailSchema.optional(),
  schedule: scheduleWindowSchema.optional(),
  references: z
    .array(
      z.object({
        type: z.enum(["review", "service", "event", "offer", "faq", "custom"]).default("custom"),
        title: z.string().optional(),
        body: z.string(),
      }),
    )
    .default([]),
});

const postOutputSchema = z.object({
  headline: z.string().min(10).max(80),
  body: z.string().min(40).max(750),
  callToAction: z
    .object({
      label: z.string(),
      url: z.string().url().optional(),
    })
    .optional(),
  mediaBrief: z
    .object({
      concept: z.string(),
      altText: z.string().optional(),
      aspectRatio: z.string().optional(),
      safeCategories: z.array(z.string()).default([]),
    })
    .optional(),
  riskScore: z.number().min(0).max(1).default(0.2),
  policyFindings: z.array(z.string()).default([]),
  supportingPoints: z.array(z.string()).default([]),
});

export type PostPromptInput = z.infer<typeof postInputSchema>;
export type PostPromptOutput = z.infer<typeof postOutputSchema>;

export const postPrompt: PromptTemplate<typeof postInputSchema, typeof postOutputSchema> = {
  name: "post_generation_v1",
  description: "Generate a GBP-compliant post headline, body, CTA, and media brief.",
  inputSchema: postInputSchema,
  outputSchema: postOutputSchema,
  system: [
    "You are LocalSpotlight, an assistant that creates Google Business Profile posts.",
    "Respect banned terms, required phrases, and regulatory guardrails.",
    "Never fabricate promotions, prices, or personal data.",
    "Keep tone on-brand, concise, and conversion oriented.",
    "If the request violates policy, raise risk_score above 0.6 and explain in policyFindings.",
  ].join(" "),
  buildUserMessage: (input) => {
    const lines: string[] = [
      `Organization: ${input.org.name}`,
      `Location: ${input.location.name}`,
    ];

    if (input.location.address) {
      lines.push(`Address: ${input.location.address}`);
    }
    if (input.location.categories.length > 0) {
      lines.push(`Categories: ${input.location.categories.join(", ")}`);
    }
    if (input.org.brandVoice) {
      lines.push(`Brand tone: ${input.org.brandVoice.tone}`);
      if (input.org.brandVoice.styleNotes.length > 0) {
        lines.push(`Style notes: ${input.org.brandVoice.styleNotes.join("; ")}`);
      }
    }
    if (input.brief.headlineGoal) {
      lines.push(`Headline goal: ${input.brief.headlineGoal}`);
    }
    if (input.brief.bodyGoal) {
      lines.push(`Body goal: ${input.brief.bodyGoal}`);
    }
    if (input.brief.campaign) {
      lines.push(`Campaign: ${input.brief.campaign}`);
    }
    if (input.brief.focusKeywords.length > 0) {
      lines.push(`Focus keywords: ${input.brief.focusKeywords.join(", ")}`);
    }
    if (input.guardrails) {
      if (input.guardrails.bannedTerms.length > 0) {
        lines.push(`Banned terms: ${input.guardrails.bannedTerms.join(", ")}`);
      }
      if (input.guardrails.requiredPhrases.length > 0) {
        lines.push(`Required phrases: ${input.guardrails.requiredPhrases.join(", ")}`);
      }
      if (input.guardrails.disclaimers.length > 0) {
        lines.push(`Disclaimers: ${input.guardrails.disclaimers.join(" | ")}`);
      }
    }
    if (input.references.length > 0) {
      lines.push("References:");
      input.references.forEach((ref: PostPromptInput["references"][number], index: number) => {
        const refLines = [`${index + 1}. [${ref.type}] ${ref.title ?? "Untitled"}`, ref.body];
        lines.push(refLines.join(" - "));
      });
    }
    if (input.schedule) {
      lines.push(
        `Scheduling hint: ${[
          input.schedule.targetDate ? `target date ${input.schedule.targetDate}` : null,
          input.schedule.targetTime ? `target time ${input.schedule.targetTime}` : null,
          input.schedule.cadenceHint ?? null,
        ]
          .filter(Boolean)
          .join(", ")}`,
      );
    }

    lines.push("Return valid JSON only.");

    return lines.join("\n");
  },
};
