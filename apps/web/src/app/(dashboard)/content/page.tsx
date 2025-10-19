import Link from "next/link";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import type { Tables } from "@/types/database";
import {
  approvePostCandidateAction,
  rejectPostCandidateAction,
  regeneratePostCandidateAction,
} from "./actions";

export const metadata = {
  title: "Content • LocalSpotlight",
};

type Schedule = Tables<"schedules">;
type PostCandidate = Tables<"post_candidates">;

interface ContentPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_ALERTS: Record<
  string,
  { tone: "success" | "error" | "warning"; title: string; description: string }
> = {
  post_approved: {
    tone: "success",
    title: "Post approved",
    description: "We scheduled the post. It will publish at the planned time unless you update it.",
  },
  post_rejected: {
    tone: "warning",
    title: "Post rejected",
    description: "The draft was archived. Generate a fresh version whenever you are ready.",
  },
  regenerate_success: {
    tone: "success",
    title: "Post regenerated",
    description: "We saved the new draft. Review and approve when you are satisfied.",
  },
  regenerate_blocked: {
    tone: "warning",
    title: "Regeneration blocked",
    description: "Policy checks flagged the output. Adjust inputs and try again.",
  },
  regenerate_failed: {
    tone: "error",
    title: "Regeneration failed",
    description: "We could not refresh the draft. Please retry in a few minutes.",
  },
  approval_failed: {
    tone: "error",
    title: "Approval failed",
    description: "We hit an issue while approving this post. Try again shortly.",
  },
  schedule_failed: {
    tone: "error",
    title: "Scheduling failed",
    description: "Creating the publish schedule errored. Update and retry once resolved.",
  },
  reject_failed: {
    tone: "error",
    title: "Rejection failed",
    description: "We could not update the draft status. Refresh and try again.",
  },
  insufficient_role: {
    tone: "error",
    title: "You need editor access",
    description: "Only editors or admins can manage post approvals. Ask an owner to update your role.",
  },
  candidate_missing: {
    tone: "error",
    title: "Draft not found",
    description: "The post candidate no longer exists. It might have been processed already.",
  },
  location_not_managed: {
    tone: "warning",
    title: "Location unmanaged",
    description: "Enable management for this location before approving posts.",
  },
  already_approved: {
    tone: "warning",
    title: "Post already approved",
    description: "Another teammate approved this draft. Review it in the schedule.",
  },
  already_rejected: {
    tone: "warning",
    title: "Post already rejected",
    description: "This draft was archived earlier. Generate a new version if needed.",
  },
};

export default async function ContentPage({ searchParams }: ContentPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const status =
    typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : undefined;
  const alert = status ? STATUS_ALERTS[status] : undefined;

  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };

  // Fetch scheduled posts
  const { data: schedulesData } = await db
    .from("schedules")
    .select(`
      *,
      gbp_locations!inner(title, is_managed)
    `)
    .order("publish_at", { ascending: false })
    .limit(50);

  const schedules = (schedulesData as Array<Schedule & { gbp_locations: { title: string | null; is_managed: boolean | null } }>) ?? [];

  // Filter for managed locations only
  const managedSchedules = schedules.filter(s => s.gbp_locations?.is_managed);

  // Fetch post candidates (pending approval)
  const { data: candidatesData } = await db
    .from("post_candidates")
    .select(`
      *,
      gbp_locations!inner(title, is_managed)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  const candidates = (candidatesData as Array<PostCandidate & { gbp_locations: { title: string | null; is_managed: boolean | null } }>) ?? [];
  const managedCandidates = candidates.filter(c => c.gbp_locations?.is_managed);

  // Calculate stats
  const pendingCount = managedSchedules.filter(s => s.status === "pending").length;
  const publishedCount = managedSchedules.filter(s => s.status === "published").length;
  const failedCount = managedSchedules.filter(s => s.status === "failed").length;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Content</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage posts, schedules, and AI-generated content
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Post
        </button>
      </header>

      {alert && (
        <div
          className={`rounded-xl border p-4 ${
            alert.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : alert.tone === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
          }`}
        >
          <p className="text-sm font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm opacity-80">{alert.description}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Pending Approval</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{managedCandidates.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Pending Posts</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{pendingCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Published</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{publishedCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Failed</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{failedCount}</p>
        </div>
      </div>

      {/* Pending Approval Section */}
      {managedCandidates.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Pending Approval</h2>
            <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
              {managedCandidates.length} awaiting review
            </span>
          </div>
          <ul className="space-y-4">
                {managedCandidates.slice(0, 5).map((candidate) => {
                  const schema = candidate.schema as { headline?: string; body?: string; type?: string } | null;
                  return (
                    <li key={candidate.id} className="rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-400">
                              {schema?.type ?? "Post"}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                              candidate.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-400"
                                : candidate.status === "approved"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : candidate.status === "rejected"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-slate-500/10 text-slate-400"
                            }`}>
                              {candidate.status ?? "pending"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {candidate.gbp_locations?.title ?? "Unknown location"}
                            </span>
                          </div>
                          {schema?.headline && (
                            <h3 className="mt-2 font-medium text-white">{schema.headline}</h3>
                          )}
                          {schema?.body && (
                            <p className="mt-1 text-sm text-slate-400 line-clamp-2">{schema.body}</p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <form action={approvePostCandidateAction}>
                              <input type="hidden" name="candidateId" value={candidate.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve
                              </button>
                            </form>
                            <form action={regeneratePostCandidateAction}>
                              <input type="hidden" name="candidateId" value={candidate.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 15h16M10 19l4-4-4-4" />
                                </svg>
                                Regenerate
                              </button>
                            </form>
                            <form action={rejectPostCandidateAction}>
                              <input type="hidden" name="candidateId" value={candidate.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reject
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
            })}
          </ul>
        </section>
      )}

      {/* Scheduled Posts Section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Scheduled Posts</h2>
          <Link
            href="/content?view=calendar"
            className="text-sm text-emerald-400 hover:text-emerald-300 transition"
          >
            View calendar
          </Link>
        </div>
        {managedSchedules.length === 0 ? (
          <div className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white">No scheduled posts</h3>
            <p className="mt-2 text-sm text-slate-400">
              Create and schedule posts to keep your Google Business Profile active.
            </p>
            <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create your first post
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {managedSchedules.slice(0, 10).map((schedule) => (
              <li key={schedule.id} className="rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-white capitalize">
                        {schedule.target_type.replace("_", " ")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                          schedule.status === "pending"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : schedule.status === "published"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : schedule.status === "failed"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {schedule.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {schedule.gbp_locations?.title ?? "Unknown location"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {schedule.status === "pending" ? "Scheduled for" : "Published"}{" "}
                      {new Date(schedule.publish_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
