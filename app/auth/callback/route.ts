import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUser } from "@/app/actions/users";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const email = data.user.email?.toLowerCase() || "";
      const acceptedDomain = "@student.ateneo.edu";

      if (email.endsWith(acceptedDomain)) {
        try {
          const supabaseAdmin = await createAdminClient();
          // Delete the user record
          await supabaseAdmin.auth.admin.deleteUser(data.user.id);

          await supabase.auth.signOut();
        } catch (adminError) {
          console.error("Cleanup failed for unauthorized user:", adminError);
        }

        return NextResponse.redirect(`${baseUrl}/login/non-ateneo-email-used`);
      }

      // Handle successful login redirect
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      const safeNext = next.startsWith("/") ? next : "/";
      await createUser(data.user.id);

      if (isLocalEnv) {
        return NextResponse.redirect(`${baseUrl}${safeNext}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
      } else {
        return NextResponse.redirect(`${baseUrl}${safeNext}`);
      }
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
