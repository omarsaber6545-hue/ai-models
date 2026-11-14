# AI Workspace — منصة الأدوات والموديلات

A dark, Arabic-first (RTL) Next.js AI workspace combining chat, file/image uploads, browser developer utilities, and GitHub OAuth authentication with SQLite persistence.

Live deployment: **https://ai-models-rosy.vercel.app**

---

## Features & Modules

- **GitHub OAuth Authentication** (`/api/auth/github`, `/api/auth/callback/github`, `/api/auth/session`, `/api/auth/logout`)
- **Chat & AI Council** (`ChatCouncilTool`, `/api/chat`, `/api/council`, `/api/models/discover`)
- **Persistent Chat History & Attachments** (`/api/chats`, `/api/chats/[chatId]`, `/api/chats/[chatId]/messages`) backed by `node:sqlite` (`src/lib/db.ts`)
- **Built-in Workspace Tools**:
  - `ChatCouncilTool` — AI chat and multi-model council interface
  - `VisionDocTool` — Image and document tools
  - `CodeFormatterTool` — Code formatting utility
  - `QrStudioTool` — QR code generator and scanner (`qrcode`, `jsqr`)
  - `AdminPanelTool` — Workspace/provider management panel

## Tech Stack

- **Framework:** Next.js `^15.2.0` (App Router)
- **UI:** React `^19.0.0`, Tailwind CSS `^3.4.17`, `lucide-react`
- **Auth:** GitHub OAuth + signed session (`src/lib/auth.ts`)
- **Database:** Node.js built-in SQLite (`node:sqlite`) with `/tmp/ai-hub-data` path on Vercel and in-memory fallback (`src/lib/db.ts`)
- **Language:** TypeScript `^5.7.3`

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── auth/          # GitHub OAuth, callback, session, logout
│   │   ├── chat/          # Chat endpoint
│   │   ├── chats/         # Chat CRUD & persisted messages
│   │   ├── council/       # Multi-model council endpoint
│   │   └── models/        # Model discovery
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── MarkdownMessage.tsx
│   ├── PoolContext.tsx
│   ├── WelcomeScreen.tsx
│   └── tools/             # Workspace tools (Chat, VisionDoc, CodeFormatter, QrStudio, AdminPanel)
└── lib/
    ├── ai-pool.ts
    ├── auth.ts
    └── db.ts
```

## Getting Started Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables** in `.env.local`:
   ```env
   GITHUB_CLIENT_ID=your_github_oauth_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
   AUTH_SECRET=your_random_auth_secret
   ```

   In your GitHub OAuth App settings, set the **Authorization callback URL** to:
   - Local development: `http://localhost:3000/api/auth/callback/github`
   - Production (Vercel): `https://ai-models-rosy.vercel.app/api/auth/callback/github`

3. **Run the development server:**
   ```bash
   npm run dev
   ```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run Next.js ESLint checks |

## Deployment Notes (Vercel)

- **Node.js Version:** `24.x` (supports `node:sqlite`)
- **Storage:** On Vercel serverless functions, `ai-hub.db` is stored in `/tmp/ai-hub-data` (ephemeral across cold starts) with an automatic in-memory fallback.
