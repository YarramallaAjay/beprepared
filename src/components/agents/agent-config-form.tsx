"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgentConfigField } from "@/lib/agents/types";

interface AgentConfigFormProps {
  fields: AgentConfigField[];
  values: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => void;
  loading?: boolean;
}

export function AgentConfigForm({ fields, values, onSave, loading }: AgentConfigFormProps) {
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of fields) {
      initial[field.key] = values[field.key] ?? field.default ?? "";
    }
    return initial;
  });

  const handleChange = (key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formValues);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>

          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}

          {field.type === "string" && (
            <Input
              id={field.key}
              value={String(formValues[field.key] || "")}
              onChange={(e) => handleChange(field.key, e.target.value)}
              required={field.required}
            />
          )}

          {field.type === "number" && (
            <Input
              id={field.key}
              type="number"
              value={String(formValues[field.key] || "")}
              onChange={(e) => handleChange(field.key, Number(e.target.value))}
              min={field.validation?.min}
              max={field.validation?.max}
              required={field.required}
            />
          )}

          {field.type === "boolean" && (
            <div className="flex items-center gap-2">
              <input
                id={field.key}
                type="checkbox"
                checked={Boolean(formValues[field.key])}
                onChange={(e) => handleChange(field.key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800"
              />
              <Label htmlFor={field.key} className="text-sm font-normal">
                {formValues[field.key] ? "Enabled" : "Disabled"}
              </Label>
            </div>
          )}

          {field.type === "select" && field.options && (
            <select
              id={field.key}
              value={String(formValues[field.key] || "")}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {field.type === "text" && (
            <textarea
              id={field.key}
              value={String(formValues[field.key] || "")}
              onChange={(e) => handleChange(field.key, e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            />
          )}
        </div>
      ))}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving..." : "Save Configuration"}
      </Button>
    </form>
  );
}
