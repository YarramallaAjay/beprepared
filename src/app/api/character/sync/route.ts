import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { syncCharacter } from "@/lib/character/character-sync";
import { invalidateUserContext } from "@/lib/ai/user-context";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const characterMd = await syncCharacter(user.id);
    invalidateUserContext(user.id);
    return NextResponse.json({ character: characterMd });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
