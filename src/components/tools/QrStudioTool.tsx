"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  QrCode,
  Download,
  ScanLine,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Upload,
} from "lucide-react";
import { usePool } from "@/components/PoolContext";

export default function QrStudioTool() {
  const { buildCandidates } = usePool();

  const [qrInput, setQrInput] = useState("https://vercel.com");
  const [fgColor, setFgColor] = useState("#171717");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");

  const [decodedText, setDecodedText] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!qrInput.trim()) {
      setQrDataUrl("");
      setQrSvg("");
      return;
    }

    QRCode.toDataURL(qrInput, {
      width: 320,
      margin: 2,
      color: { dark: fgColor, light: bgColor },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));

    QRCode.toString(qrInput, {
      type: "svg",
      margin: 2,
      color: { dark: fgColor, light: bgColor },
    })
      .then(setQrSvg)
      .catch(() => setQrSvg(""));
  }, [qrInput, fgColor, bgColor]);

  function downloadPng() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "qr-code.png";
    a.click();
  }

  function downloadSvg() {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReadQrImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    setDecodedText("");
    setAiAnalysis("");

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setScanError("تعذر فتح معالج الصور في المتصفح.");
        URL.revokeObjectURL(objectUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        setDecodedText(code.data);
      } else {
        setScanError("لم يتم العثور على رمز QR واضح في هذه الصورة.");
      }
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      setScanError("ملف الصورة غير صالح.");
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  }

  async function handleAnalyzeDecodedWithAi() {
    if (!decodedText || aiLoading) return;
    const candidates = buildCandidates("fastChat");
    if (candidates.length === 0) {
      setAiAnalysis(
        "أضف مفتاح API من قسم الموديلات والمفاتيح لتفعيل التحليل الذكي."
      );
      return;
    }

    setAiLoading(true);
    setAiAnalysis("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates,
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "أنت محلل أمان ومحتوى لرموز QR. اشرح باختصار بالعربية نوع المحتوى المستخرج من الـ QR، وهل يبدو آمناً أم يحتوي على مؤشرات احتيال أو روابط مشبوهة، وما الإجراء المناسب.",
            },
            { role: "user", content: `محتوى QR:\n${decodedText}` },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setAiAnalysis(data.content || "");
    } catch (err) {
      setAiAnalysis(
        err instanceof Error ? err.message : "تعذر تحليل المحتوى بالـ AI"
      );
    } finally {
      setAiLoading(false);
    }
  }

  function handleCopy() {
    if (!decodedText) return;
    navigator.clipboard.writeText(decodedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* QR Generator */}
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#121217]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <QrCode className="h-4 w-4 text-emerald-400" />
            توليد رمز QR (فوري بدون AI)
          </h2>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] text-emerald-300">
            محلي مجاناً
          </span>
        </div>

        <textarea
          rows={3}
          value={qrInput}
          onChange={(e) => setQrInput(e.target.value)}
          placeholder="اكتب رابطاً أو نصاً أو بيانات WiFi..."
          className="w-full rounded-xl border border-white/10 bg-[#0b0b0e] p-3 text-xs leading-6 text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300">
          <label className="flex items-center gap-2">
            لون الرمز:
            <input
              type="color"
              value={fgColor}
              onChange={(e) => setFgColor(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2">
            لون الخلفية:
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent"
            />
          </label>
        </div>

        {qrDataUrl && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#0b0b0e] p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Generated QR"
              className="h-48 w-48 rounded-xl bg-white p-2"
            />
            <div className="flex gap-2">
              <button
                onClick={downloadPng}
                className="flex items-center gap-1.5 rounded-full bg-[#d97757] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e58868]"
              >
                <Download className="h-3.5 w-3.5" />
                تحميل PNG
              </button>
              <button
                onClick={downloadSvg}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-[#16161d] px-4 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[#1e1e27]"
              >
                <Download className="h-3.5 w-3.5" />
                تحميل SVG
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Reader */}
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#121217]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ScanLine className="h-4 w-4 text-[#d97757]" />
            قارئ QR (محلي + فحص AI اختياري)
          </h2>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#0b0b0e]/85 p-8 text-center transition hover:border-emerald-500/50">
          <Upload className="mb-2 h-6 w-6 text-emerald-400" />
          <span className="text-xs font-medium text-zinc-200">
            ارفع صورة تحتوي على رمز QR لقراءته فوراً
          </span>
          <span className="mt-1 text-[11px] text-zinc-500">
            تتم القراءة داخل المتصفح بدون إرسال الصورة للخارج
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleReadQrImage}
            className="hidden"
          />
        </label>

        {scanError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {scanError}
          </div>
        )}

        {decodedText && (
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#0b0b0e] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                المحتوى المقروء:
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/[0.08]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "تم النسخ" : "نسخ"}
              </button>
            </div>
            <div
              className="break-all rounded-xl bg-[#121217] p-3 font-mono text-xs text-zinc-100"
              dir="ltr"
            >
              {decodedText}
            </div>

            <button
              onClick={handleAnalyzeDecodedWithAi}
              disabled={aiLoading}
              className="flex items-center gap-2 rounded-full bg-[#d97757] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#c86748] disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              تحليل وفحص الأمان بالـ AI
            </button>

            {aiAnalysis && (
              <div className="whitespace-pre-wrap rounded-xl border border-[#d97757]/30 bg-[#d97757]/[0.08] p-3 text-xs leading-6 text-zinc-200">
                {aiAnalysis}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
