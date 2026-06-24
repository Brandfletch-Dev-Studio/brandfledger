// src/app/auth/callback/route.ts
// Handles email confirmation + OAuth callbacks from Supabase
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check if user already has a business set up
        const { data: businesses } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1);

        const destination =
          !businesses || businesses.length === 0 ? "/dashboard" : "/dashboard";

        return NextResponse.redirect(`${origin}${destination}`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?message=Email+link+expired+or+invalid.+Please+sign+in.`
  );
}
