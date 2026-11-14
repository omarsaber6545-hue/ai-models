"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  FileImage,
  QrCode,
  Terminal,
  Settings,
  PanelRightClose,
  PanelRightOpen,
  SquarePen,
  Menu,
  X,
  KeyRound,
  Github,
  LogOut,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { PoolProvider, usePool } from "@/components/PoolContext";
import WelcomeScreen from "@/components/WelcomeScreen";
import ChatCouncilTool from "@/components/tools/ChatCouncilTool";
import VisionDocTool from "@/components/tools/VisionDocTool";
import QrStudioTool from "@/components/tools/QrStudioTool";
import CodeFormatterTool from "@/components/tools/CodeFormatterTool";
import AdminPanelTool from "@/components/tools/AdminPanelTool";

type ToolTab = "chat" | "vision" | "qr" | "code" | "admin";

interface AuthUser {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
}

interface ChatSummary {
  id: string;
  title: string;
  mode: "chat" | "council";
  updatedAt: number;
}

const NAV_ITEMS: Array<{
  id: ToolTab;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "chat", title: "الشات والمجلس", icon: MessageSquare },
  { id: "code", title: "استوديو الكود", icon: Terminal },
  { id: "vision", title: "الصور والمستندات", icon: FileImage },
  { id: "qr", title: "استوديو الـ QR", icon: QrCode },
];

