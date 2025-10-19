import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Database } from "@/types/database";
import { createServerComponentClientWithAuth } from "@/lib/supabase";

type OrgRow = Pick<
  Database["public"]["Tables"]["orgs"]["Row"],
  "id" | "name" | "plan" | "created_at"
>;

type MemberRow = {
  id: string;
  role: Database["public"]["Enums"]["org_member_role"];
  users: { name: string | null; email: string | null } | null;
};

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const orgResponse = await db
    .from("orgs")
    .select("id, name, plan, created_at")
    .filter("id", "eq", orgId)
    .single();

  const org = orgResponse.data as OrgRow | null;

  if (orgResponse.error || !org) {
    notFound();
  }

  const memberResponse = await db
    .from("org_members")
    .select("id, role, users(name, email)")
    .filter("org_id", "eq", orgId)
    .order("created_at", { ascending: true });

  const members = (memberResponse.data as MemberRow[] | null) ?? [];

  const createdAt = org.created_at ? new Date(org.created_at).toLocaleString() : "Unknown";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">{org.name}</h1>
          <p className="mt-2 text-sm text-slate-400">Plan: {org.plan ?? "Unknown"}</p>
          <p className="text-xs text-slate-500">Created {createdAt}</p>
        </div>
        <Link
          href={`/orgs/${orgId}/settings`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
        >
          Organization settings
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        {members.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No members yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-800 text-sm text-slate-200">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-white">
                    {member.users?.name ?? member.users?.email ?? "Unknown"}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    {member.role}
                  </div>
                </div>
                <span className="text-xs text-slate-500">{member.users?.email ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
