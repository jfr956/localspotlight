"use client";

import { useState, type ReactNode } from "react";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase-client";

type SupabaseProviderProps = {
  session: Session | null;
  children: ReactNode;
};

export function SupabaseProvider({ children, session }: SupabaseProviderProps) {
  const [supabaseClient] = useState(() => createBrowserClient());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerClient = supabaseClient as any;

  return (
    <SessionContextProvider supabaseClient={providerClient} initialSession={session}>
      {children}
    </SessionContextProvider>
  );
}
