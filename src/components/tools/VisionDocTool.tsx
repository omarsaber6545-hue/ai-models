"use client";

import React, { useState } from "react";
import {
  FileImage,
  Upload,
  Sparkles,
  Loader2,
  AlertCircle,
  Layers,
} from "lucide-react";
import { usePool, type ModelRef } from "@/components/PoolContext";
import { PROVIDERS } from "@/lib/ai-pool";

async function compressImageToDataUrl(
  file: File,
  maxBytes = 3_200_000
): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (file.size <= maxBytes) return rawUrl;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(rawUrl);
    img.src = rawUrl;
  });
}

export default function VisionDocTool() {
  const { allModels, roles, buildCandidates } = usePool();

  const [imageUrl, setImageUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [prompt, setPrompt] = useState(
    "اشرح محتوى هذه الصورة أو استخرج النصوص والجداول الموجودة فيها بدقة."
  );
  const [useTwoStageOcr, setUseTwoStageOcr] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [loading, setLoading] = useState(false);
  const [ocrExtract, setOcrExtract] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [meta, setMeta] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const visionModels = allModels.filter(
    (m) => m.tags.includes("vision") || m.tags.includes("ocr")
  );
  const selectable = visionModels.length > 0 ? visionModels : allModels;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const compressed = await compressImageToDataUrl(file);
    setImageUrl(compressed);
  }

  async function handleAnalyze() {
    if (!imageUrl || loading) return;
    setError(null);
    setAnswer("");
    setOcrExtract("");
    setMeta("");
    setLoading(true);

    try {
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

      let extractedText = "";

      if (useTwoStageOcr) {
        const ocrCandidates = buildCandidates("ocr");
        if (ocrCandidates.length > 0) {
          const ocrRes = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              candidates: ocrCandidates,
              stream: false,
              max_tokens: 4096,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Extract all text, tables, and structured content from this document image in Markdown.",
                    },
                    { type: "image_url", image_url: { url: imageUrl } },
                  ],
                },
              ],
            }),
          });
          if (ocrRes.ok) {
            const ocrJson = await ocrRes.json();
            extractedText = ocrJson.content || "";
            setOcrExtract(extractedText);
          }
        }
      }

      const visionCandidates = buildCandidates("vision", override);
      if (visionCandidates.length === 0) {
        throw new Error(
          "أضف مفتاح API واسحب الموديلات من قسم الموديلات والمفاتيح."
        );
      }

      const messages = extractedText
        ? [
            {
              role: "user",
              content: `${prompt}\n\n--- المستند المستخرج (OCR) ---\n${extractedText}`,
            },
          ]
        : [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: visionCandidates,
          stream: false,
          max_tokens: 4096,
          messages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setAnswer(data.content || "");
      setMeta(
        `${PROVIDERS[data.provider as keyof typeof PROVIDERS]?.name ?? data.provider} · ${data.model}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحليل الصورة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#2a2a2a]/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileImage className="h-4 w-4 text-[#d97757]" />
            رفع الصورة أو المستند
          </h2>
          <span className="rounded-full bg-[#171717] px-2.5 py-0.5 text-[11px] text-zinc-400">
            ضغط تلقائي &lt; 4.5MB
          </span>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#171717]/80 p-6 text-center transition hover:border-[#d97757]/60">
          <Upload className="mb-2 h-6 w-6 text-[#d97757]" />
          <span className="text-xs font-medium text-zinc-200">
            {fileName || "اضغط لاختيار صورة (فاتورة، لقطة شاشة، مستند)"}
          </span>
          <span className="mt-1 text-[11px] text-zinc-500">
            PNG, JPG, WebP
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {imageUrl && (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#171717]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Preview"
              className="max-h-60 w-full object-contain"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs text-zinc-400">الموديل المستخدم</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-2 text-xs text-zinc-200 focus:outline-none"
          >
            <option value="auto">
              تلقائي ({roles.vision?.model || "Auto"})
            </option>
            {selectable.map((m) => (
              <option
                key={`${m.provider}:${m.id}`}
                value={`${m.provider}:${m.id}`}
              >
                [{PROVIDERS[m.provider].name}] {m.id}
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-[#171717]/70 px-3 py-2.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={useTwoStageOcr}
            onChange={(e) => setUseTwoStageOcr(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-900"
          />
          <Layers className="h-4 w-4 text-[#d97757]" />
          استخراج OCR أولاً بـ{" "}
          <span dir="ltr" className="font-mono text-[#e69274]">
            {roles.ocr?.model || "nemotron-parse"}
          </span>
        </label>

        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#171717] p-3 text-xs leading-6 text-zinc-100 focus:border-[#d97757]/60 focus:outline-none"
        />

        <button
          onClick={handleAnalyze}
          disabled={!imageUrl || loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-semibold text-[#171717] transition hover:bg-zinc-200 disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          تحليل الصورة والمستند
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#2a2a2a]/60 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-200">نتيجة التحليل</h3>
          {meta && (
            <span
              className="rounded-full bg-[#171717] px-2.5 py-0.5 font-mono text-[11px] text-[#e69274]"
              dir="ltr"
            >
              {meta}
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {ocrExtract && (
          <div className="rounded-xl border border-white/10 bg-[#171717] p-3">
            <div className="mb-1 text-[11px] font-semibold text-[#e69274]">
              المرحلة 1 — النص المستخرج (OCR)
            </div>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-300">
              {ocrExtract}
            </pre>
          </div>
        )}

        <div className="min-h-[280px] flex-1 whitespace-pre-wrap rounded-xl border border-white/10 bg-[#171717] p-4 text-sm leading-7 text-zinc-200">
          {answer ||
            (loading
              ? "جاري تحليل الصورة..."
              : "ستظهر نتيجة التحليل والاستخراج هنا.")}
        </div>
      </div>
    </div>
  );
}
