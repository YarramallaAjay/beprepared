import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  generateAdaptiveQuestions,
  getBaseQuestions,
  analyzeInterviewAnswers,
} from "@/lib/ai/interview-engine";

// GET: Get interview questions (base + adaptive)
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") || "base";

  if (step === "base") {
    return NextResponse.json({ questions: getBaseQuestions() });
  }

  // For adaptive questions, get previous answers from the request
  const answersParam = searchParams.get("answers");
  if (!answersParam) {
    return NextResponse.json({ error: "Answers required for adaptive questions" }, { status: 400 });
  }

  try {
    const answers = JSON.parse(answersParam);

    // Get character doc if available
    const { data: charDoc } = await supabase
      .from("character_documents")
      .select("content_md")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const questions = await generateAdaptiveQuestions({
      answers,
      currentStep: parseInt(searchParams.get("currentStep") || "1"),
      characterContext: charDoc?.content_md,
    });

    return NextResponse.json({ questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate questions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Submit all interview answers and analyze
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { answers, profile_data } = body;

  try {
    // Get character doc
    const { data: charDoc } = await supabase
      .from("character_documents")
      .select("content_md")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    // Analyze answers
    const analysis = await analyzeInterviewAnswers(answers, charDoc?.content_md);

    // Update profile with interview data + analysis
    const { error } = await supabase
      .from("profiles")
      .update({
        target_role: profile_data.target_role || analysis.suggested_role,
        current_role: profile_data.current_role,
        experience_years: profile_data.experience_years,
        tech_stack: analysis.suggested_tech_stack,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        domain_experience: analysis.suggested_domains,
        tech_targets: profile_data.tech_targets || [],
        daily_hours_available: profile_data.daily_hours_available || 2,
        preferred_learning_time: profile_data.preferred_learning_time || "morning",
        interview_answers: answers,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process interview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
