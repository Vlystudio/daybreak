import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/env";

/** Supabase Auth code exchange (email confirmation / magic links / OAuth). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";

  // Only allow same-origin relative redirects.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, publicEnv.NEXT_PUBLIC_APP_URL));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", publicEnv.NEXT_PUBLIC_APP_URL));
}
