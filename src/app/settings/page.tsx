"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface Source {
  id: string;
  source_name: string;
  source_type: string;
  source_url: string;
  priority_rank: number;
}

interface CharacterDoc {
  content_md: string;
  version: number;
  updated_at: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  person: "Person",
  channel: "Channel",
  blog: "Blog",
  platform: "Platform",
  course_platform: "Course Platform",
};

export default function SettingsPage() {
  const supabase = createClient();

  const [sources, setSources] = useState<Source[]>([]);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState("person");
  const [newSourceUrl, setNewSourceUrl] = useState("");

  const [phone, setPhone] = useState("");
  const [morningTime, setMorningTime] = useState("08:00");
  const [eveningTime, setEveningTime] = useState("20:00");
  const [reminderEnabled, setReminderEnabled] = useState(false);

  const [character, setCharacter] = useState<CharacterDoc | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [socialProfiles, setSocialProfiles] = useState<
    { platform: string; username_or_url: string; last_synced_at: string }[]
  >([]);

  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const sourcesRes = await fetch("/api/sources");
    const sourcesData = await sourcesRes.json();
    setSources(sourcesData.sources || []);

    const { data: reminder } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .eq("channel", "whatsapp")
      .single();
    if (reminder) {
      setPhone(reminder.phone_number || "");
      setMorningTime(reminder.morning_time || "08:00");
      setEveningTime(reminder.evening_time || "20:00");
      setReminderEnabled(reminder.enabled);
    }

    const charRes = await fetch("/api/character");
    const charData = await charRes.json();
    setCharacter(charData.character);

    const { data: socials } = await supabase
      .from("social_profiles")
      .select("platform, username_or_url, last_synced_at")
      .eq("user_id", user.id);
    setSocialProfiles(socials || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function addSource() {
    if (!newSourceName.trim()) return;
    await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_name: newSourceName,
        source_type: newSourceType,
        source_url: newSourceUrl || undefined,
      }),
    });
    setNewSourceName("");
    setNewSourceUrl("");
    fetchData();
  }

  async function removeSource(id: string) {
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  async function saveReminders() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("reminders").upsert(
      {
        user_id: user.id,
        channel: "whatsapp",
        phone_number: phone,
        morning_time: morningTime,
        evening_time: eveningTime,
        enabled: reminderEnabled,
      },
      { onConflict: "user_id,channel" }
    );
  }

  async function syncCharacter() {
    setSyncing(true);
    const res = await fetch("/api/character/sync", { method: "POST" });
    const data = await res.json();
    if (data.character) {
      setCharacter({
        content_md: data.character,
        version: (character?.version || 0) + 1,
        updated_at: new Date().toISOString(),
      });
    }
    setSyncing(false);
  }

  async function reCurate() {
    await fetch("/api/curate", { method: "POST" });
    alert("Content re-curated! Check your dashboard.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">Settings</h1>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Source Manager */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Content Sources</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage your preferred sources. Content from these is prioritized during curation.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {sources.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">#{idx + 1}</span>
                    <span className="text-sm text-foreground">{s.source_name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {SOURCE_TYPE_LABELS[s.source_type] || s.source_type}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => removeSource(s.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {sources.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No sources added yet.</p>
              )}
            </div>

            <Separator />

            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[140px] space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="e.g., Arpit Bhayani"
                  className="text-sm"
                />
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={newSourceType} onValueChange={(v) => v && setNewSourceType(v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="channel">Channel</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="platform">Platform</SelectItem>
                    <SelectItem value="course_platform">Course Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[140px] space-y-1">
                <Label className="text-xs">URL (optional)</Label>
                <Input
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={addSource}>
                Add
              </Button>
            </div>

            <Button variant="outline" className="w-full" onClick={reCurate}>
              Re-curate Content with Updated Sources
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Morning Reminder</Label>
                <Input
                  type="time"
                  value={morningTime}
                  onChange={(e) => setMorningTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Evening Check-in</Label>
                <Input
                  type="time"
                  value={eveningTime}
                  onChange={(e) => setEveningTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReminderEnabled(!reminderEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  reminderEnabled ? "bg-emerald-600" : "bg-muted"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${
                    reminderEnabled ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-foreground">
                {reminderEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveReminders}>
              Save Reminder Settings
            </Button>
          </CardContent>
        </Card>

        {/* Character Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Character Profile</CardTitle>
              <Button variant="outline" size="sm" onClick={syncCharacter} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-generated profile based on your social data and interview answers.
              {character ? ` Version ${character.version}.` : ""}
            </p>
          </CardHeader>
          <CardContent>
            {character ? (
              <div className="rounded-lg bg-muted/30 border border-border p-4 whitespace-pre-wrap text-sm text-foreground/90 font-mono leading-relaxed max-h-96 overflow-y-auto">
                {character.content_md}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No character profile yet. Connect social profiles and complete onboarding.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Re-take Interview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interview & Roadmap</CardTitle>
            <p className="text-sm text-muted-foreground">
              Re-take the interview to refresh your character profile, content curation, and learning roadmap.
            </p>
          </CardHeader>
          <CardContent>
            <Link href="/onboarding">
              <Button variant="outline" className="w-full">
                Re-take Interview
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Social Profiles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Connected Profiles</CardTitle>
              <Link href="/onboarding/connect">
                <Button variant="outline" size="sm">
                  {socialProfiles.length > 0 ? "Edit" : "Connect"}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {socialProfiles.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No profiles connected. Social profiles help build a richer character profile.
              </p>
            ) : (
              <div className="space-y-2">
                {socialProfiles.map((sp) => (
                  <div
                    key={sp.platform}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {sp.platform}
                      </Badge>
                      <span className="text-sm text-foreground">{sp.username_or_url}</span>
                    </div>
                    {sp.last_synced_at && (
                      <span className="text-xs text-muted-foreground">
                        Synced {new Date(sp.last_synced_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
