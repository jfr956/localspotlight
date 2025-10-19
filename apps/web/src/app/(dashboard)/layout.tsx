import { redirect } from "next/navigation";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "./actions/sign-out";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch user's organizations
  const { data: orgsData } = await db
    .from("orgs")
    .select("id, name")
    .order("created_at", { ascending: true });

  const organizations = orgsData ?? [];
  const currentOrgId = organizations[0]?.id ?? null;
  const currentOrg = organizations.find((org) => org.id === currentOrgId) ?? null;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar
        organizations={organizations}
        currentOrgId={currentOrgId}
        onSignOut={signOut}
      />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/70 px-6">
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-400">
              <div className="text-xs uppercase tracking-wide">Organization</div>
              <div className="text-sm font-medium text-slate-100">
                {currentOrg?.name ?? "No organization"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle variant="ghost" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
