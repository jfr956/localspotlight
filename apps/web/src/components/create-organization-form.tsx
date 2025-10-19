"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createOrganization } from "@/app/(dashboard)/settings/org/actions";

const initialState = { error: undefined } as const;

type FormState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600/40 disabled:text-emerald-200"
    >
      {pending ? "Creating…" : "Create organization"}
    </button>
  );
}

export function CreateOrganizationForm() {
  const [state, formAction] = useFormState<FormState, FormData>(createOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="org-name">
          Organization name
        </label>
        <input
          id="org-name"
          name="name"
          type="text"
          minLength={2}
          required
          placeholder="Acme Dental Clinic"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>
      {state?.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
