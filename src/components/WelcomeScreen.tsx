"use client";

import React from "react";
import {
  ArrowUpLeft,
  Cpu,
  Database,
  FileImage,
  Github,
  Lock,
  Sparkles,
} from "lucide-react";

interface WelcomeScreenProps {
  onGitHubLogin: () => void;
}

const CAPABILITIES = [
  {
    icon: Cpu,
    title: "محادثة ومجلس خبراء",
    desc: "ردود فورية أو مقارنة آراء عدة نماذج في إجابة واحدة منظمة.",
  },
  {
    icon: FileImage,
    title: "رفع الصور والملفات",
    desc: "اسحب الصور، الكود، وملفات PDF والنصوص لتحليلها مباشرة.",
  },
  {
    icon: Database,
    title: "سجل محادثات محفوظ",
    desc: "كل محادثاتك ومرفقاتك تُحفظ تلقائياً وترتبط بحسابك.",
  },
];

export default function WelcomeScreen({ onGitHubLogin }: WelcomeScreenProps) {
  return (
    <div className="bg-obsidian-grid relative flex min-h-screen flex-col overflow-hidden bg-[#09090b] text-[#f4f4f5]">
      {/* Top Minimal Brand Bar */}
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d97757]/35 bg-[#d97757]/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Sparkles className="h-4 w-4 text-[#e58b6c]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            AI Workspace
          </span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#121217]/80 px-3 py-1 text-[11px] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>جاهز للعمل</span>
        </div>
      </header>

      {/* Main Centered Studio Hero */}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-16 pt-6">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d97757]/25 bg-[#d97757]/10 px-3.5 py-1 text-xs font-medium text-[#f0a58b]">
          <span>بيئة عمل متكاملة للذكاء الاصطناعي</span>
        </div>

        <h1 className="text-center text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl sm:leading-[1.18]">
          كل أدوات الذكاء الاصطناعي
          <span className="block bg-gradient-to-l from-[#e9967a] via-[#d97757] to-[#f4f4f5] bg-clip-text text-transparent">
            في مساحة واحدة مرتبة
          </span>
        </h1>

        <p className="mt-4 max-w-xl text-center text-sm leading-7 text-zinc-400 sm:text-base">
          دردش مع النماذج، ارفع صوراً وملفات، واستخدم أدوات الكود والمستندات من
          واجهة سريعة ومحفوظة لحسابك.
        </p>

        {/* Minimal 3-Column Capability Cards */}
        <div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
          {CAPABILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="studio-card group rounded-2xl p-4 transition duration-200 hover:border-white/[0.15] hover:bg-[#16161d]"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0b0b0e] text-[#e58b6c] transition group-hover:border-[#d97757]/35">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {item.title}
                </h2>
                <p className="mt-1.5 text-xs leading-6 text-zinc-400">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Single Primary Action Dock */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-[#121217]/90 px-4 py-2.5 text-xs text-zinc-300 shadow-lg shadow-black/30">
            <Lock className="h-3.5 w-3.5 text-[#d97757]" />
            <span>جلسة مشفّرة ومحمية بـ GitHub OAuth</span>
          </div>

          <button
            type="button"
            onClick={onGitHubLogin}
            className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-l from-[#d97757] to-[#e48667] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_28px_-6px_rgba(217,119,87,0.55)] transition hover:brightness-110 active:scale-[0.99]"
          >
            <Github className="h-4 w-4" />
            <span>ابدأ دردشة</span>
            <ArrowUpLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </main>
    </div>
  );
}
