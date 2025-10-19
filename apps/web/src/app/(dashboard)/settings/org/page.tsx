import Link from "next/link";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { CreateOrganizationForm } from "@/components/create-organization-form";

export const metadata = {
  title: "Organizations • LocalSpotlight",
};

export default async function OrganizationSettingsPage() {
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  const membershipsResponse = await db
    .from("org_members")
    .select("role, user_id, orgs(id, name, plan, created_at)")
    .filter("user_id", "eq", userId);

  type MembershipWithOrg = {
    role: Database["public"]["Enums"]["org_member_role"];
    orgs: {
      id: string;
      name: string;
      plan: string | null;
      created_at: string | null;
    } | null;
  };

  const memberships = (membershipsResponse.data as MembershipWithOrg[] | null) ?? [];

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-xl font-semibold text-white">Create organization</h1>
        <p className="mt-2 text-sm text-slate-400">
          Organizations are the security boundary for locations, automations, and billing. You will
          be assigned as the owner and can invite teammates later.
        </p>
        <div className="mt-6 max-w-md">
          <CreateOrganizationForm />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Your organizations</h2>
            <p className="mt-1 text-sm text-slate-400">
              Access is controlled by organization membership and role-based permissions.
            </p>
          </div>
          <Link href="/orgs" className="text-sm text-emerald-400 hover:text-emerald-300">
            View all
          </Link>
        </div>
        {memberships.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            You are not a member of any organization yet. Create one above to get started.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-800">
            {memberships.map((membership) => {
              const org = membership.orgs;
              if (!org) return null;
              const createdAt = org.created_at ? new Date(org.created_at).toLocaleDateString() : "";

              return (
                <li
                  key={org.id}
                  className="flex items-center justify-between py-3 text-sm text-slate-200"
                >
                  <div>
                    <div className="font-medium text-white">{org.name}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                      <span className="rounded-full bg-slate-800 px-2 py-0.5">{org.plan}</span>
                      <span>{membership.role}</span>
                      {createdAt ? <span>Created {createdAt}</span> : null}
                    </div>
                  </div>
                  <Link
                    href={`/orgs/${org.id}`}
                    className="text-emerald-400 transition hover:text-emerald-300"
                  >
                    Open
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
