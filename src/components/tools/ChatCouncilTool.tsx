"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpLeft,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Plus,
  FileText,
  X,
  Sparkles,
  Scale,
  Square,
  ChevronDown,
} from "lucide-react";
import { usePool, type ModelRef } from "@/components/PoolContext";
import { PROVIDERS } from "@/lib/ai-pool";
import type { ChatAttachment } from "@/lib/db";
import MarkdownMessage from "@/components/MarkdownMessage";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
  attachments?: ChatAttachment[];
}

interface CouncilMemberOut {
  provider: string;
  model: string;
  ok: boolean;
  content: string;
  latencyMs: number;
  error?: string;
}

interface CouncilVerdict {
  provider: string;
  model: string;
  content: string;
  error?: string;
}

const SYSTEM_INSTRUCTION =
  "أجب بشكل مباشر وواضح ومختصر بلغة المستخدم. يُمنع منعاً باتاً استخدام أي إيموجي (emojis) أو رموز تعبيرية في الردود.";

const STARTER_PROMPTS = [
  "اقترح معمارية واضحة لتطبيق ويب متكامل",
  "لخص الملف أو الصورة التي سأرفقها الآن",
  "راجع هذا الكود واكتشف الأخطاء المنطقية",
  "اشرح الفرق بين الشات السريع ومجلس الخبراء",
];

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "tsv",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "html",
  "htm",
  "css",
  "scss",
  "sql",
  "xml",
  "yaml",
  "yml",
  "log",
  "env",
  "sh",
  "bat",
  "ps1",
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImageFile(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("فشل قراءة الصورة"));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/gif" && file.size < 800 * 1024) {
    return rawDataUrl;
  }

  return await new Promise<string>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const maxDim = 1280;
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && file.size <= 350 * 1024) {
        resolve(rawDataUrl);
        return;
      }
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

function extractReadablePdfText(buffer: ArrayBuffer): string {
  const raw = new TextDecoder("latin1").decode(buffer);
  const matches = raw.match(/\(([^()\\]{2,200})\)/g) ?? [];
  const extracted = matches
    .map((m) => m.slice(1, -1))
    .filter((s) => /[a-zA-Z0-9\u0600-\u06FF]/.test(s))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (extracted.length > 40) {
    return extracted.slice(0, 18000);
  }
  return "[ملف PDF مرفق — إذا كان مصوراً، ارفع لقطة شاشة للصفحة أو استخدم أداة الصور]";
}

async function processUploadedFile(file: File): Promise<ChatAttachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (file.type.startsWith("image/")) {
    const dataUrl = await compressImageFile(file);
    return {
      id,
      name: file.name || "image.png",
      kind: "image",
      mimeType: file.type || "image/jpeg",
      size: file.size,
      dataUrl,
    };
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  let textContent = "";

  if (ext === "pdf" || file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    textContent = extractReadablePdfText(buf);
  } else if (
    TEXT_EXTENSIONS.has(ext) ||
    file.type.startsWith("text/") ||
    file.size <= 512 * 1024
  ) {
    const rawText = await file.text();
    const hasNull = rawText.includes("\u0000");
    textContent = hasNull
      ? `[ملف ثنائي: ${file.name} (${formatBytes(file.size)})]`
      : rawText.slice(0, 18000);
  } else {
    textContent = `[ملف مرفق: ${file.name} (${formatBytes(file.size)})]`;
  }

  return {
    id,
    name: file.name,
    kind: "file",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    textContent,
  };
}

function buildApiMessageContent(msg: ChatMessage): unknown {
  const fileBlocks = (msg.attachments ?? [])
    .filter((a) => a.kind === "file" && a.textContent)
    .map(
      (a) =>
        `\n\n[ملف: ${a.name} (${formatBytes(a.size)})]\n${a.textContent}\n[نهاية الملف]`
    )
    .join("");

  const combinedText = `${msg.content}${fileBlocks}`.trim() || "حلّل المرفقات:";
  const images = (msg.attachments ?? []).filter(
    (a) => a.kind === "image" && a.dataUrl
  );

  if (images.length === 0) {
    return combinedText;
  }

  return [
    { type: "text", text: combinedText },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: img.dataUrl! },
    })),
  ];
}

