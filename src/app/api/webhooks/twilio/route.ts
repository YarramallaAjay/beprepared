import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendWhatsApp } from "@/lib/twilio/client";
import { callLLMJson } from "@/lib/ai/llm-client";
import { WHATSAPP_PARSING_SYSTEM } from "@/lib/ai/prompts";

export async function POST(request: Request) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  if (!from || !body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const phone = from.replace("whatsapp:", "");
  const supabase = await createServiceRoleClient();

  // Find user by phone number in reminders
  const { data: reminder } = await supabase
    .from("reminders")
    .select("user_id")
    .eq("phone_number", phone)
    .eq("channel", "whatsapp")
    .single();

  if (!reminder) {
    await sendWhatsApp(from, "I don't recognize this number. Please set up WhatsApp reminders in the app first.");
    return NextResponse.json({ success: true });
  }

  const userId = reminder.user_id;

  // Parse intent with LLM
  const intent = await callLLMJson<{
    intent: string;
    item_reference: number | null;
    message: string;
  }>("whatsapp_parsing", [
    { role: "system", content: WHATSAPP_PARSING_SYSTEM },
    { role: "user", content: body },
  ]);

  const today = new Date().toISOString().split("T")[0];

  switch (intent.intent) {
    case "mark_done": {
      const { data: plan } = await supabase
        .from("daily_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .single();

      if (plan) {
        const { data: items } = await supabase
          .from("daily_plan_items")
          .select("id, item_order, content_items(title)")
          .eq("daily_plan_id", plan.id)
          .eq("status", "pending")
          .order("item_order", { ascending: true })
          .limit(1);

        if (items && items.length > 0) {
          await supabase
            .from("daily_plan_items")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", items[0].id);

          const title = (items[0] as unknown as { content_items: { title: string } }).content_items?.title;
          await sendWhatsApp(from, `Marked "${title}" as done! ${intent.message}`);
        } else {
          await sendWhatsApp(from, "All tasks for today are done! Great job! 🎉");
        }
      }
      break;
    }

    case "status": {
      const { data: plan } = await supabase
        .from("daily_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .single();

      if (plan) {
        const { data: items } = await supabase
          .from("daily_plan_items")
          .select("status")
          .eq("daily_plan_id", plan.id);

        const total = items?.length || 0;
        const done = items?.filter((i) => i.status === "completed").length || 0;
        await sendWhatsApp(from, `Today's progress: ${done}/${total} tasks completed. ${intent.message}`);
      } else {
        await sendWhatsApp(from, "No plan for today yet. Check the app to generate one.");
      }
      break;
    }

    case "skip": {
      const { data: plan } = await supabase
        .from("daily_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .single();

      if (plan) {
        const { data: items } = await supabase
          .from("daily_plan_items")
          .select("id, content_items(title)")
          .eq("daily_plan_id", plan.id)
          .eq("status", "pending")
          .order("item_order", { ascending: true })
          .limit(1);

        if (items && items.length > 0) {
          await supabase
            .from("daily_plan_items")
            .update({ status: "skipped" })
            .eq("id", items[0].id);

          await sendWhatsApp(from, `Skipped current task. ${intent.message}`);
        }
      }
      break;
    }

    case "next": {
      const { data: plan } = await supabase
        .from("daily_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .single();

      if (plan) {
        const { data: items } = await supabase
          .from("daily_plan_items")
          .select("*, content_items(*)")
          .eq("daily_plan_id", plan.id)
          .eq("status", "pending")
          .order("item_order", { ascending: true })
          .limit(1);

        if (items && items.length > 0) {
          const item = items[0] as unknown as { content_items: { title: string; url: string; content_type: string; estimated_minutes: number } };
          const ci = item.content_items;
          await sendWhatsApp(
            from,
            `Next up: "${ci.title}" (${ci.content_type}, ~${ci.estimated_minutes} min)\n${ci.url || "No URL"}`
          );
        } else {
          await sendWhatsApp(from, "You've completed all tasks for today! 🎉");
        }
      }
      break;
    }

    default:
      await sendWhatsApp(
        from,
        "Commands: reply 'done' (mark complete), 'skip' (skip task), 'next' (show next task), 'status' (show progress)"
      );
  }

  return NextResponse.json({ success: true });
}
