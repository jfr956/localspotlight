import type {
  PostPromptInput,
  PostPromptOutput,
  AiModel,
} from "@localspotlight/core";
import type { Database } from "@/types/database";

type GbpLocation = Database["public"]["Tables"]["gbp_locations"]["Row"];
type SafetyRule = Database["public"]["Tables"]["safety_rules"]["Row"];
type AutomationPolicy = Database["public"]["Tables"]["automation_policies"]["Row"];

export interface PostPromptContext {
  orgName: string;
  location: GbpLocation;
  safety?: SafetyRule | null;
  recentReviews?: Array<{ rating?: number | null; text?: string | null }>;
  automation?: AutomationPolicy | null;
}

export interface PostCandidateSchemaOptions {
  output: PostPromptOutput;
  model: AiModel;
  automationMode?: AutomationPolicy["mode"] | null;
  userId?: string;
  trigger: "manual" | "automation";
}

export const toArrayOfStrings = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
};

export const sanitizeText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const deriveDisclaimers = (
  meta: Record<string, unknown>,
  automation?: AutomationPolicy | null,
): string[] => {
  const disclaimers = toArrayOfStrings(meta.disclaimers ?? meta.requiredDisclaimer);
  if (automation?.require_disclaimers && disclaimers.length === 0) {
    return ["All offers subject to availability. Contact the business for the latest details."];
  }
  return disclaimers;
};

export const buildPostPromptInput = (context: PostPromptContext): PostPromptInput => {
  const { orgName, location, safety, recentReviews = [], automation } = context;

  const meta = (location.meta as Record<string, unknown> | null) ?? {};

  return {
    org: {
      name: orgName,
      brandVoice: meta.brandVoice && typeof meta.brandVoice === "object"
        ? {
            tone: sanitizeText((meta.brandVoice as { tone?: string }).tone) ?? undefined,
            styleNotes: toArrayOfStrings((meta.brandVoice as { styleNotes?: unknown }).styleNotes),
          }
        : undefined,
    },
    location: {
      name: location.title ?? "Managed location",
      address: sanitizeText(meta.address),
      categories: toArrayOfStrings(meta.categories),
      differentiators: toArrayOfStrings(meta.differentiators ?? meta.uniqueSellingPoints),
      seasonalNotes: toArrayOfStrings(meta.seasonalHighlights ?? meta.promotions),
    },
    brief: {
      headlineGoal: sanitizeText(meta.pitchLine) ?? "Highlight timely news for local customers.",
      bodyGoal:
        sanitizeText(meta.contentFocus) ??
        "Drive discovery with clear value, proof, and a call to action.",
      campaign: sanitizeText(meta.campaignTagline),
      focusKeywords: toArrayOfStrings(meta.focusKeywords),
    },
    guardrails: {
      bannedTerms: safety?.banned_terms ?? [],
      requiredPhrases: safety?.required_phrases ?? [],
      disclaimers: deriveDisclaimers(meta, automation),
      blockedCategories: safety?.blocked_categories ?? [],
    },
    schedule: undefined,
    references: recentReviews
      .filter((review) => sanitizeText(review.text))
      .map((review, index) => ({
        type: "review" as const,
        title: `Customer review ${index + 1}`,
        body: sanitizeText(review.text) ?? "",
      })),
  };
};

export const buildPostCandidateSchema = (options: PostCandidateSchemaOptions) => {
  const { output, model, automationMode, userId, trigger } = options;
  return {
    type: "WHATS_NEW",
    title: output.headline,
    description: output.body,
    cta: output.callToAction ?? null,
    mediaBrief: output.mediaBrief ?? null,
    riskScore: output.riskScore,
    policyFindings: output.policyFindings,
    supportingPoints: output.supportingPoints,
    prompt: "post_generation_v1",
    model,
    generatedAt: new Date().toISOString(),
    metadata: {
      automationMode: automationMode ?? "off",
      userId,
      trigger,
    },
  };
};
