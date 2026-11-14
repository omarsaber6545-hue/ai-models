"use client";

import React, { memo, useState } from "react";
import { Check, Copy } from "lucide-react";

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      dir="ltr"
      className="my-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0d0d] text-left"
    >
      <div className="flex items-center justify-between bg-[#1a1a1a] px-3.5 py-1.5 text-[11px] text-zinc-400">
        <span className="font-mono">{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[13px] leading-6 text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          dir="ltr"
          className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-zinc-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderTextBlock(block: string, keyPrefix: string) {
  const lines = block.split("\n");
  return (
    <div key={keyPrefix} className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1.5" />;
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={i} className="pt-2 text-base font-semibold text-white">
              {renderInline(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-2 text-lg font-semibold text-white">
              {renderInline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={i} className="pt-2 text-xl font-bold text-white">
              {renderInline(trimmed.slice(2))}
            </h1>
          );
        }
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={i} className="flex items-start gap-2.5 pr-1">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
              <div className="min-w-0 flex-1 leading-7">
                {renderInline(trimmed.replace(/^[-*]\s+/, ""))}
              </div>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex items-start gap-2 pr-1">
                <span className="shrink-0 font-medium text-zinc-300">
                  {match[1]}
                </span>
                <div className="min-w-0 flex-1 leading-7">
                  {renderInline(match[2])}
                </div>
              </div>
            );
          }
        }
        return (
          <p key={i} className="leading-7 text-[#ececec]">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

const MarkdownMessage = memo(function MarkdownMessage({
  content,
}: {
  content: string;
}) {
  if (!content) return null;

  const segments: Array<
    | { type: "text"; value: string }
    | { type: "code"; lang: string; value: string }
  > = [];

  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: content.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: "code",
      lang: match[1] || "",
      value: match[2].replace(/\n$/, ""),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return (
    <div className="text-[15px] leading-7 text-[#ececec]">
      {segments.map((seg, idx) =>
        seg.type === "code" ? (
          <CodeBlock key={idx} lang={seg.lang} code={seg.value} />
        ) : (
          renderTextBlock(seg.value, `t-${idx}`)
        )
      )}
    </div>
  );
});

export default MarkdownMessage;
