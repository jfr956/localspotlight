import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase client environment variables are not set");
}

type CookieEntry = { name: string; value: string; options: Record<string, unknown> };

const buildCookieAdapter = async (allowWrite: boolean) => {
  const cookieStore = await cookies();

  const getAll = async () => cookieStore.getAll();

  const setAll = async (entries: CookieEntry[]) => {
    if (!allowWrite) {
      return;
    }

    entries.forEach(({ name, value, options }) => {
      (cookieStore as unknown as { set: (name: string, value: string, options: Record<string, unknown>) => void }).set(
        name,
        value,
        options,
      );
    });
  };

  return { getAll, setAll };
};

// Components only require read access.
export const createServerComponentClientWithAuth = async () => {
  const { getAll } = await buildCookieAdapter(false);

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll,
    },
  });
};

// Server Actions can modify cookies through Next's response helpers.
export const createServerActionClientWithAuth = async () => {
  const mutableCookies = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: async () => mutableCookies.getAll(),
      setAll: async (entries) => {
        entries.forEach(({ name, value, options }) => {
          (mutableCookies as unknown as {
            set: (name: string, value: string, options: Record<string, unknown>) => void;
          }).set(name, value, options);
        });
      },
    },
  });
};

// Route Handlers have write access as well.
export const createRouteHandlerClientWithAuth = async () => {
  const mutableCookies = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: async () => mutableCookies.getAll(),
      setAll: async (entries) => {
        entries.forEach(({ name, value, options }) => {
          (mutableCookies as unknown as {
            set: (name: string, value: string, options: Record<string, unknown>) => void;
          }).set(name, value, options);
        });
      },
    },
  });
};

// Service role client for elevated operations
let serviceRoleClient: SupabaseClient<Database> | null = null;

export const getServiceRoleClient = (): SupabaseClient<Database> => {
  if (typeof window !== "undefined") {
    throw new Error("getServiceRoleClient must only be used on the server");
  }

  if (!serviceRoleClient) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      throw new Error("Supabase service-role environment variables are not set");
    }

    serviceRoleClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return serviceRoleClient;
};
