"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { startPostGenerationAction } from "../actions";

interface AiGenerationPanelProps {
  locationId: string;
  generationId?: string;
}

type EventLogEntry = {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  created_at: string;
  meta?: Record<string, unknown>;
};

type GenerationStatus = "pending" | "running" | "completed" | "moderated" | "failed";

interface GenerationSnapshot {
  id: string;
  status: GenerationStatus;
  model: string | null;
  risk_score: number | null;
  output?: Record<string, unknown> | null;
  created_at?: string;
}

export function AiGenerationPanel({ locationId, generationId }: AiGenerationPanelProps) {
  const [currentGenerationId, setCurrentGenerationId] = useState<string | undefined>(generationId);
  const [status, setStatus] = useState<GenerationSnapshot | null>(null);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pollingInterval = 2000;

  const fetchStatus = useCallback(async () => {
    if (!currentGenerationId) {
      return;
    }

    try {
      const response = await fetch(`/api/generation-status?gen=${currentGenerationId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load status (${response.status})`);
      }

      const payload = (await response.json()) as {
        snapshot: GenerationSnapshot;
        events: EventLogEntry[];
      };

      setStatus(payload.snapshot);
      setEvents(payload.events);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [currentGenerationId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      timer = setTimeout(async () => {
        await fetchStatus();
        schedule();
      }, pollingInterval);
    };

    if (currentGenerationId) {
      fetchStatus().then(() => {
        schedule();
      });
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [currentGenerationId, fetchStatus, pollingInterval]);

  useEffect(() => {
    setCurrentGenerationId(generationId);
  }, [generationId]);

  const statusChip = useMemo(() => {
    if (!status) {
      return { label: "Awaiting generation", tone: "bg-slate-800 text-slate-300" };
    }

    switch (status.status) {
      case "pending":
        return { label: "Pending", tone: "bg-yellow-500/10 text-yellow-300" };
      case "running":
        return { label: "Running", tone: "bg-blue-500/10 text-blue-300" };
      case "completed":
        return { label: "Completed", tone: "bg-emerald-500/10 text-emerald-300" };
      case "moderated":
        return { label: "Moderated", tone: "bg-orange-500/10 text-orange-200" };
      case "failed":
        return { label: "Failed", tone: "bg-red-500/10 text-red-300" };
      default:
        return { label: status.status, tone: "bg-slate-800 text-slate-300" };
    }
  }, [status]);

  const riskScore = status?.risk_score ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 border-b border-slate-800/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Generate post with AI</h2>
            <p className="text-sm text-slate-400">
              We gather your location data, reviews, and brand guardrails, then draft a post you can
              review before approving.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusChip.tone}`}>
            {statusChip.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Generation ID: {currentGenerationId ?? "not started"}</span>
          {riskScore !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-emerald-300">
              Risk score
              <span className="font-semibold">{riskScore.toFixed(2)}</span>
            </span>
          )}
        </div>
      </header>

      <section className="space-y-4 px-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="text-sm font-medium text-white">Kick off a new generation</h3>
          <p className="mt-1 text-xs text-slate-400">
            We will re-use the latest grounding context. Regenerating creates a new AI draft and logs
            the results below.
          </p>
          <form
            className="mt-4 flex flex-wrap items-center gap-3"
            action={async (formData) => {
              setStatus(null);
              setEvents([]);
              await startPostGenerationAction(formData);
            }}
            data-testid="ai-generation-start-form"
          >
            <input type="hidden" name="locationId" value={locationId} />
            <SubmitButton />
            <Link
              href={`/locations/${locationId}/posts/new?mode=grounding`}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Review grounding →
            </Link>
          </form>
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        </div>
      </section>

      <section className="px-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60">
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Generation timeline</h3>
              <p className="text-xs text-slate-400">
                We log every moderation result, retry, and policy check for auditability.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {events.length} {events.length === 1 ? "event" : "events"}
            </span>
          </header>
          <ul className="max-h-72 space-y-2 overflow-y-auto p-4 text-xs text-slate-300">
            {events.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-800/80 bg-slate-900/40 p-4 text-center text-slate-500">
                No events yet. Start a generation to see detailed logs.
              </li>
            ) : (
              events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${(() => {
                        switch (event.level) {
                          case "warn":
                            return "bg-orange-500/10 text-orange-300";
                          case "error":
                            return "bg-red-500/10 text-red-300";
                          default:
                            return "bg-slate-800 text-slate-200";
                        }
                      })()}`}
                    >
                      {event.level}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-300">{event.message}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {status?.output && (
        <section className="space-y-3 px-6">
          <header>
            <h3 className="text-sm font-semibold text-white">Generated post schema</h3>
            <p className="text-xs text-slate-400">
              This JSON is what we store in `post_candidates.schema` after validation.
            </p>
          </header>
          <pre className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-200">
            {JSON.stringify(status.output, null, 2)}
          </pre>
          <div className="flex gap-2">
            <Link
              href={`/content?focus=${currentGenerationId ?? ""}`}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Review in approval queue
            </Link>
            <Link
              href={`/locations/${locationId}?tab=posts`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Back to location posts
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 15h16M10 19l4-4-4-4" />
        </svg>
      )}
      {pending ? "Starting…" : "Generate now"}
    </button>
  );
}


