/** Supabase disabled for now – re-export stub from lib/supabase/client. Uncomment block below to re-enable. */
export { createClient } from '@/lib/supabase/client'

/*
// --- Original lib/client (uncomment and remove re-export above to re-enable) ---
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
  )
}
*/