function WorkspaceShell() {
  const [active, setActive] = useState<ToolTab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [githubConfigured, setGithubConfigured] = useState<boolean>(false);
  const [showOAuthHelp, setShowOAuthHelp] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { allModels } = usePool();

  const refreshChats = useCallback(async () => {
    setChatsLoading(true);
    try {
      const res = await fetch("/api/chats");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.chats)) {
        setChats(data.chats);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setAuthUser(data?.user ?? null);
        setGithubConfigured(Boolean(data?.githubOAuthConfigured));
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));

    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    if (err) {
      if (err === "missing_github_oauth") {
        setShowOAuthHelp(true);
      } else {
        setAuthError(`تعذر تسجيل الدخول (${err})`);
      }
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (authUser) {
      refreshChats();
    } else {
      setChats([]);
      setActiveChatId(null);
    }
  }, [authUser, refreshChats]);

  function handleGitHubLogin() {
    if (!githubConfigured) {
      setShowOAuthHelp(true);
      return;
    }
    window.location.href = "/api/auth/github";
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthUser(null);
    setChats([]);
    setActiveChatId(null);
  }

  function selectTab(tab: ToolTab) {
    setActive(tab);
    setMobileOpen(false);
  }

  function handleNewChat() {
    setActiveChatId(null);
    setActive("chat");
    setMobileOpen(false);
  }

  function handleSelectChat(chatId: string) {
    setActiveChatId(chatId);
    setActive("chat");
    setMobileOpen(false);
  }

  async function handleDeleteChat(e: React.MouseEvent, chatId: string) {
    e.stopPropagation();
    const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    if (res.ok) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    }
  }

  const activeNav =
    NAV_ITEMS.find((n) => n.id === active) ?? {
      id: "admin" as ToolTab,
      title: "المفاتيح والموديلات",
      icon: Settings,
    };

  const oauthModal = showOAuthHelp && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#242424] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Github className="h-5 w-5 text-[#d97757]" />
            إعداد تسجيل الدخول بـ GitHub
          </div>
          <button
            onClick={() => setShowOAuthHelp(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-6 text-zinc-300">
          أضف GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET في ملف .env.local ثم أعد
          تشغيل السيرفر.
        </p>
        <button
          onClick={() => setShowOAuthHelp(false)}
          className="w-full rounded-full bg-white py-2 text-xs font-semibold text-[#171717]"
        >
          حسناً
        </button>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#212121] text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin text-[#d97757]" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        {oauthModal}
        {authError && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-[#242424] px-4 py-2.5 text-xs text-rose-200 shadow-xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{authError}</span>
            <button onClick={() => setAuthError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <WelcomeScreen onGitHubLogin={handleGitHubLogin} />
      </>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#171717] text-[#ececec]">
      {/* ChatGPT Sidebar Top Row */}
      <div className="flex items-center justify-between px-3 py-3">
        <button
          onClick={handleNewChat}
          className="flex flex-1 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.06]"
        >
          <span>محادثة جديدة</span>
          <SquarePen className="h-4 w-4 text-zinc-300" />
        </button>

        <button
          onClick={() => setSidebarOpen(false)}
          className="hidden rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:inline-flex"
          title="إخفاء القائمة"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>

        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.06] lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tools + Saved Chats */}
      <div className="flex-1 space-y-5 overflow-y-auto px-2.5 py-2">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              active === item.id && !(item.id === "chat" && activeChatId);
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-right text-sm transition ${
                  isActive
                    ? "bg-white/[0.09] font-medium text-white"
                    : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{item.title}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-3 pb-1 text-[11px] font-medium text-zinc-500">
            <span>المحادثات</span>
            {chats.length > 0 && <span>{chats.length}</span>}
          </div>

          {chatsLoading && chats.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">جاري التحميل...</div>
          ) : chats.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">
              لا توجد محادثات محفوظة بعد
            </div>
          ) : (
            chats.map((chat) => {
              const selected = active === "chat" && activeChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-right text-[13px] transition ${
                    selected
                      ? "bg-white/[0.09] font-medium text-white"
                      : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className="rounded-md p-1 text-zinc-500 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                    title="حذف المحادثة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="space-y-1.5 border-t border-white/[0.07] p-2.5">
        <button
          onClick={() => selectTab("admin")}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-right text-xs transition ${
            active === "admin"
              ? "bg-white/[0.09] text-white"
              : "text-zinc-300 hover:bg-white/[0.05]"
          }`}
        >
          <KeyRound className="h-4 w-4 shrink-0 text-[#d97757]" />
          <div className="min-w-0 flex-1 truncate font-medium">
            المفاتيح والموديلات
          </div>
          <span className="text-[11px] text-zinc-400">
            {allModels.length > 0 ? allModels.length : "إعداد"}
          </span>
        </button>

        <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-white/[0.04]">
          {authUser.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={authUser.avatarUrl}
              alt={authUser.login}
              className="h-7 w-7 shrink-0 rounded-full"
            />
          ) : (
            <Github className="h-5 w-5 shrink-0 text-zinc-400" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-zinc-100">
              {authUser.name}
            </div>
            <div className="truncate text-[11px] text-zinc-400" dir="ltr">
              @{authUser.login}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-rose-300"
            title="تسجيل الخروج"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#212121] text-[#ececec]">
      {oauthModal}

      {sidebarOpen && (
        <aside className="hidden w-[260px] shrink-0 border-l border-white/[0.06] lg:block">
          {sidebarContent}
        </aside>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-[270px] border-l border-white/[0.08]">
            {sidebarContent}
          </div>
          <div
            className="flex-1 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="hidden rounded-lg p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white lg:inline-flex"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            )}

            <span className="text-sm font-semibold text-zinc-100">
              {activeNav.title}
            </span>
          </div>

          <button
            onClick={() => selectTab("admin")}
            className="rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1 text-xs text-zinc-300 transition hover:bg-[#333333] hover:text-white"
          >
            {allModels.length > 0
              ? `${allModels.length} موديل جاهز`
              : "ربط المفاتيح"}
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {active === "chat" && (
            <ChatCouncilTool
              activeChatId={activeChatId}
              onChatCreated={(id) => setActiveChatId(id)}
              onChatsMutated={refreshChats}
              onGoAdmin={() => selectTab("admin")}
            />
          )}
          {active === "vision" && (
            <div className="mx-auto max-w-5xl px-4 py-6">
              <VisionDocTool />
            </div>
          )}
          {active === "qr" && (
            <div className="mx-auto max-w-5xl px-4 py-6">
              <QrStudioTool />
            </div>
          )}
          {active === "code" && (
            <div className="mx-auto max-w-6xl px-4 py-6">
              <CodeFormatterTool />
            </div>
          )}
          {active === "admin" && (
            <div className="mx-auto max-w-5xl px-4 py-6">
              <AdminPanelTool />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PoolProvider>
      <WorkspaceShell />
    </PoolProvider>
  );
}
