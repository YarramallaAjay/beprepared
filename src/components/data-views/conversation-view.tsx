"use client";

import { useRef, useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import type { DataViewPayloads } from "@/lib/agents/types";

interface ConversationViewProps {
  data: DataViewPayloads["conversation"];
  onAction?: (actionId: string, params?: Record<string, unknown>) => void;
}

export function ConversationView({ data, onAction }: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data.messages.length]);

  // Reset selecting when messages change
  useEffect(() => {
    setSelecting(false);
  }, [data.messages.length]);

  function handleOptionSelect(questionId: string, label: string) {
    if (!onAction || selecting) return;
    setSelecting(true);
    onAction("select_option", { questionId, answer: label });
  }

  const assistantMessages = data.messages.filter(
    (m) => m.role === "assistant" && m.metadata?.type !== "analysis"
  );
  const answered = data.messages.filter((m) => m.role === "user").length;
  const total = assistantMessages.length;
  const progress = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      {data.interactive !== false && total > 0 && (
        <div className="flex items-center gap-3 px-1">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {answered}/{total}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        {data.messages.map((msg) => (
          <div key={msg.id}>
            {/* Category chip for assistant questions */}
            {msg.role === "assistant" && !!msg.metadata?.category && (
              <div className="mb-1.5 pl-1">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
                  {String(msg.metadata.category)}
                </span>
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-600 text-white rounded-2xl rounded-br-md"
                    : msg.metadata?.type === "analysis"
                      ? "bg-emerald-950/40 border border-emerald-500/20 text-gray-100 rounded-2xl"
                      : "bg-zinc-800/80 text-gray-100 rounded-2xl rounded-bl-md"
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {renderFormattedContent(msg.content)}
                </div>
              </div>
            </div>

            {/* Structured option buttons */}
            {msg.options && msg.options.length > 0 && onAction && (
              <div className="mt-3 space-y-2 sm:pl-2">
                {msg.options.map((option, i) => (
                  <button
                    key={`${option.id}-${i}`}
                    onClick={() => handleOptionSelect(option.id, option.label)}
                    disabled={selecting}
                    className={`w-full text-left rounded-xl border border-zinc-700/60
                      px-4 py-3 transition-all duration-150
                      ${
                        selecting
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:border-emerald-500/60 hover:bg-emerald-500/5 active:scale-[0.98] cursor-pointer"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-700/50 flex items-center justify-center text-xs font-mono text-emerald-400 mt-0.5">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100">
                          {option.label}
                        </p>
                        {option.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {selecting && (
          <div className="flex justify-start">
            <div className="bg-zinc-800/80 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input placeholder hint */}
      {data.input_placeholder && data.interactive !== false && (
        <p className="text-xs text-muted-foreground text-center">
          {data.input_placeholder}
        </p>
      )}
    </div>
  );
}

/** Render basic **bold** and _italic_ formatting */
function renderFormattedContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-gray-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <em key={i} className="text-zinc-400 not-italic text-xs">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
