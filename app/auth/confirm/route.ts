import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Creating a handler to a GET request to route /auth/confirm
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  // Create redirect link without the secret token
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = "/";
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase() || "";
      const acceptedDomain = "@student.ateneo.edu";

      if (!email.endsWith(acceptedDomain)) {
        try {
          const supabaseAdmin = await createAdminClient();
          if (user?.id) {
            await supabaseAdmin.auth.admin.deleteUser(user.id);
          }
          await supabase.auth.signOut();
        } catch (adminError) {
          console.error("Cleanup failed for unauthorized user:", adminError);
        }
        return NextResponse.redirect(
          `${baseUrl}/auth/login/non-ateneo-email-used`
        );
      }

      redirectTo.searchParams.delete("next");
      return NextResponse.redirect(redirectTo);
    }
  }

  // return the user to an error page with some instructions
  redirectTo.pathname = "/error";
  return NextResponse.redirect(redirectTo);
}
