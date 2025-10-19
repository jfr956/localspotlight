// Re-export client utilities
export { createBrowserClient } from "./supabase-client";

// Re-export server utilities
export {
  createServerComponentClientWithAuth,
  createServerActionClientWithAuth,
  createRouteHandlerClientWithAuth,
  getServiceRoleClient,
} from "./supabase-server";
