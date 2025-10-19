import { redirect } from "next/navigation";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { SignInForm } from "@/components/sign-in-form";

export const metadata = {
  title: "Sign in • LocalSpotlight",
};

export default async function SignInPage() {
  const supabase = await createServerComponentClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">
          Use a magic link or your password to access the LocalSpotlight control center.
        </p>
      </div>
      <SignInForm />
    </div>
  );
}
