import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendWhatsApp } from "@/lib/twilio/client";

// Vercel Cron: runs every hour, checks if it's time to send reminders
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();
  const now = new Date();

  // Get all active WhatsApp reminders
  const { data: reminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("channel", "whatsapp")
    .eq("enabled", true);

  if (!reminders) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const reminder of reminders) {
    const userTime = new Date(
      now.toLocaleString("en-US", { timeZone: reminder.timezone || "Asia/Kolkata" })
    );
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();

    const morningHour = parseInt(reminder.morning_time?.split(":")[0] || "8");
    const eveningHour = parseInt(reminder.evening_time?.split(":")[0] || "20");

    const isMorning = currentHour === morningHour && currentMinute < 30;
    const isEvening = currentHour === eveningHour && currentMinute < 30;

    if (!isMorning && !isEvening) continue;

    const today = now.toISOString().split("T")[0];
    const phone = reminder.phone_number;
    if (!phone) continue;

    // Get or create today's plan
    const { data: plan } = await supabase
      .from("daily_plans")
      .select("id, daily_plan_items(status, content_items(title, content_type, estimated_minutes))")
      .eq("user_id", reminder.user_id)
      .eq("plan_date", today)
      .single();

    if (isMorning) {
      if (plan) {
        const items = (plan.daily_plan_items as unknown as { status: string; content_items: { title: string; content_type: string; estimated_minutes: number } }[]) || [];
        const pending = items.filter((i) => i.status === "pending");
        const taskList = pending
          .slice(0, 5)
          .map(
            (i, idx) =>
              `${idx + 1}. ${i.content_items.title} (${i.content_items.content_type}, ${i.content_items.estimated_minutes}min)`
          )
          .join("\n");

        await sendWhatsApp(
          phone,
          `Good morning! Here's your plan for today:\n\n${taskList}\n\nReply 'next' to start, 'done' when finished, 'skip' to skip.`
        );
      } else {
        await sendWhatsApp(
          phone,
          "Good morning! No plan generated for today yet. Open the app to create your daily plan."
        );
      }
    }

    if (isEvening) {
      if (plan) {
        const items = (plan.daily_plan_items as unknown as { status: string }[]) || [];
        const total = items.length;
        const done = items.filter((i) => i.status === "completed").length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        await sendWhatsApp(
          phone,
          `Evening check-in: You completed ${done}/${total} tasks today (${pct}%).\n\n${
            pct === 100
              ? "Perfect day! Keep the streak going!"
              : pct >= 50
              ? "Good progress! Can you finish one more before bed?"
              : "There's still time! Even one task builds momentum."
          }`
        );
      }
    }

    sent++;
  }

  return NextResponse.json({ sent });
}
