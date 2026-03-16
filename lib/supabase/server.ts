/** Supabase disabled for now – returns a no-op client. Uncomment block below to re-enable. */
type SupabaseServerNoopClient = {
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>;
    getClaims: () => Promise<{ data: { claims: null } }>;
    getSession: () => Promise<{ data: { session: null }; error: null }>;
    signOut: () => Promise<{ error: null }>;
    exchangeCodeForSession: () => Promise<{ data: null; error: null }>;
    verifyOtp: () => Promise<{ error: null }>;
  };
  from: (table?: string) => {
    select: () => { single: () => Promise<{ data: null; error: null }> };
    upsert: () => Promise<{ error: null }>;
    insert: () => Promise<{ error: null }>;
    update: () => { eq: () => Promise<{ error: null }> };
  };
};

export async function createClient() {
  const client: SupabaseServerNoopClient = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getClaims: () => Promise.resolve({ data: { claims: null } }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      exchangeCodeForSession: () => Promise.resolve({ data: null, error: null }),
      verifyOtp: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  };

  return client;
}

/*
// --- Original server client (uncomment and remove stub above to re-enable) ---
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    },
  );
}
*/
