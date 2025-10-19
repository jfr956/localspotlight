"use client";

import { useTheme } from "@/components/providers/theme-provider";

type ThemeToggleProps = {
  variant?: "button" | "icon" | "ghost";
};

export function ThemeToggle({ variant = "button" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  if (variant === "icon" || variant === "ghost") {
    const baseIconClass =
      "inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-transparent";
    const variantClass =
      variant === "ghost"
        ? "border border-slate-800 bg-slate-900/70 hover:bg-slate-900 hover:text-white"
        : "border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white";

    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className={`${baseIconClass} ${variantClass}`}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-transparent"
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 4.75V2.5m0 19v-2.25m7.778-7.75H22.5m-19 0h2.222M17.66 6.34l1.591-1.59M4.75 19.25l1.59-1.59M6.34 6.34 4.75 4.75m14.5 14.5-1.59-1.59M12 8.75a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Z"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
      />
    </svg>
  );
}
