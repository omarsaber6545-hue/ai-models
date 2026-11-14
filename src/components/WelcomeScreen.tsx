"use client";

import React from "react";
import { ArrowUp, Github, Plus, Sparkles } from "lucide-react";

interface WelcomeScreenProps {
  onGitHubLogin: () => void;
}

const QUICK_CHIPS = [
  "تلخيص الملفات وPDF",
  "تحليل الصور بالذكاء الاصطناعي",
  "كتابة ومراجعة الكود",
  "مجلس الخبراء متعدد النماذج",
];

export default function WelcomeScreen({ onGitHubLogin }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#212121] text-[#ececec]">
      {/* ChatGPT / Claude style Minimal Header */}
      <header className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-2 text-base font-semibold text-white">
          <Sparkles className="h-4 w-4 text-[#d97757]" />
          <span>AI Workspace</span>
        </div>

        <button
          onClick={onGitHubLogin}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#171717] transition hover:bg-zinc-200"
        >
          <Github className="h-3.5 w-3.5" />
          <span>تسجيل الدخول بـ GitHub</span>
        </button>
      </header>

      {/* Centered ChatGPT / Claude Entry Canvas */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            كيف أقدر أساعدك النهاردة؟
          </h1>
          <p className="mt-2 text-xs text-zinc-400">
            سجّل دخولك لبدء الدردشة، رفع الصور والملفات، وحفظ محادثاتك في حسابك
          </p>
        </div>

        {/* Center Floating Composer Card + Single Primary Button */}
        <div className="w-full rounded-[26px] border border-white/[0.08] bg-[#2f2f2f] p-4 shadow-xl shadow-black/30">
          <button
            type="button"
            onClick={onGitHubLogin}
            className="w-full cursor-text pb-4 text-right text-sm text-zinc-400"
          >
            اسأل أي شيء، أو ارفع صوراً وملفات لتحليلها...
          </button>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onGitHubLogin}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
              title="إرفاق صور أو ملفات"
            >
              <Plus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onGitHubLogin}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-[#171717] transition hover:bg-zinc-200"
            >
              <span>ابدأ دردشة</span>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Clean Suggestion Chips */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {QUICK_CHIPS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={onGitHubLogin}
              className="rounded-full border border-white/[0.09] bg-[#2a2a2a]/70 px-3.5 py-1.5 text-xs text-zinc-300 transition hover:bg-[#333333] hover:text-white"
            >
              {label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
