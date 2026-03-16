/** Supabase disabled for now – returns a no-op client. Uncomment block below to re-enable. */
type NoopChannel = {
  on: (...args: unknown[]) => NoopChannel;
  subscribe: (cb?: (status: string) => void) => void;
  unsubscribe: () => void;
  send: (args: unknown) => Promise<void>;
};

type SupabaseNoopClient = {
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>;
    getSession: () => Promise<{ data: { session: null }; error: null }>;
    signOut: () => Promise<{ error: null }>;
    signInWithOAuth: () => Promise<{ data: null; error: Error }>;
    onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } };
  };
  channel: (name?: string) => NoopChannel;
  removeChannel: (channel: NoopChannel) => void;
  from: (table?: string) => {
    select: () => { single: () => Promise<{ data: null; error: null }> };
    upsert: () => Promise<{ error: null }>;
    insert: () => Promise<{ error: null }>;
    update: () => { eq: () => Promise<{ error: null }> };
  };
};

export function createClient() {
  const channel = (): NoopChannel => {
    const c: NoopChannel = {
      on: () => c,
      subscribe: (cb) => cb?.("SUBSCRIBED"),
      unsubscribe: () => {},
      send: async () => {},
    };
    return c;
  };

  const client: SupabaseNoopClient = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithOAuth: () => Promise.resolve({ data: null, error: new Error("Supabase disabled") }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => channel(),
    removeChannel: () => {},
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
// --- Original browser client (uncomment and remove stub above to re-enable) ---
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
*/
