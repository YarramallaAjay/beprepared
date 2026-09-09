"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLATFORMS = [
  { platform: "github", label: "GitHub", placeholder: "username", icon: "GH" },
  {
    platform: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/yourname",
    icon: "LI",
  },
  {
    platform: "reddit",
    label: "Reddit",
    placeholder: "username (without u/)",
    icon: "RD",
  },
  {
    platform: "twitter",
    label: "X / Twitter",
    placeholder: "@handle",
    icon: "X",
  },
];

export default function ConnectPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Load existing social profiles on mount
  const loadExisting = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setChecking(false);
      return;
    }

    // Check onboarding status
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile?.onboarding_completed) {
      setIsOnboarded(true);
    }

    // Load existing social profiles
    const { data: existing } = await supabase
      .from("social_profiles")
      .select("platform, username_or_url")
      .eq("user_id", user.id);

    if (existing && existing.length > 0) {
      setHasExisting(true);
      const map: Record<string, string> = {};
      for (const sp of existing) {
        map[sp.platform] = sp.username_or_url;
      }
      setProfiles(map);
    }
    setChecking(false);
  }, [supabase]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  function updateProfile(platform: string, value: string) {
    setProfiles((prev) => ({ ...prev, [platform]: value }));
  }

  async function handleSave() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const entries = Object.entries(profiles).filter(([, v]) => v.trim());
    if (entries.length === 0) {
      router.push("/onboarding");
      return;
    }

    const inserts = entries.map(([platform, username_or_url]) => ({
      user_id: user.id,
      platform,
      username_or_url: username_or_url.trim(),
    }));

    const { error: dbError } = await supabase
      .from("social_profiles")
      .upsert(inserts, { onConflict: "user_id,platform" });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    setSyncing(true);
    try {
      await fetch("/api/character/sync", { method: "POST" });
    } catch {
      // best-effort
    }
    setSyncing(false);
    setLoading(false);
    router.push("/onboarding");
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400" />
      </main>
    );
  }

  const linkedCount = Object.values(profiles).filter((v) => v.trim()).length;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {hasExisting ? "Update Your Profiles" : "Connect Your Profiles"}
            </CardTitle>
            <Badge variant="secondary">Step 1 of 2</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {hasExisting
              ? "Update or add social profiles. Changes will refresh your character profile."
              : "Link your social profiles so we can understand your technical background. This is optional but highly recommended."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {PLATFORMS.map((p) => (
            <div key={p.platform} className="space-y-1">
              <Label className="text-sm flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-muted text-xs flex items-center justify-center font-mono text-muted-foreground">
                  {p.icon}
                </span>
                {p.label}
              </Label>
              <Input
                value={profiles[p.platform] || ""}
                onChange={(e) => updateProfile(p.platform, e.target.value)}
                placeholder={p.placeholder}
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() =>
                router.push(isOnboarded ? "/dashboard" : "/onboarding")
              }
            >
              {isOnboarded ? "Back to Dashboard" : "Skip for now"}
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSave}
              disabled={loading}
            >
              {syncing
                ? "Analyzing profiles..."
                : loading
                  ? "Saving..."
                  : linkedCount > 0
                    ? `${hasExisting ? "Update" : "Connect"} ${linkedCount} profile${linkedCount > 1 ? "s" : ""}`
                    : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
