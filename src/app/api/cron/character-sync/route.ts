import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { syncCharacter } from "@/lib/character/character-sync";

// Weekly character sync cron
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Get all users with social profiles
  const { data: users } = await supabase
    .from("social_profiles")
    .select("user_id")
    .not("user_id", "is", null);

  if (!users) return NextResponse.json({ synced: 0 });

  const uniqueUserIds = [...new Set(users.map((u) => u.user_id))];
  let synced = 0;

  for (const userId of uniqueUserIds) {
    try {
      await syncCharacter(userId);
      synced++;
    } catch (err) {
      console.error(`Failed to sync character for ${userId}:`, err);
    }
  }

  return NextResponse.json({ synced });
}
