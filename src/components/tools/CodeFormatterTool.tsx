"use client";

import React, { useState } from "react";
import {
  Terminal,
  Braces,
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { usePool, type ModelRef } from "@/components/PoolContext";
import { PROVIDERS } from "@/lib/ai-pool";

export default function CodeFormatterTool() {
  const { allModels, roles, buildCandidates } = usePool();

  const [tab, setTab] = useState<"ai-coder" | "formatter">("ai-coder");

  // Offline formatter state (No AI)
  const [rawInput, setRawInput] = useState(
    '{"project":"AI Workspace","stack":["Next.js","FreeLLM Pool"],"features":{"qr":true,"failover":true}}'
  );
  const [formattedOutput, setFormattedOutput] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // AI Coder state (Claude Code style)
  const [aiTask, setAiTask] = useState<"review" | "generate" | "explain">(
    "review"
  );
  const [codePrompt, setCodePrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("auto");
  const [aiResponse, setAiResponse] = useState("");
  const [aiMeta, setAiMeta] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const coderModels = allModels.filter((m) =>
    m.tags.includes("reasoning-code")
  );
  const selectable = coderModels.length > 0 ? coderModels : allModels;

  function runLocalTransform(
    action: "pretty-json" | "minify-json" | "b64-encode" | "b64-decode" | "jwt"
  ) {
    setFormatError(null);
    try {
      if (action === "pretty-json") {
        setFormattedOutput(JSON.stringify(JSON.parse(rawInput), null, 2));
      } else if (action === "minify-json") {
        setFormattedOutput(JSON.stringify(JSON.parse(rawInput)));
      } else if (action === "b64-encode") {
        const bytes = new TextEncoder().encode(rawInput);
        let bin = "";
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        setFormattedOutput(btoa(bin));
      } else if (action === "b64-decode") {
        const bin = atob(rawInput.trim());
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        setFormattedOutput(new TextDecoder().decode(bytes));
      } else if (action === "jwt") {
        const parts = rawInput.trim().split(".");
        if (parts.length < 2)
          throw new Error("JWT غير صالح (يجب أن يحتوي على مقطعين على الأقل)");
        const decodePart = (p: string) => {
          const pad = p.replace(/-/g, "+").replace(/_/g, "/");
          return JSON.parse(atob(pad));
        };
        setFormattedOutput(
          JSON.stringify(
            { header: decodePart(parts[0]), payload: decodePart(parts[1]) },
            null,
            2
          )
        );
      }
    } catch (err) {
      setFormatError(
        err instanceof Error ? err.message : "تنسيق الإدخال غير صالح"
      );
    }
  }

  async function handleRunAiCoder() {
    if (!codePrompt.trim() || aiLoading) return;
    setAiError(null);
    setAiResponse("");
    setAiMeta("");

    const override: ModelRef | undefined =
      selectedModel === "auto"
        ? undefined
        : (() => {
            const [provider, ...rest] = selectedModel.split(":");
            return {
              provider: provider as ModelRef["provider"],
              model: rest.join(":"),
            };
          })();

    const candidates = buildCandidates("coder", override);
    if (candidates.length === 0) {
      setAiError("أضف مفتاح API واسحب الموديلات من قسم الموديلات والمفاتيح.");
      return;
    }

    const systemPrompts: Record<typeof aiTask, string> = {
      generate:
        "You are an expert software architect (Claude Code style). Write clean, production-ready code with concise explanation in the user's language.",
      review:
        "You are a senior security & code reviewer. Identify bugs, security risks, edge cases, and performance improvements with concrete fixes.",
      explain:
        "Explain how the provided code works step by step, clearly and concisely.",
    };

    setAiLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates,
          stream: false,
          temperature: 0.3,
          max_tokens: 4096,
          messages: [
            { role: "system", content: systemPrompts[aiTask] },
            { role: "user", content: codePrompt },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setAiResponse(data.content || "");
      setAiMeta(
        `${PROVIDERS[data.provider as keyof typeof PROVIDERS]?.name ?? data.provider} · ${data.model}`
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "فشل طلب البرمجة");
    } finally {
      setAiLoading(false);
    }
  }

  function copyOutput() {
    if (!formattedOutput) return;
    navigator.clipboard.writeText(formattedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("ai-coder")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
              tab === "ai-coder"
                ? "bg-[#d97757] text-white"
                : "bg-[#16161d] text-zinc-300 hover:bg-[#1e1e27]"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            مهندس ومراجع الأكواد (Claude Code Style)
          </button>
          <button
            onClick={() => setTab("formatter")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition ${
              tab === "formatter"
                ? "bg-[#d97757] text-white"
                : "bg-[#16161d] text-zinc-300 hover:bg-[#1e1e27]"
            }`}
          >
            <Braces className="h-3.5 w-3.5" />
            أدوات البيانات الفورية (بدون AI)
          </button>
        </div>
      </div>

      {tab === "formatter" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#121217]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-5">
            <label className="block text-xs font-medium text-zinc-300">
              النص / JSON / Base64 / JWT
            </label>
            <textarea
              rows={12}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-white/10 bg-[#0b0b0e] p-3 font-mono text-xs text-zinc-100 focus:border-[#d97757]/60 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => runLocalTransform("pretty-json")}
                className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-zinc-200"
              >
                تنسيق JSON
              </button>
              <button
                onClick={() => runLocalTransform("minify-json")}
                className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.14]"
              >
                ضغط JSON
              </button>
              <button
                onClick={() => runLocalTransform("b64-encode")}
                className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.14]"
              >
                تشفير Base64
              </button>
              <button
                onClick={() => runLocalTransform("b64-decode")}
                className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.14]"
              >
                فك Base64
              </button>
              <button
                onClick={() => runLocalTransform("jwt")}
                className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.14]"
              >
                فك JWT
              </button>
            </div>
            {formatError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                {formatError}
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-3 rounded-2xl border border-white/[0.08] bg-[#121217]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                النتيجة الفورية
              </span>
              {formattedOutput && (
                <button
                  onClick={copyOutput}
                  className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/[0.08]"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "تم النسخ" : "نسخ"}
                </button>
              )}
            </div>
            <pre
              dir="ltr"
              className="min-h-[300px] flex-1 overflow-auto rounded-xl border border-white/10 bg-[#0b0b0e] p-4 font-mono text-xs text-emerald-300"
            >
              {formattedOutput || "// اختر عملية من الأزرار لعرض النتيجة فوراً"}
            </pre>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#121217]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {(
                  [
                    ["review", "مراجعة وثغرات"],
                    ["generate", "كتابة كود"],
                    ["explain", "شرح كود"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setAiTask(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      aiTask === id
                        ? "bg-[#d97757] text-white"
                        : "bg-[#0b0b0e] text-zinc-300 hover:bg-white/[0.08]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="max-w-[220px] rounded-full border border-white/10 bg-[#0b0b0e] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                <option value="auto">
                  تلقائي ({roles.coder?.model || "Auto"})
                </option>
                {selectable.map((m) => (
                  <option
                    key={`${m.provider}:${m.id}`}
                    value={`${m.provider}:${m.id}`}
                  >
                    {m.id}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={12}
              value={codePrompt}
              onChange={(e) => setCodePrompt(e.target.value)}
              placeholder="الصق الكود للمراجعة أو اكتب وصف الميزة البرمجية المطلوبة..."
              className="w-full rounded-xl border border-white/10 bg-[#0b0b0e] p-3.5 font-mono text-xs leading-6 text-zinc-100 placeholder:text-zinc-500 focus:border-[#d97757]/60 focus:outline-none"
            />

            <button
              onClick={handleRunAiCoder}
              disabled={aiLoading || !codePrompt.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-l from-[#d97757] to-[#e48667] py-2.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              تنفيذ المهمة البرمجية
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#121217]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                المخرجات والمراجعة
              </span>
              {aiMeta && (
                <span
                  className="rounded-full bg-[#0b0b0e] px-2.5 py-0.5 font-mono text-[11px] text-[#e69274]"
                  dir="ltr"
                >
                  {aiMeta}
                </span>
              )}
            </div>

            {aiError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            <div className="min-h-[340px] flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0b0b0e] p-4 text-xs leading-6 text-zinc-200">
              {aiResponse ||
                (aiLoading
                  ? "جاري تحليل الكود..."
                  : "ستظهر المراجعة أو الكود المقترح هنا.")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
