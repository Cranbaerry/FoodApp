import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 *
 * All database and storage access happens on the server through this client.
 * The browser never talks to Supabase directly, so RLS can stay locked down
 * with no public policies. NEVER import this into a client component.
 *
 * The client is created lazily on first use so importing this module (e.g.
 * during `next build` page-data collection) doesn't require env vars to exist.
 */

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Lazily-initialised service-role client. Env is validated on first use. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = c[prop as keyof SupabaseClient];
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export const FOOD_BUCKET = "food-images";

export interface ChatRow {
  id: string;
  created_at: string;
  image_url: string;
  food_name: string | null;
  nutrition: unknown | null;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
