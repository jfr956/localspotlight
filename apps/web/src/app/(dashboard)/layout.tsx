import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

  // Get selected orgId from cookie (set by middleware when user switches orgs)
  const cookieStore = await cookies();
  const selectedOrgId = cookieStore.get("selected-org-id")?.value;

  // Fetch user's organizations (only orgs they are a member of)
  const { data: membershipsData } = await db
    .from("org_members")
    .select("orgs(id, name, created_at)")
    .eq("user_id", user.id);

  type OrgWithCreatedAt = { id: string; name: string | null; created_at: string };
  type MembershipWithOrg = { orgs: OrgWithCreatedAt | null };

  const organizations = (membershipsData as MembershipWithOrg[] | null)
    ?.map((m) => m.orgs)
    .filter((org): org is OrgWithCreatedAt => org !== null)
    .sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .map(({ id, name }) => ({ id, name })) ?? [];

  // Determine current org:
  // 1. Use cookie if valid
  // 2. Otherwise, find first org with managed locations
  // 3. Fallback to first org
  let currentOrgId: string | null = null;

  if (selectedOrgId && organizations.some((org) => org.id === selectedOrgId)) {
    // Cookie exists and is valid
    currentOrgId = selectedOrgId;
  } else if (organizations.length > 0) {
    // Find first org with managed locations
    const { data: locationsData } = await db
      .from("gbp_locations")
      .select("org_id")
      .in("org_id", organizations.map(o => o.id))
      .eq("is_managed", true)
      .limit(1);

    if (locationsData && locationsData.length > 0) {
      currentOrgId = locationsData[0].org_id;
    } else {
      // Fallback to first org
      currentOrgId = organizations[0].id;
    }
  }

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
