import type { z } from "zod";

export interface PromptTemplate<
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny
> {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  system: string;
  buildUserMessage: (input: z.infer<TInputSchema>) => string;
}

export type AnyPromptTemplate = PromptTemplate<z.ZodTypeAny, z.ZodTypeAny>;

export interface PromptRegistry {
  posts: AnyPromptTemplate;
  reviewReply: AnyPromptTemplate;
  qna: AnyPromptTemplate;
}
