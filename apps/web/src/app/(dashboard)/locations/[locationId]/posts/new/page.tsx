import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { startPostGenerationAction, createManualPostAction } from "./actions";
import { AiGenerationPanel } from "./sections/AiGenerationPanel";

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
    <form action={createManualPostAction} className="space-y-8">
      <input type="hidden" name="locationId" value={location.id} />
      <section className="space-y-4">
        <div>
          <label htmlFor="postType" className="block text-sm font-medium text-slate-300">
            Post type
          </label>
          <p className="text-xs text-slate-500">
            Choose the Google post format that best matches your announcement.
          </p>
          <select
            id="postType"
            name="postType"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            defaultValue="WHATS_NEW"
          >
            <option value="WHATS_NEW">What&apos;s New</option>
            <option value="EVENT">Event</option>
            <option value="OFFER">Offer</option>
          </select>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-300">
            Headline
          </label>
          <p className="text-xs text-slate-500">Up to 58 characters work best in Google.</p>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={80}
            placeholder="Headline shown to customers"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-300">
            Body copy
          </label>
          <p className="text-xs text-slate-500">Tell customers what is new in 750 characters or less.</p>
          <textarea
            id="description"
            name="description"
            required
            rows={6}
            placeholder="Share important details, offers, or event highlights..."
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label htmlFor="publishDate" className="block text-sm font-medium text-slate-300">
              Publish date
            </label>
            <input
              id="publishDate"
              name="publishDate"
              type="date"
              defaultValue={defaultDate}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label htmlFor="publishTime" className="block text-sm font-medium text-slate-300">
              Publish time
            </label>
            <input
              id="publishTime"
              name="publishTime"
              type="time"
              defaultValue={defaultTime}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="ctaAction" className="block text-sm font-medium text-slate-300">
              Call to action
            </label>
            <select
              id="ctaAction"
              name="ctaAction"
              defaultValue=""
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">No button</option>
              <option value="BOOK">Book</option>
              <option value="CALL">Call</option>
              <option value="LEARN_MORE">Learn more</option>
              <option value="ORDER">Order</option>
              <option value="SHOP">Shop</option>
              <option value="SIGN_UP">Sign up</option>
              <option value="VISIT_WEBSITE">Visit website</option>
            </select>
          </div>
          <div>
            <label htmlFor="ctaUrl" className="block text-sm font-medium text-slate-300">
              Call-to-action URL
            </label>
            <input
              id="ctaUrl"
              name="ctaUrl"
              type="url"
              placeholder="https://example.com/offer"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-slate-300">
              Feature image URL
            </label>
            <input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <p className="mt-1 text-xs text-slate-500">
              Optional. Provide a link to an image already hosted online.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/locations/${locationId}?tab=posts`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Save and schedule
        </button>
      </div>
    </form>
  );

      case "ai":
        return (
          <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/70">
            <AiGenerationPanel
              locationId={location.id}
              orgId={location.org_id}
              generationId={generationId}
              startAction={startPostGenerationAction}
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
