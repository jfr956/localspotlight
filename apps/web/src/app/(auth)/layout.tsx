export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
        {children}
      </div>
      <p className="mt-6 text-sm text-slate-400">
        Need help? Review the onboarding checklist in your{" "}
        <span className="font-medium">LocalSpotlight</span> workspace.
      </p>
    </div>
  );
}
