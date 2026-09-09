"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface InterviewOption {
  label: string;
  description: string;
  evidence: string;
}

interface InterviewQuestion {
  id: string;
  question: string;
  context: string;
  options: InterviewOption[];
  category: string;
}

type Step =
  | "checking"
  | "returning_user"
  | "basic_info"
  | "base_questions"
  | "adaptive_questions"
  | "sources"
  | "schedule"
  | "complete";

const INTERVIEW_STEPS: Step[] = [
  "basic_info",
  "base_questions",
  "adaptive_questions",
  "sources",
  "schedule",
  "complete",
];

interface ExistingProfile {
  current_role: string;
  target_role: string;
  experience_years: number;
  tech_targets: string[];
  daily_hours_available: number;
  preferred_learning_time: string;
  onboarding_completed: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState<Step>("checking");
  const [loading, setLoading] = useState(false);
  const [existingProfile, setExistingProfile] = useState<ExistingProfile | null>(null);

  const [currentRole, setCurrentRole] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [experienceYears, setExperienceYears] = useState("");

  const [baseQuestions, setBaseQuestions] = useState<InterviewQuestion[]>([]);
  const [adaptiveQuestions, setAdaptiveQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [sourcePeople, setSourcePeople] = useState("");
  const [techTargets, setTechTargets] = useState("");

  const [dailyHours, setDailyHours] = useState("2");
  const [learningTime, setLearningTime] = useState("morning");

  // Check if user has already completed onboarding
  const checkExistingProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "current_role, target_role, experience_years, tech_targets, daily_hours_available, preferred_learning_time, onboarding_completed"
      )
      .eq("id", user.id)
      .single();

