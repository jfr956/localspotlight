import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { AiGenerationPanel } from "./sections/AiGenerationPanel";
import { PostComposeForm } from "./components/PostComposeForm";

export const metadata = {
  title: "Create Post • LocalSpotlight",
};

interface NewPostPageProps {
  params: Promise<{ locationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const statusMessages: Record<
  string,
  { tone: "error" | "warning"; title: string; description: string }
> = {
  missing_fields: {
    tone: "error",
    title: "Headline and body are required",
    description: "Add a headline and description so the post has enough context to publish.",
  },
  invalid_publish_at: {
    tone: "error",
    title: "Invalid publish schedule",
    description: "Use a valid publish date and time before saving your post.",
  },
  invalid_cta_url: {
    tone: "error",
    title: "Call-to-action link is invalid",
    description: "Double-check the CTA URL. It must be a full URL that starts with http:// or https://.",
  },
  invalid_image_url: {
    tone: "error",
    title: "Image URL is invalid",
    description: "Provide a valid image URL or leave the field blank to continue without media.",
  },
  image_too_large: {
    tone: "error",
    title: "Image is too large",
    description:
      "We compress images to stay under 900 KB for publishing. Please upload a smaller image or compress it before trying again.",
  },
  create_failed: {
    tone: "error",
    title: "We could not create the post",
    description: "Please try again in a moment. If the issue persists, contact support.",
  },
};

export default async function NewLocationPostPage({ params, searchParams }: NewPostPageProps) {
  const { locationId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const status =
    typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : undefined;
  const mode = typeof resolvedSearchParams.mode === "string" ? resolvedSearchParams.mode : "compose";
  const generationId =
    typeof resolvedSearchParams.gen === "string" ? resolvedSearchParams.gen : undefined;

  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };

  const { data: location } = await db
    .from("gbp_locations")
    .select("id, org_id, title, is_managed")
    .eq("id", locationId)
    .maybeSingle();

  if (!location) {
    notFound();
  }

  if (!location.is_managed) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <h1 className="text-lg font-semibold text-yellow-300">Location not managed</h1>
          <p className="mt-2 text-sm text-yellow-200/80">
            Add this location to your managed roster before creating posts. You can do this on the
            Google integrations page.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href={`/locations/${locationId}`}
              className="inline-flex items-center justify-center rounded-lg border border-yellow-400 px-4 py-2 text-sm font-medium text-yellow-200 transition hover:border-yellow-300/80 hover:text-yellow-100"
            >
              Back to location
            </Link>
            <Link
              href="/integrations/google"
              className="inline-flex items-center justify-center rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-yellow-950 transition hover:bg-yellow-300"
            >
              Manage locations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const defaultPublish = new Date(Date.now() + 60 * 60 * 1000);
  const defaultDate = defaultPublish.toISOString().slice(0, 10);
  const defaultTime = defaultPublish.toISOString().slice(11, 16);

  const alert = status ? statusMessages[status] : undefined;

  const tabs: Array<{
    id: "compose" | "ai" | "grounding" | "policy";
    label: string;
    description: string;
  }> = [
    {
      id: "compose",
      label: "Compose",
      description: "Write a post manually and publish or schedule it yourself.",
    },
    {
      id: "ai",
      label: "Generate with AI",
      description: "Leverage AI to draft a post using your GBP context.",
    },
    {
      id: "grounding",
      label: "Grounding",
      description: "Review the signals AI will reference before generating.",
    },
    {
      id: "policy",
      label: "Policy Check",
      description: "View moderation, guardrails, and risk settings for this location.",
    },
  ];

  const selectedTab = tabs.some((tab) => tab.id === mode) ? mode : "compose";

  const tabLink = (tabId: string) => {
    const search = new URLSearchParams();
    if (tabId !== "compose") {
      search.set("mode", tabId);
    }
    if (tabId === "ai" && generationId) {
      search.set("gen", generationId);
    }
    return `/locations/${locationId}/posts/new${search.toString() ? `?${search.toString()}` : ""}`;
  };

  const composeForm = (
    <PostComposeForm
      locationId={location.id}
      defaultDate={defaultDate}
      defaultTime={defaultTime}
    />
  );

  const tabContent = (() => {
    switch (selectedTab) {
      case "ai":
        return (
          <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/70">
            <AiGenerationPanel
              locationId={location.id}
              generationId={generationId}
            />
          </div>
        );
      case "grounding":
        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
            <p className="text-base font-medium text-white">Grounding data</p>
            <p className="mt-2">
              We will surface profile facts, recent reviews, and brand guardrails here so you can
              confirm what the AI sees. This section is coming soon.
            </p>
          </div>
        );
      case "policy":
        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
            <p className="text-base font-medium text-white">Policy guardrails</p>
            <p className="mt-2">
              Moderation logs, risk thresholds, and required disclaimers will appear here to keep
              your team aligned on compliance.
            </p>
          </div>
        );
      case "compose":
      default:
        return (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            {composeForm}
          </div>
        );
    }
  })();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Create Post</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            {location.title ?? "Untitled location"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Draft a new Google Business Profile post and schedule it for publish.
          </p>
        </div>
        <Link
          href={`/locations/${locationId}?tab=posts`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
        >
          Cancel
        </Link>
      </div>

      {alert && (
        <div
          className={`rounded-xl border p-4 ${
            alert.tone === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-200"
              : "border-yellow-500/20 bg-yellow-500/10 text-yellow-200"
          }`}
        >
          <h2 className="text-sm font-semibold">{alert.title}</h2>
          <p className="mt-1 text-sm opacity-80">{alert.description}</p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="border-b border-slate-800">
          <nav className="flex flex-wrap gap-2 p-4">
            {tabs.map((tab) => {
              const isActive = tab.id === selectedTab;
              return (
                <Link
                  key={tab.id}
                  href={tabLink(tab.id)}
                  className={`group flex min-w-[200px] flex-1 flex-col rounded-xl border px-4 py-3 transition ${
                    isActive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-transparent bg-slate-950/30 text-slate-300 hover:border-slate-700 hover:bg-slate-900/70"
                  }`}
                >
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <span className="mt-1 text-xs text-slate-400 group-hover:text-slate-300">
                    {tab.description}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-6">{tabContent}</div>
      </div>
    </div>
  );
}
