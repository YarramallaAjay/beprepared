"use client";

import { Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface OnboardingStep {
  slug: string;
  label: string;
  icon: string;
  description: string;
  completed: boolean;
  current: boolean;
}

interface OnboardingProgressProps {
  onboarding: {
    interview_complete: boolean;
    character_complete: boolean;
    content_discovery_complete: boolean;
    daily_plan_active: boolean;
  };
}

const STEPS = [
  { slug: "interview", label: "Interview", icon: "🎯", description: "Tell us about your career goals and preferences" },
  { slug: "character", label: "Profile", icon: "👤", description: "We build your personalized learning profile" },
  { slug: "content-discovery", label: "Content", icon: "🔍", description: "Curated resources matched to your goals" },
  { slug: "daily-plan", label: "Plan", icon: "📋", description: "Your daily learning schedule" },
];

export function OnboardingProgress({ onboarding }: OnboardingProgressProps) {
  const completionMap: Record<string, boolean> = {
    interview: onboarding.interview_complete,
    character: onboarding.character_complete,
    "content-discovery": onboarding.content_discovery_complete,
    "daily-plan": onboarding.daily_plan_active,
  };

  let foundCurrent = false;
  const steps: OnboardingStep[] = STEPS.map((s) => {
    const completed = completionMap[s.slug];
    const current = !completed && !foundCurrent;
    if (current) foundCurrent = true;
    return { ...s, completed, current };
  });

  const currentStep = steps.find((s) => s.current) || steps[0];

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Let&apos;s get you set up</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Complete these steps to unlock your personalized learning experience.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 w-full max-w-lg">
        {steps.map((step, i) => (
          <Fragment key={step.slug}>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-base transition-all ${
                  step.completed
                    ? "bg-emerald-600 text-white"
                    : step.current
                      ? "bg-emerald-600/20 text-emerald-400 ring-2 ring-emerald-500 animate-pulse"
                      : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {step.completed ? "✓" : step.icon}
              </div>
              <span
                className={`text-xs font-medium text-center ${
                  step.current
                    ? "text-emerald-400"
                    : step.completed
                      ? "text-gray-300"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 -mt-5 ${
                  step.completed ? "bg-emerald-600" : "bg-zinc-800"
                }`}
              />
            )}
          </Fragment>
        ))}
      </div>

      {/* Current step action card */}
      <Card className="w-full max-w-md border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-5 text-center">
          <p className="text-3xl mb-2">{currentStep.icon}</p>
          <p className="text-sm font-medium mb-1">{currentStep.label}</p>
          <p className="text-xs text-muted-foreground mb-4">
            {currentStep.description}
          </p>
          <Link href={`/dashboard/agents/${currentStep.slug}`}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
              {currentStep.slug === "interview" ? "Start Interview" : "Continue"}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
