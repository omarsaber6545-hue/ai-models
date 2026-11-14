import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";

export interface ChatAttachment {
  id: string;
  name: string;
  kind: "image" | "file";
  mimeType: string;
  size: number;
  dataUrl?: string;
  textContent?: string;
}

export interface StoredChat {
  id: string;
  userId: number;
  title: string;
  mode: "chat" | "council";
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
  lastPreview?: string;
}

export interface StoredMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
  attachments?: ChatAttachment[];
  createdAt: number;
}

type SqliteDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { changes?: number };
    get: (...params: unknown[]) => Record<string, unknown> | undefined;
    all: (...params: unknown[]) => Array<Record<string, unknown>>;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __aiHubSqliteDb: SqliteDb | undefined;
}

function createMemoryFallbackDb(): SqliteDb {
  const chatsMap = new Map<string, Record<string, unknown>>();
  const messagesList: Array<Record<string, unknown>> = [];

  return {
    exec: () => {},
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        if (sql.includes("INSERT INTO chats")) {
          const [id, user_id, title, mode, created_at, updated_at] = params;
          chatsMap.set(String(id), {
            id,
            user_id,
            title,
            mode,
            created_at,
            updated_at,
          });
          return { changes: 1 };
        }
        if (sql.includes("UPDATE chats SET title = ?, mode = ?")) {
          const [title, mode, updated_at, id, user_id] = params;
          const c = chatsMap.get(String(id));
          if (c && Number(c.user_id) === Number(user_id)) {
            c.title = title;
            c.mode = mode;
            c.updated_at = updated_at;
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (sql.includes("UPDATE chats SET title = ?, updated_at = ?")) {
          const [title, updated_at, id] = params;
          const c = chatsMap.get(String(id));
          if (c) {
            c.title = title;
            c.updated_at = updated_at;
          }
          return { changes: c ? 1 : 0 };
        }
        if (sql.includes("UPDATE chats SET updated_at = ?")) {
          const [updated_at, id] = params;
          const c = chatsMap.get(String(id));
          if (c) c.updated_at = updated_at;
          return { changes: c ? 1 : 0 };
        }
        if (sql.includes("DELETE FROM chats")) {
          const [id, user_id] = params;
          const c = chatsMap.get(String(id));
          if (c && Number(c.user_id) === Number(user_id)) {
            chatsMap.delete(String(id));
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (sql.includes("INSERT INTO messages")) {
          const [id, chat_id, role, content, meta, attachments_json, created_at] =
            params;
          messagesList.push({
            id,
            chat_id,
            role,
            content,
            meta,
            attachments_json,
            created_at,
          });
          return { changes: 1 };
        }
        return { changes: 1 };
      },
      get: (...params: unknown[]) => {
        if (sql.includes("FROM chats WHERE id = ? AND user_id = ?")) {
          const [id, user_id] = params;
          const c = chatsMap.get(String(id));
          return c && Number(c.user_id) === Number(user_id) ? c : undefined;
        }
        return undefined;
      },
      all: (...params: unknown[]) => {
        if (sql.includes("FROM chats c")) {
          const [user_id] = params;
          return Array.from(chatsMap.values())
            .filter((c) => Number(c.user_id) === Number(user_id))
            .sort((a, b) => Number(b.updated_at) - Number(a.updated_at))
            .map((c) => {
              const msgs = messagesList.filter((m) => m.chat_id === c.id);
              return {
                ...c,
                message_count: msgs.length,
                last_preview: msgs[msgs.length - 1]?.content ?? "",
              };
            });
        }
        if (sql.includes("FROM messages WHERE chat_id = ?")) {
          const [chat_id] = params;
          return messagesList
            .filter((m) => m.chat_id === chat_id)
            .sort((a, b) => Number(a.created_at) - Number(b.created_at));
        }
        return [];
      },
    }),
  };
}

function getDb(): SqliteDb {
  if (globalThis.__aiHubSqliteDb) {
    return globalThis.__aiHubSqliteDb;
  }

  try {
    const dataDir = process.env.VERCEL
      ? path.join("/tmp", "ai-hub-data")
      : path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, "ai-hub.db");
    const req = createRequire(import.meta.url);
    const sqliteMod = req("node:sqlite") as {
      DatabaseSync: new (filename: string) => SqliteDb;
    };
    const db = new sqliteMod.DatabaseSync(dbPath);

    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        login TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'chat',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chats_user_updated
        ON chats(user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        meta TEXT,
        attachments_json TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_created
        ON messages(chat_id, created_at ASC);
    `);

    globalThis.__aiHubSqliteDb = db;
    return db;
  } catch {
    const fallback = createMemoryFallbackDb();
    globalThis.__aiHubSqliteDb = fallback;
    return fallback;
  }
}

export function upsertUser(user: {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
}): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, login, name, avatar_url, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       login = excluded.login,
       name = excluded.name,
       avatar_url = excluded.avatar_url,
       last_seen_at = excluded.last_seen_at`
  ).run(user.id, user.login, user.name, user.avatarUrl || "", now, now);
}

export function listUserChats(userId: number): StoredChat[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         c.id,
         c.user_id,
         c.title,
         c.mode,
         c.created_at,
         c.updated_at,
         (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count,
         (SELECT m.content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview
       FROM chats c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 60`
    )
    .all(userId);

  return rows.map((r) => ({
    id: String(r.id),
    userId: Number(r.user_id),
    title: String(r.title),
    mode: r.mode === "council" ? "council" : "chat",
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    messageCount: Number(r.message_count ?? 0),
    lastPreview: r.last_preview ? String(r.last_preview).slice(0, 90) : "",
  }));
}

export function createChat(
  userId: number,
  title = "محادثة جديدة",
  mode: "chat" | "council" = "chat"
): StoredChat {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const cleanTitle = title.trim().slice(0, 80) || "محادثة جديدة";
  db.prepare(
    `INSERT INTO chats (id, user_id, title, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, cleanTitle, mode, now, now);

  return {
    id,
    userId,
    title: cleanTitle,
    mode,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    lastPreview: "",
  };
}

export function getChatWithMessages(
  userId: number,
  chatId: string
): { chat: StoredChat; messages: StoredMessage[] } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, title, mode, created_at, updated_at
       FROM chats WHERE id = ? AND user_id = ?`
    )
    .get(chatId, userId);

  if (!row) return null;

  const msgRows = db
    .prepare(
      `SELECT id, chat_id, role, content, meta, attachments_json, created_at
       FROM messages WHERE chat_id = ? ORDER BY created_at ASC`
    )
    .all(chatId);

  const messages: StoredMessage[] = msgRows.map((m) => {
    let attachments: ChatAttachment[] | undefined;
    if (m.attachments_json) {
      try {
        attachments = JSON.parse(String(m.attachments_json)) as ChatAttachment[];
      } catch {
        attachments = undefined;
      }
    }
    return {
      id: String(m.id),
      chatId: String(m.chat_id),
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content),
      meta: m.meta ? String(m.meta) : undefined,
      attachments,
      createdAt: Number(m.created_at),
    };
  });

  return {
    chat: {
      id: String(row.id),
      userId: Number(row.user_id),
      title: String(row.title),
      mode: row.mode === "council" ? "council" : "chat",
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      messageCount: messages.length,
    },
    messages,
  };
}

export function updateChat(
  userId: number,
  chatId: string,
  patch: { title?: string; mode?: "chat" | "council" }
): StoredChat | null {
  const db = getDb();
  const existing = db
    .prepare(`SELECT id, user_id, title, mode, created_at, updated_at FROM chats WHERE id = ? AND user_id = ?`)
    .get(chatId, userId);
  if (!existing) return null;

  const nextTitle =
    typeof patch.title === "string" && patch.title.trim()
      ? patch.title.trim().slice(0, 80)
      : String(existing.title);
  const nextMode =
    patch.mode === "council" || patch.mode === "chat"
      ? patch.mode
      : existing.mode === "council"
        ? "council"
        : "chat";
  const now = Date.now();

  db.prepare(
    `UPDATE chats SET title = ?, mode = ?, updated_at = ? WHERE id = ? AND user_id = ?`
  ).run(nextTitle, nextMode, now, chatId, userId);

  return {
    id: String(existing.id),
    userId: Number(existing.user_id),
    title: nextTitle,
    mode: nextMode,
    createdAt: Number(existing.created_at),
    updatedAt: now,
  };
}

export function deleteChat(userId: number, chatId: string): boolean {
  const db = getDb();
  const info = db
    .prepare(`DELETE FROM chats WHERE id = ? AND user_id = ?`)
    .run(chatId, userId);
  return Number(info.changes ?? 0) > 0;
}

function deriveAutoTitle(content: string, attachments?: ChatAttachment[]): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean) {
    return clean.length > 46 ? `${clean.slice(0, 46)}…` : clean;
  }
  if (attachments && attachments.length > 0) {
    return `ملف: ${attachments[0].name}`.slice(0, 46);
  }
  return "محادثة جديدة";
}

export function appendMessage(
  userId: number,
  chatId: string,
  input: {
    role: "user" | "assistant";
    content: string;
    meta?: string;
    attachments?: ChatAttachment[];
  }
): { message: StoredMessage; updatedTitle?: string } | null {
  const db = getDb();
  const chat = db
    .prepare(`SELECT id, title FROM chats WHERE id = ? AND user_id = ?`)
    .get(chatId, userId);
  if (!chat) return null;

  const id = crypto.randomUUID();
  const now = Date.now();
  const attachmentsJson =
    input.attachments && input.attachments.length > 0
      ? JSON.stringify(input.attachments)
      : null;

  db.prepare(
    `INSERT INTO messages (id, chat_id, role, content, meta, attachments_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    chatId,
    input.role,
    input.content,
    input.meta ?? null,
    attachmentsJson,
    now
  );

  let updatedTitle: string | undefined;
  if (String(chat.title) === "محادثة جديدة" && input.role === "user") {
    updatedTitle = deriveAutoTitle(input.content, input.attachments);
    db.prepare(`UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`).run(
      updatedTitle,
      now,
      chatId
    );
  } else {
    db.prepare(`UPDATE chats SET updated_at = ? WHERE id = ?`).run(now, chatId);
  }

  return {
    message: {
      id,
      chatId,
      role: input.role,
      content: input.content,
      meta: input.meta,
      attachments: input.attachments,
      createdAt: now,
    },
    updatedTitle,
  };
}