    if (profile?.onboarding_completed) {
      setExistingProfile(profile as ExistingProfile);
      // Pre-fill form fields from existing data
      setCurrentRole(profile.current_role || "");
      setTargetRole(profile.target_role || "");
      setExperienceYears(String(profile.experience_years || ""));
      setTechTargets((profile.tech_targets || []).join(", "));
      setDailyHours(String(profile.daily_hours_available || 2));
      setLearningTime(profile.preferred_learning_time || "morning");
      setCurrentStep("returning_user");
    } else {
      setCurrentStep("basic_info");
    }
  }, [supabase]);

  useEffect(() => {
    checkExistingProfile();
  }, [checkExistingProfile]);

  const fetchBaseQuestions = useCallback(async () => {
    const res = await fetch("/api/interview?step=base");
    const data = await res.json();
    setBaseQuestions(data.questions || []);
  }, []);

  useEffect(() => {
    if (currentStep === "base_questions" && baseQuestions.length === 0) {
      fetchBaseQuestions();
    }
  }, [currentStep, baseQuestions.length, fetchBaseQuestions]);

  async function fetchAdaptiveQuestions() {
    setLoading(true);
    const res = await fetch(
      `/api/interview?step=adaptive&answers=${encodeURIComponent(JSON.stringify(answers))}&currentStep=${currentQuestionIdx}`
    );
    const data = await res.json();
    setAdaptiveQuestions(data.questions || []);
    setCurrentQuestionIdx(0);
    setLoading(false);
  }

  function handleAnswer(questionId: string, optionLabel: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionLabel }));
  }

  function getCurrentQuestions(): InterviewQuestion[] {
    return currentStep === "base_questions" ? baseQuestions : adaptiveQuestions;
  }

  function nextQuestion() {
    const questions = getCurrentQuestions();
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else if (currentStep === "base_questions") {
      setCurrentStep("adaptive_questions");
      fetchAdaptiveQuestions();
    } else {
      setCurrentStep("sources");
    }
  }

  async function handleFinish() {
    setLoading(true);
    if (sourcePeople.trim()) {
      const people = sourcePeople
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      for (const person of people) {
        await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_name: person, source_type: "person" }),
        });
      }
    }

    await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        profile_data: {
          current_role: currentRole,
          target_role: targetRole,
          experience_years: parseInt(experienceYears) || 0,
          tech_targets: techTargets
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          daily_hours_available: parseFloat(dailyHours) || 2,
          preferred_learning_time: learningTime,
        },
      }),
    });

    // Build/rebuild character document with full profile + social data + interview answers
    try {
      await fetch("/api/character/sync", { method: "POST" });
    } catch {
      // best-effort — character can be synced later from settings
    }

    await fetch("/api/curate", { method: "POST" });

    // Auto-generate today's daily plan from curated content
    try {
      await fetch("/api/daily-plan", { method: "POST" });
    } catch {
      // best-effort — plan can be generated from dashboard
    }

    // Set onboarding cookie so middleware doesn't redirect back here
    document.cookie =
      "onboarding_completed=true; path=/; max-age=31536000; samesite=lax";

    setLoading(false);
    setCurrentStep("complete");
  }

  if (currentStep === "checking") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400" />
      </main>
    );
  }

  const progress =
    currentStep === "returning_user"
      ? 0
      : ((INTERVIEW_STEPS.indexOf(currentStep) + 1) / INTERVIEW_STEPS.length) *
        100;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              Be<span className="text-emerald-400">Prepared</span> Interview
            </CardTitle>
            {currentStep !== "returning_user" && (
              <Badge variant="secondary">
                {existingProfile ? "Re-Interview" : "Step 2 of 2"}
              </Badge>
            )}
          </div>
          {currentStep !== "returning_user" && (
            <Progress value={progress} className="mt-3 h-1.5" />
          )}
        </CardHeader>
        <CardContent>
          {/* Returning user — offer choice */}
          {currentStep === "returning_user" && existingProfile && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Welcome back!
                </h3>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve already completed onboarding. What would you like
                  to do?
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Current Profile
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Role:</span>
                  <span className="text-foreground">
                    {existingProfile.current_role || "Not set"}
                  </span>
                  <span className="text-muted-foreground">Target:</span>
                  <span className="text-foreground">
                    {existingProfile.target_role || "Not set"}
                  </span>
                  <span className="text-muted-foreground">Experience:</span>
                  <span className="text-foreground">
                    {existingProfile.experience_years || 0} years
                  </span>
                  {existingProfile.tech_targets?.length > 0 && (
                    <>
                      <span className="text-muted-foreground">Targets:</span>
                      <span className="text-foreground">
                        {existingProfile.tech_targets.join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => router.push("/dashboard")}
                >
                  Continue to Dashboard
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setCurrentStep("basic_info")}
                >
                  Re-take Interview (refresh roadmap &amp; content)
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Re-taking the interview will update your character profile and
                re-curate content based on new answers.
              </p>
            </div>
          )}

          {currentStep === "basic_info" && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm mb-4">
                {existingProfile
                  ? "Update your info or keep the existing values. We'll use this to refresh your roadmap."
                  : "Tell us about where you are and where you want to go."}
              </p>
              <div className="space-y-1">
                <Label>Current Role</Label>
                <Input
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  placeholder="e.g., Backend Engineer at Startup X"
                />
              </div>
              <div className="space-y-1">
                <Label>Target Role</Label>
                <Input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g., Senior Backend Engineer, Staff Engineer"
                />
              </div>
              <div className="space-y-1">
                <Label>Years of Experience</Label>
                <Input
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g., 4"
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                onClick={() => setCurrentStep("base_questions")}
                disabled={!currentRole || !targetRole}
              >
                Continue to Interview
              </Button>
              {existingProfile && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel and go back
                </Button>
              )}
            </div>
          )}

          {(currentStep === "base_questions" ||
            currentStep === "adaptive_questions") && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {currentStep === "adaptive_questions"
                      ? "Generating personalized follow-up questions..."
                      : "Loading questions..."}
                  </p>
                </div>
              ) : (
                (() => {
                  const questions = getCurrentQuestions();
                  const q = questions[currentQuestionIdx];
                  if (!q) return null;
                  return (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-emerald-400/80 mb-1">
                          {currentStep === "adaptive_questions"
                            ? "Adaptive Question"
                            : `Question ${currentQuestionIdx + 1} of ${questions.length}`}
                        </p>
                        <h3 className="text-lg font-medium text-foreground">
                          {q.question}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {q.context}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {q.options.map((opt) => (
                          <button
                            key={opt.label}
                            onClick={() => handleAnswer(q.id, opt.label)}
                            className={`w-full text-left p-4 rounded-lg border transition-all ${
                              answers[q.id] === opt.label
                                ? "border-emerald-500 bg-emerald-500/10"
                                : "border-border bg-muted/30 hover:border-muted-foreground/30"
                            }`}
                          >
                            <p className="font-medium text-sm text-foreground">
                              {opt.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {opt.description}
                            </p>
                            <p className="text-xs text-emerald-400/70 mt-1 italic">
                              {opt.evidence}
                            </p>
                          </button>
                        ))}
                      </div>
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={nextQuestion}
                        disabled={!answers[q.id]}
                      >
                        {currentQuestionIdx < questions.length - 1
                          ? "Next Question"
                          : currentStep === "base_questions"
                            ? "Generate Follow-ups"
                            : "Continue"}
                      </Button>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {currentStep === "sources" && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm mb-2">
                Mention people or sources to prioritize content from. We&apos;ll
                find their blogs, videos, and courses first.
              </p>
              <div className="space-y-1">
                <Label>People to follow (comma-separated)</Label>
                <Input
                  value={sourcePeople}
                  onChange={(e) => setSourcePeople(e.target.value)}
                  placeholder="e.g., Arpit Bhayani, Martin Kleppmann, Alex Xu"
                />
              </div>
              <div className="space-y-1">
                <Label>Tech targets (comma-separated)</Label>
                <Input
                  value={techTargets}
                  onChange={(e) => setTechTargets(e.target.value)}
                  placeholder="e.g., System Design, Distributed Systems, Kubernetes"
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                onClick={() => setCurrentStep("schedule")}
              >
                Continue
              </Button>
            </div>
          )}

          {currentStep === "schedule" && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm mb-2">
                How much time can you dedicate daily?
              </p>
              <div className="space-y-1">
                <Label>Daily hours available</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Preferred learning time</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["morning", "afternoon", "evening"].map((time) => (
                    <button
                      key={time}
                      onClick={() => setLearningTime(time)}
                      className={`p-3 rounded-lg border text-sm capitalize transition-all ${
                        learningTime === time
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/30"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                onClick={handleFinish}
                disabled={loading}
              >
                {loading
                  ? "Setting up your learning path..."
                  : existingProfile
                    ? "Update & Re-curate"
                    : "Finish Setup"}
              </Button>
            </div>
          )}

          {currentStep === "complete" && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-emerald-400 text-xl">&#10003;</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {existingProfile ? "Profile Updated!" : "You're all set!"}
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                {existingProfile
                  ? "Your character profile and content roadmap have been refreshed based on your new answers."
                  : "We've analyzed your profile and curated a personalized learning roadmap. Head to your dashboard."}
              </p>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
