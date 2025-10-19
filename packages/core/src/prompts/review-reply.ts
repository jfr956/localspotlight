import { z } from "zod";
import type { PromptTemplate } from "./types";

const reviewInputSchema = z.object({
  org: z.object({
    name: z.string(),
    brandVoice: z
      .object({
        tone: z.string().optional(),
        styleNotes: z.array(z.string()).default([]),
      })
      .optional(),
  }),
  location: z.object({
    name: z.string(),
  }),
  review: z.object({
    author: z.string().optional(),
    rating: z.number().min(1).max(5),
    text: z.string(),
    postedAt: z.string().optional(),
  }),
  previousResponse: z.string().optional(),
  guardrails: z.object({
    bannedTerms: z.array(z.string()).default([]),
    requiredPhrases: z.array(z.string()).default([]),
  }),
});

const reviewOutputSchema = z.object({
  reply: z.string().min(20).max(600),
  tone: z.string().default("gracious"),
  escalation: z
    .object({
      required: z.boolean().default(false),
      reason: z.string().optional(),
    })
    .optional(),
  riskScore: z.number().min(0).max(1).default(0.1),
  policyFindings: z.array(z.string()).default([]),
  keyPhrases: z.array(z.string()).default([]),
});

export type ReviewReplyPromptInput = z.infer<typeof reviewInputSchema>;
export type ReviewReplyPromptOutput = z.infer<typeof reviewOutputSchema>;

export const reviewReplyPrompt: PromptTemplate<
  typeof reviewInputSchema,
  typeof reviewOutputSchema
> = {
  name: "review_reply_v1",
  description: "Draft a compliant review response honoring required phrases and tone.",
  inputSchema: reviewInputSchema,
  outputSchema: reviewOutputSchema,
  system: [
    "You craft empathetic, policy-compliant replies to Google reviews.",
    "Always acknowledge the customer, reference specifics, and offer next steps for low ratings.",
    "Avoid promising outcomes you cannot guarantee. Respect banned terms.",
  ].join(" "),
  buildUserMessage: (input) => {
    const lines: string[] = [
      `Organization: ${input.org.name}`,
      `Location: ${input.location.name}`,
      `Rating: ${input.review.rating}`,
      `Review text: ${input.review.text}`,
    ];
    if (input.review.author) {
      lines.push(`Author: ${input.review.author}`);
    }
    if (input.review.postedAt) {
      lines.push(`Posted at: ${input.review.postedAt}`);
    }
    if (input.previousResponse) {
      lines.push(`Previous response: ${input.previousResponse}`);
    }
    if (input.org.brandVoice?.tone) {
      lines.push(`Brand tone: ${input.org.brandVoice.tone}`);
    }
    if (input.org.brandVoice?.styleNotes?.length) {
      lines.push(`Style notes: ${input.org.brandVoice.styleNotes.join("; ")}`);
    }
    if (input.guardrails.bannedTerms.length > 0) {
      lines.push(`Banned terms: ${input.guardrails.bannedTerms.join(", ")}`);
    }
    if (input.guardrails.requiredPhrases.length > 0) {
      lines.push(`Required phrases: ${input.guardrails.requiredPhrases.join(", ")}`);
    }
    lines.push("Return valid JSON only.");
    return lines.join("\n");
  },
};