export default function ChatCouncilTool({
  activeChatId,
  onChatCreated,
  onChatsMutated,
  onGoAdmin,
}: {
  activeChatId: string | null;
  onChatCreated: (chatId: string) => void;
  onChatsMutated: () => void;
  onGoAdmin: () => void;
}) {
  const {
    allModels,
    roles,
    councilMembers,
    keys,
    buildCandidates,
    hasAnyKey,
  } = usePool();

  const [mode, setMode] = useState<"chat" | "council">("chat");
  const [selectedOverride, setSelectedOverride] = useState<string>("auto");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextLoadRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [councilResult, setCouncilResult] = useState<{
    members: CouncilMemberOut[];
    verdict: CouncilVerdict | null;
  } | null>(null);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setCouncilResult(null);
      setError(null);
      return;
    }

    if (skipNextLoadRef.current === activeChatId) {
      skipNextLoadRef.current = null;
      return;
    }

    let cancelled = false;
    setLoadingChat(true);
    setError(null);

    fetch(`/api/chats/${activeChatId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("تعذر تحميل المحادثة");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const loaded: ChatMessage[] = Array.isArray(data?.messages)
          ? data.messages.map((m: ChatMessage) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              meta: m.meta,
              attachments: m.attachments,
            }))
          : [];
        setMessages(loaded);
        setMode(data?.chat?.mode === "council" ? "council" : "chat");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "خطأ في تحميل المحادثة");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingChat(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeChatId]);

  const activeRef: ModelRef | undefined =
    selectedOverride === "auto"
      ? roles.fastChat
      : (() => {
          const [provider, ...rest] = selectedOverride.split(":");
          const model = rest.join(":");
          return provider && model
            ? { provider: provider as ModelRef["provider"], model }
            : undefined;
        })();

  async function handleFilesSelected(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).slice(0, 6);
    if (incoming.length === 0) return;

    try {
      const processed = await Promise.all(incoming.map(processUploadedFile));
      setAttachments((prev) => [...prev, ...processed].slice(0, 6));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تجهيز الملف");
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function persistMessage(
    chatId: string,
    payload: {
      role: "user" | "assistant";
      content: string;
      meta?: string;
      attachments?: ChatAttachment[];
    }
  ) {
    await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function handleSendChat() {
    const text = input.trim();
    const currentAttachments = attachments;
    if ((!text && currentAttachments.length === 0) || loading) return;
    setError(null);

    const hasImageAttachment =
      currentAttachments.some((a) => a.kind === "image") ||
      messages.some((m) => m.attachments?.some((a) => a.kind === "image"));

    let candidates =
      hasImageAttachment && selectedOverride === "auto"
        ? buildCandidates("vision", activeRef)
        : buildCandidates("fastChat", activeRef);

    if (candidates.length === 0) {
      candidates = buildCandidates("fastChat", activeRef);
    }

    if (candidates.length === 0) {
      setError("أضف مفتاح API واسحب الموديلات أولاً من قسم المفاتيح والموديلات.");
      return;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setAttachments([]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const chatIdPromise: Promise<string | null> = (async () => {
      let id = activeChatId;
      if (!id) {
        const createRes = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat" }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          id = created?.chat?.id ?? null;
          if (id) {
            skipNextLoadRef.current = id;
            onChatCreated(id);
          }
        }
      }
      if (id) {
        await persistMessage(id, {
          role: "user",
          content: userMsg.content,
          attachments: userMsg.attachments,
        });
        onChatsMutated();
      }
      return id;
    })().catch(() => activeChatId);

    let accumulated = "";
    let meta = "";

    try {
      const apiMessages = [
        { role: "system", content: SYSTEM_INSTRUCTION },
        ...nextMessages.slice(-12).map((m) => ({
          role: m.role,
          content: m.role === "user" ? buildApiMessageContent(m) : m.content,
        })),
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          candidates,
          stream: true,
          messages: apiMessages,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || `HTTP ${res.status}`);
      }

      const usedProvider = res.headers.get("X-Selected-Provider") || "";
      const usedModel = res.headers.get("X-Selected-Model") || "";
      meta = `${PROVIDERS[usedProvider as keyof typeof PROVIDERS]?.name ?? usedProvider} · ${usedModel}`;

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming not supported");

      const decoder = new TextDecoder();
      let buffer = "";
      let rafScheduled = false;

      const flushToState = () => {
        rafScheduled = false;
        const textSnapshot = accumulated;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: textSnapshot,
            meta,
          };
          return copy;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              accumulated += delta;
              if (!rafScheduled) {
                rafScheduled = true;
                requestAnimationFrame(flushToState);
              }
            }
          } catch {
            // ignore partial SSE JSON
          }
        }
      }

      flushToState();
      endRef.current?.scrollIntoView({ behavior: "auto" });
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "فشل الاتصال بالموديل");
        if (!accumulated) {
          setMessages((prev) => prev.slice(0, -1));
        }
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      const resolvedChatId = await chatIdPromise;
      if (resolvedChatId && accumulated.trim()) {
        await persistMessage(resolvedChatId, {
          role: "assistant",
          content: accumulated,
          meta,
        });
        onChatsMutated();
      }
    }
  }

  async function handleRunCouncil() {
    const fileContext = attachments
      .filter((a) => a.kind === "file" && a.textContent)
      .map((a) => `\n\n[ملف: ${a.name}]\n${a.textContent}`)
      .join("");
    const fullPrompt = `${input.trim()}${fileContext}`.trim();

    if (!fullPrompt || loading) return;
    setError(null);

    if (councilMembers.length === 0) {
      setError("اختر أعضاء مجلس الخبراء أولاً من قسم المفاتيح والموديلات.");
      return;
    }

    setLoading(true);
    setCouncilResult(null);

    try {
      const judgeRef = roles.councilJudge ?? councilMembers[0];
      const res = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${SYSTEM_INSTRUCTION}\n\n${fullPrompt}`,
          members: councilMembers.map((m) => ({
            provider: m.provider,
            model: m.model,
            apiKey: keys[m.provider],
          })),
          judge: judgeRef
            ? {
                provider: judgeRef.provider,
                model: judgeRef.model,
                apiKey: keys[judgeRef.provider],
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setCouncilResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تشغيل مجلس الخبراء");
    } finally {
      setLoading(false);
    }
  }

  function copyMsg(idx: number, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  const isEmpty = mode === "chat" ? messages.length === 0 : !councilResult;

  const composerBox = (
    <div className="w-full">
      <div className="rounded-2xl border border-white/[0.1] bg-[#131318]/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur-xl transition focus-within:border-[#d97757]/55 focus-within:shadow-[0_0_0_3px_rgba(217,119,87,0.12)]">
        {attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2 border-b border-white/[0.07] pb-2.5">
            {attachments.map((att) =>
              att.kind === "image" && att.dataUrl ? (
                <div
                  key={att.id}
                  className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/15 bg-black/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white hover:bg-rose-500"
                    title="إزالة"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0b0e] px-3 py-1.5 text-xs text-zinc-200"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#e58b6c]" />
                  <span className="max-w-[140px] truncate" dir="ltr">
                    {att.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="text-zinc-400 hover:text-rose-300"
                    title="إزالة"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            )}
          </div>
        )}

        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData?.files ?? []);
            if (items.length > 0) {
              e.preventDefault();
              handleFilesSelected(items);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (mode === "chat") handleSendChat();
              else handleRunCouncil();
            }
          }}
          placeholder={
            mode === "chat"
              ? "اكتب رسالتك، أو اسحب وألصق صوراً وملفات هنا..."
              : "اكتب سؤالك لمجلس الخبراء..."
          }
          className="max-h-40 w-full resize-none bg-transparent px-1.5 py-1 text-sm leading-6 text-[#f4f4f5] placeholder:text-zinc-500 focus:outline-none"
        />

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.09] bg-[#0b0b0e] px-3 text-xs text-zinc-300 transition hover:border-white/20 hover:text-white"
              title="رفع صورة أو ملف"
            >
              <Plus className="h-3.5 w-3.5 text-[#e58b6c]" />
              <span>صورة / ملف</span>
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "chat" ? "council" : "chat")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition ${
                mode === "council"
                  ? "border-[#d97757]/50 bg-[#d97757]/18 text-[#f2a88f]"
                  : "border-white/[0.09] bg-[#0b0b0e] text-zinc-300 hover:border-white/20 hover:text-white"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              <span>مجلس الخبراء ({councilMembers.length})</span>
            </button>

            {mode === "chat" && (
              <div className="relative">
                <select
                  value={selectedOverride}
                  onChange={(e) => setSelectedOverride(e.target.value)}
                  className="h-8 max-w-[185px] appearance-none rounded-full border border-white/[0.09] bg-[#0b0b0e] pl-7 pr-3 text-xs text-zinc-300 focus:border-[#d97757]/50 focus:outline-none"
                >
                  <option value="auto">
                    تلقائي ({roles.fastChat?.model || "Auto"})
                  </option>
                  {allModels.map((m) => (
                    <option
                      key={`${m.provider}:${m.id}`}
                      value={`${m.provider}:${m.id}`}
                    >
                      {m.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute left-2.5 top-2.5 h-3 w-3 text-zinc-400" />
              </div>
            )}
          </div>

          {loading ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d97757] text-white shadow-md shadow-[#d97757]/30 transition hover:bg-[#e58868]"
              title="إيقاف"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                mode === "chat" ? handleSendChat() : handleRunCouncil()
              }
              disabled={!input.trim() && attachments.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-l from-[#d97757] to-[#e48667] text-white shadow-md shadow-[#d97757]/25 transition hover:brightness-110 disabled:bg-zinc-800 disabled:bg-none disabled:text-zinc-500 disabled:shadow-none"
              title="إرسال"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
          handleFilesSelected(e.dataTransfer.files);
        }
      }}
    >
      {/* Image Lightbox */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute left-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-[88vh] max-w-[92vw] rounded-2xl border border-white/10"
          />
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-[#d97757]/60 bg-[#121217] px-8 py-6 text-sm font-medium text-white shadow-2xl">
            أفلت الصور أو الملفات هنا للإرفاق
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.md,.json,.csv,.tsv,.js,.mjs,.ts,.tsx,.jsx,.py,.html,.css,.sql,.xml,.yaml,.yml,.log,.pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFilesSelected(e.target.files);
          }
          e.target.value = "";
        }}
      />

      {/* Empty Centered Studio Canvas */}
      {isEmpty && !loading && !loadingChat ? (
        <div className="bg-obsidian-grid flex flex-1 flex-col items-center justify-center px-4 pb-12">
          <div className="w-full max-w-[780px] space-y-6">
            {!hasAnyKey && allModels.length === 0 && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#d97757]/35 bg-[#d97757]/10 px-4 py-3 text-xs text-zinc-200 backdrop-blur-sm">
                <span>أضف مفتاح API واسحب الموديلات للبدء في الدردشة.</span>
                <button
                  onClick={onGoAdmin}
                  className="shrink-0 rounded-full bg-[#d97757] px-3.5 py-1 text-xs font-semibold text-white transition hover:bg-[#e58868]"
                >
                  إضافة مفتاح
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#121217] px-3 py-1 text-[11px] text-zinc-400">
                <Sparkles className="h-3 w-3 text-[#e58b6c]" />
                <span>{mode === "chat" ? "محادثة ذكية" : "مجلس الخبراء"}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {mode === "chat"
                  ? "ابدأ بسؤال أو ارفع ملفاتك للتحليل"
                  : `مجلس الخبراء (${councilMembers.length} موديلات)`}
              </h2>
            </div>

            {composerBox}

            {mode === "chat" && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {STARTER_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="studio-card group flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-right text-xs text-zinc-300 transition hover:border-[#d97757]/40 hover:bg-[#17171e] hover:text-white"
                  >
                    <span className="truncate">{q}</span>
                    <ArrowUpLeft className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#e58b6c]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto px-4">
            <div className="mx-auto max-w-[780px] py-6">
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {loadingChat && (
                <div className="flex min-h-[38vh] items-center justify-center text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin text-[#d97757]" />
                </div>
              )}

              {!loadingChat && mode === "chat" && messages.length > 0 && (
                <div className="space-y-6 pb-6">
                  {messages.map((m, idx) =>
                    m.role === "user" ? (
                      <div key={idx} className="flex justify-start">
                        <div className="max-w-[84%] space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#16161d] px-5 py-3.5 text-[15px] leading-7 text-[#f4f4f5] shadow-sm">
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {m.attachments.map((att) =>
                                att.kind === "image" && att.dataUrl ? (
                                  <button
                                    key={att.id}
                                    type="button"
                                    onClick={() => setPreviewImage(att.dataUrl!)}
                                    className="overflow-hidden rounded-xl border border-white/10"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={att.dataUrl}
                                      alt={att.name}
                                      className="h-28 w-28 object-cover"
                                    />
                                  </button>
                                ) : (
                                  <div
                                    key={att.id}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0b0e] px-3 py-1.5 text-xs text-zinc-200"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#e58b6c]" />
                                    <span className="max-w-[160px] truncate" dir="ltr">
                                      {att.name}
                                    </span>
                                    <span className="text-[10px] text-zinc-400" dir="ltr">
                                      {formatBytes(att.size)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                          {m.content && (
                            <div className="whitespace-pre-wrap">{m.content}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div key={idx} className="group flex items-start gap-3.5">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#d97757]/30 bg-[#121217]">
                          <Sparkles className="h-3.5 w-3.5 text-[#e58b6c]" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2 rounded-2xl border border-white/[0.05] bg-[#101014]/70 px-4 py-3">
                          {m.content ? (
                            <MarkdownMessage content={m.content} />
                          ) : (
                            <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d97757]" />
                              جاري التحليل والكتابة...
                            </span>
                          )}
                          {m.content && (
                            <div className="flex items-center gap-3 border-t border-white/[0.05] pt-2 text-[11px] text-zinc-500">
                              <button
                                onClick={() => copyMsg(idx, m.content)}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
                              >
                                {copiedIdx === idx ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {copiedIdx === idx ? "تم النسخ" : "نسخ"}
                                </span>
                              </button>
                              {m.meta && <span dir="ltr">{m.meta}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                  <div ref={endRef} />
                </div>
              )}

              {mode === "council" && councilResult && (
                <div className="space-y-5 pb-6">
                  {councilResult.verdict && (
                    <div className="rounded-2xl border border-[#d97757]/40 bg-gradient-to-b from-[#d97757]/[0.1] to-[#121217] p-5 shadow-lg">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#d97757]/20 pb-3">
                        <span className="text-sm font-semibold text-[#f2a88f]">
                          خلاصة مجلس الخبراء
                        </span>
                        <span
                          className="rounded-full border border-white/10 bg-[#0b0b0e] px-2.5 py-0.5 font-mono text-[11px] text-zinc-300"
                          dir="ltr"
                        >
                          {councilResult.verdict.provider} ·{" "}
                          {councilResult.verdict.model}
                        </span>
                      </div>
                      <MarkdownMessage
                        content={
                          councilResult.verdict.error ||
                          councilResult.verdict.content
                        }
                      />
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    {councilResult.members.map((m, idx) => (
                      <div
                        key={idx}
                        className="studio-card rounded-2xl p-4"
                      >
                        <div className="mb-2 flex items-center justify-between border-b border-white/[0.06] pb-2 text-xs text-zinc-400">
                          <span className="truncate font-mono text-zinc-200" dir="ltr">
                            {m.model}
                          </span>
                          <span className="font-mono text-[#e58b6c]" dir="ltr">
                            {m.latencyMs}ms
                          </span>
                        </div>
                        <div className="max-h-72 overflow-y-auto text-xs leading-6 text-zinc-200">
                          {m.ok ? (
                            <MarkdownMessage content={m.content} />
                          ) : (
                            `خطأ: ${m.error}`
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Docked Studio Composer */}
          <div className="shrink-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent px-4 pb-4 pt-2">
            <div className="mx-auto max-w-[780px]">
              {composerBox}
              <p className="mt-2 text-center text-[11px] text-zinc-500">
                يتم حفظ المحادثات والمرفقات تلقائياً في سجل حسابك
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
