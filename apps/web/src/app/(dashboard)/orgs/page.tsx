import Link from "next/link";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";
import { createServerComponentClientWithAuth } from "@/lib/supabase";

export const metadata = {
  title: "Organizations • LocalSpotlight",
};

export default async function OrganizationsIndexPage() {
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  const memberships = await db
    .from("org_members")
    .select("role, user_id, orgs(id, name, plan, created_at)")
    .filter("user_id", "eq", userId)
    .order("created_at", { ascending: true });

  type MembershipWithOrg = {
    role: Database["public"]["Enums"]["org_member_role"];
    orgs: {
      id: string;
      name: string;
      plan: string | null;
      created_at: string | null;
    } | null;
  };

  const records = (memberships.data as MembershipWithOrg[] | null) ?? [];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Organizations</h1>
          <p className="text-sm text-slate-400">
            Manage access, billing, and integrations by organization.
          </p>
        </div>
        <Link
          href="/settings/org"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
        >
          Create organization
        </Link>
      </header>
      {records.length === 0 ? (
        <p className="text-sm text-slate-400">
          No organizations yet. Create one to begin connecting Google profiles.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/70">
          {records.map((membership) => {
            const org = membership.orgs;
            if (!org) return null;
            return (
              <li
                key={org.id}
                className="flex items-center justify-between px-6 py-4 text-sm text-slate-200"
              >
                <div>
                  <div className="font-medium text-white">{org.name}</div>
                  <div className="mt-1 flex gap-3 text-xs uppercase tracking-wide text-slate-400">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5">
                      {org.plan ?? "Unassigned"}
                    </span>
                    <span>{membership.role}</span>
                  </div>
                </div>
                <Link href={`/orgs/${org.id}`} className="text-emerald-400 hover:text-emerald-300">
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
