import { z } from "zod";
import type { PromptTemplate } from "./types";

const qnaInputSchema = z.object({
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
    categories: z.array(z.string()).default([]),
  }),
  question: z.object({
    text: z.string(),
    audience: z.string().optional(),
  }),
  knowledgeBase: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
        source: z.string().optional(),
      }),
    )
    .default([]),
  guardrails: z.object({
    bannedTerms: z.array(z.string()).default([]),
    requiredDisclaimers: z.array(z.string()).default([]),
  }),
});

const qnaOutputSchema = z.object({
  answer: z.string().min(40).max(600),
  followUpQuestions: z.array(z.string()).default([]),
  riskScore: z.number().min(0).max(1).default(0.15),
  policyFindings: z.array(z.string()).default([]),
  citations: z
    .array(
      z.object({
        title: z.string(),
        source: z.string().optional(),
      }),
    )
    .default([]),
});

export type QnaPromptInput = z.infer<typeof qnaInputSchema>;
export type QnaPromptOutput = z.infer<typeof qnaOutputSchema>;

export const qnaPrompt: PromptTemplate<typeof qnaInputSchema, typeof qnaOutputSchema> = {
  name: "qna_answer_v1",
  description: "Answer a GBP Q&A question with grounded, policy-compliant guidance.",
  inputSchema: qnaInputSchema,
  outputSchema: qnaOutputSchema,
  system: [
    "You answer customer-facing questions for Google Business Profile listings.",
    "Ground every answer in provided knowledge base content; do not invent policies or offers.",
    "If unsure, recommend contacting the business directly and raise the risk score.",
  ].join(" "),
  buildUserMessage: (input) => {
    const lines: string[] = [
      `Organization: ${input.org.name}`,
      `Location: ${input.location.name}`,
      `Question: ${input.question.text}`,
    ];
    if (input.question.audience) {
      lines.push(`Audience: ${input.question.audience}`);
    }
    if (input.org.brandVoice?.tone) {
      lines.push(`Brand tone: ${input.org.brandVoice.tone}`);
    }
    if (input.org.brandVoice?.styleNotes?.length) {
      lines.push(`Style notes: ${input.org.brandVoice.styleNotes.join("; ")}`);
    }
    if (input.location.categories.length > 0) {
      lines.push(`Categories: ${input.location.categories.join(", ")}`);
    }
    if (input.guardrails.bannedTerms.length > 0) {
      lines.push(`Banned terms: ${input.guardrails.bannedTerms.join(", ")}`);
    }
    if (input.guardrails.requiredDisclaimers.length > 0) {
      lines.push(`Required disclaimers: ${input.guardrails.requiredDisclaimers.join(" | ")}`);
    }
    if (input.knowledgeBase.length > 0) {
      lines.push("Knowledge base:");
      input.knowledgeBase.forEach((item: QnaPromptInput["knowledgeBase"][number], index: number) => {
        lines.push(`${index + 1}. ${item.title}${item.source ? ` (${item.source})` : ""}`);
        lines.push(item.content);
      });
    }
    lines.push("Return valid JSON only.");
    return lines.join("\n");
  },
};
