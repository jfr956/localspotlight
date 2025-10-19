"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Database } from "@/types/database";

type Mode = "magic-link" | "password";

type MagicLinkStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "sent" }
  | { state: "error"; message: string };

type PasswordStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string };

export function SignInForm() {
  const router = useRouter();
  const supabase = useSupabaseClient<Database>();
  const [mode, setMode] = useState<Mode>("magic-link");
  const [magicStatus, setMagicStatus] = useState<MagicLinkStatus>({ state: "idle" });
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus>({ state: "idle" });

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMagicStatus({ state: "idle" });
    setPasswordStatus({ state: "idle" });
  };

  const handleMagicLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get("email") as string)?.trim().toLowerCase();

    if (!email) {
      setMagicStatus({ state: "error", message: "Enter a valid email address." });
      return;
    }

    try {
      setMagicStatus({ state: "loading" });
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        throw error;
      }

      setMagicStatus({ state: "sent" });
      form.reset();
    } catch (error) {
      console.error(error);
      setMagicStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "We couldn't send the sign-in link. Try again.",
      });
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = formData.get("password") as string;

    if (!email) {
      setPasswordStatus({ state: "error", message: "Enter a valid email address." });
      return;
    }

    if (!password) {
      setPasswordStatus({ state: "error", message: "Enter your password." });
      return;
    }

    try {
      setPasswordStatus({ state: "loading" });
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      form.reset();
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      setPasswordStatus({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't sign you in with that password. Try again.",
      });
    } finally {
      setPasswordStatus((current) =>
        current.state === "loading" ? { state: "idle" } : current,
      );
    }
  };

  const isMagicLoading = magicStatus.state === "loading";
  const isMagicDisabled = isMagicLoading || magicStatus.state === "sent";
  const isPasswordLoading = passwordStatus.state === "loading";

  return (
    <div className="space-y-5">
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1 text-sm font-medium text-slate-300">
        <button
          type="button"
          onClick={() => switchMode("magic-link")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "magic-link"
              ? "bg-slate-800 text-emerald-300 shadow-inner shadow-slate-950"
              : "hover:bg-slate-800/50 hover:text-slate-100"
          }`}
        >
          Magic Link
        </button>
        <button
          type="button"
          onClick={() => switchMode("password")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "password"
              ? "bg-slate-800 text-emerald-300 shadow-inner shadow-slate-950"
              : "hover:bg-slate-800/50 hover:text-slate-100"
          }`}
        >
          Password
        </button>
      </div>

      {mode === "magic-link" ? (
        <form className="space-y-5" onSubmit={handleMagicLinkSubmit}>
          <label className="block space-y-2 text-sm font-medium">
            <span className="text-slate-300">Work email</span>
            <input
              name="email"
              type="email"
              inputMode="email"
              placeholder="you@agency.com"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              disabled={isMagicDisabled}
              autoComplete="email"
            />
          </label>

          <button
            type="submit"
            disabled={isMagicDisabled}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600/30 disabled:text-emerald-200"
          >
            {isMagicLoading ? "Sending magic link…" : "Send magic link"}
          </button>

          {magicStatus.state === "sent" ? (
            <p className="text-sm text-emerald-400">
              Magic link sent! Open the email on this device to finish signing in.
            </p>
          ) : null}

          {magicStatus.state === "error" ? (
            <p className="text-sm text-rose-400">{magicStatus.message}</p>
          ) : null}
        </form>
      ) : (
        <form className="space-y-5" onSubmit={handlePasswordSubmit}>
          <div className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              <span className="text-slate-300">Work email</span>
              <input
                name="email"
                type="email"
                inputMode="email"
                placeholder="you@agency.com"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                disabled={isPasswordLoading}
                autoComplete="email"
              />
            </label>

            <label className="block space-y-2 text-sm font-medium">
              <span className="text-slate-300">Password</span>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                disabled={isPasswordLoading}
                autoComplete="current-password"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isPasswordLoading}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600/30 disabled:text-emerald-200"
          >
            {isPasswordLoading ? "Signing in…" : "Sign in"}
          </button>

          {passwordStatus.state === "error" ? (
            <p className="text-sm text-rose-400">{passwordStatus.message}</p>
          ) : (
            <p className="text-sm text-slate-400">
              Forgot your password? Ask an admin to reset it in Supabase Auth.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
