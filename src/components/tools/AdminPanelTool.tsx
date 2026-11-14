"use client";

import React, { useMemo, useState } from "react";
import {
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import { usePool, type ModelRef, type ToolRole } from "@/components/PoolContext";
import { PROVIDER_LIST, type ModelTag, type ProviderId } from "@/lib/ai-pool";

const ROLE_LABELS: Array<{ key: ToolRole; title: string; hint: string }> = [
  {
    key: "fastChat",
    title: "الشات السريع (Fast Chat)",
    hint: "للردود الفورية وتحليل QR",
  },
  {
    key: "vision",
    title: "محلل الصور (Vision)",
    hint: "لفهم الصور واللقطات",
  },
  {
    key: "ocr",
    title: "قراءة المستندات (OCR / Parse)",
    hint: "لاستخراج النصوص والجداول",
  },
  {
    key: "coder",
    title: "مهندس الكود (Coder)",
    hint: "للكتابة والمراجعة الأمنية",
  },
  {
    key: "councilJudge",
    title: "حكم مجلس الخبراء (Judge)",
    hint: "لمقارنة الإجابات وإصدار الخلاصة",
  },
];

const TAG_FILTERS: Array<{ id: "all" | ModelTag; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "fast", label: "سريع" },
  { id: "vision", label: "صور" },
  { id: "ocr", label: "OCR" },
  { id: "reasoning-code", label: "برمجة واستدلال" },
  { id: "chat", label: "عام" },
];

export default function AdminPanelTool() {
  const {
    keys,
    modelsByProvider,
    allModels,
    roles,
    councilMembers,
    serverStatus,
    setProviderKey,
    setProviderModels,
    setRoleModel,
    toggleCouncilMember,
    clearAllLocal,
  } = usePool();

  const [revealed, setRevealed] = useState<Partial<Record<ProviderId, boolean>>>(
    {}
  );
  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(
    null
  );
  const [statusMsg, setStatusMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<"all" | ModelTag>("all");

  async function handleDiscover(provider: ProviderId) {
    setLoadingProvider(provider);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/models/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: keys[provider] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setProviderModels(provider, data.models);
      setStatusMsg({
        type: "ok",
        text: `تم سحب وتصنيف ${data.count} موديل من ${provider.toUpperCase()} بنجاح.`,
      });
    } catch (err) {
      setStatusMsg({
        type: "err",
        text: err instanceof Error ? err.message : "فشل سحب الموديلات",
      });
    } finally {
      setLoadingProvider(null);
    }
  }

  const filteredModels = useMemo(() => {
    return allModels.filter((m) => {
      const matchTag = tagFilter === "all" || m.tags.includes(tagFilter);
      const matchText =
        !search.trim() ||
        m.id.toLowerCase().includes(search.trim().toLowerCase());
      return matchTag && matchText;
    });
  }, [allModels, tagFilter, search]);

  function encodeRef(ref?: ModelRef) {
    return ref ? `${ref.provider}:${ref.model}` : "";
  }

  function decodeRef(val: string): ModelRef | undefined {
    if (!val) return undefined;
    const [provider, ...rest] = val.split(":");
    return { provider: provider as ProviderId, model: rest.join(":") };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#2a2a2a]/60 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#d97757]" />
            إدارة المفاتيح والموديلات (FreeLLM Pool)
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            الصق مفتاح أي منصة واضغط &quot;سحب&quot; لاكتشاف كل الموديلات
            وتصنيفها تلقائياً.
          </p>
        </div>

        <button
          onClick={clearAllLocal}
          className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          مسح المفاتيح المحلية
        </button>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs ${
            statusMsg.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {statusMsg.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Providers Grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PROVIDER_LIST.map((p) => {
          const envActive = serverStatus.find((s) => s.id === p.id)?.hasEnvKey;
          const count = modelsByProvider[p.id]?.length ?? 0;
          const isLoading = loadingProvider === p.id;
          const showKey = Boolean(revealed[p.id]);

          return (
            <div
              key={p.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#2a2a2a]/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-[#d97757]" />
                    <span className="text-xs font-semibold text-zinc-100">
                      {p.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-zinc-500" dir="ltr">
                      {p.envVar}
                    </span>
                    {envActive && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                        .env
                      </span>
                    )}
                    {count > 0 && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-zinc-200">
                        {count} موديل
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={p.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#e69274] hover:underline"
                >
                  المفتاح
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={keys[p.id] || ""}
                    onChange={(e) => setProviderKey(p.id, e.target.value)}
                    placeholder={
                      envActive ? "مفتاح السيرفر (.env)" : "الصق API Key"
                    }
                    dir="ltr"
                    className="w-full rounded-xl border border-white/10 bg-[#171717] py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#d97757]/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((prev) => ({ ...prev, [p.id]: !showKey }))
                    }
                    className="absolute left-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <button
                  onClick={() => handleDiscover(p.id)}
                  disabled={isLoading || (!keys[p.id]?.trim() && !envActive)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-[#171717] transition hover:bg-zinc-200 disabled:opacity-35"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                  />
                  سحب
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Assignments */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#2a2a2a]/60 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold text-zinc-100">
          <Cpu className="h-4 w-4 text-[#d97757]" />
          توزيع الأدوار على الموديلات ({allModels.length} موديل متاح)
        </h3>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ROLE_LABELS.map((r) => (
            <div
              key={r.key}
              className="space-y-1.5 rounded-xl border border-white/[0.06] bg-[#171717] p-3"
            >
              <div className="text-xs font-medium text-zinc-200">{r.title}</div>
              <div className="text-[11px] text-zinc-500">{r.hint}</div>
              <select
                value={encodeRef(roles[r.key])}
                onChange={(e) => setRoleModel(r.key, decodeRef(e.target.value))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#242424] px-2.5 py-2 text-xs text-zinc-100 focus:outline-none"
              >
                <option value="">-- اختر موديلاً --</option>
                {allModels.map((m) => (
                  <option
                    key={`${m.provider}:${m.id}`}
                    value={`${m.provider}:${m.id}`}
                  >
                    [{m.provider}] {m.id}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Discovered Models Catalog */}
      {allModels.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#2a2a2a]/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-zinc-100">
              كتالوج الموديلات المكتشفة (أعضاء مجلس الخبراء حتى 5)
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم الموديل..."
                className="rounded-full border border-white/10 bg-[#171717] px-3.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {TAG_FILTERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTagFilter(t.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      tagFilter === t.id
                        ? "bg-white text-[#171717]"
                        : "bg-[#171717] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredModels.map((m) => {
              const checked = councilMembers.some(
                (c) => c.provider === m.provider && c.model === m.id
              );
              return (
                <label
                  key={`${m.provider}:${m.id}`}
                  className={`flex cursor-pointer items-start justify-between gap-2 rounded-xl border p-3 text-xs transition ${
                    checked
                      ? "border-[#d97757]/60 bg-[#d97757]/10"
                      : "border-white/[0.06] bg-[#171717] hover:border-white/15"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate font-mono font-medium text-zinc-100"
                      dir="ltr"
                      title={m.id}
                    >
                      {m.id}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-zinc-300">
                        {m.provider}
                      </span>
                      {m.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-[#d97757]/15 px-1.5 py-0.5 text-[10px] text-[#e69274]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      toggleCouncilMember({ provider: m.provider, model: m.id })
                    }
                    className="mt-1 rounded border-zinc-600 bg-zinc-900"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
