import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="max-w-2xl text-center px-6">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Be<span className="text-emerald-400">Prepared</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Stop scrolling. Start preparing.
        </p>
        <p className="text-muted-foreground/70 mb-10 max-w-lg mx-auto">
          AI-powered job switch preparation that interviews you, curates
          personalized content, and keeps you on track with daily reminders.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8">
              Get Started
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="px-8">
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-5 rounded-xl bg-card border border-border">
            <h3 className="font-semibold text-emerald-400 mb-2">Smart Interview</h3>
            <p className="text-sm text-muted-foreground">
              Scenario-based questions that help you discover your path, not
              just pick from a list.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <h3 className="font-semibold text-emerald-400 mb-2">AI Curation</h3>
            <p className="text-sm text-muted-foreground">
              Personalized blogs, videos, courses from your preferred sources
              and people you follow.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <h3 className="font-semibold text-emerald-400 mb-2">Daily Reminders</h3>
            <p className="text-sm text-muted-foreground">
              WhatsApp reminders with your daily plan. Reply to mark tasks
              done, skip, or check progress.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
