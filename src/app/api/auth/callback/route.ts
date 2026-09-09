import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Create profile if it doesn't exist
        await supabase.from("profiles").upsert(
          { id: user.id },
          { onConflict: "id" }
        );

        // Check if onboarding is already completed
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if (profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // Check if social profiles exist (they've at least started onboarding)
        const { count } = await supabase
          .from("social_profiles")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (count && count > 0) {
          // They've connected profiles but haven't finished interview
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // Fresh user — start from connect step
        return NextResponse.redirect(`${origin}/onboarding/connect`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
