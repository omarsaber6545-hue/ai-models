import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "ai_hub_session";
export const OAUTH_STATE_COOKIE = "ai_hub_oauth_state";

export interface SessionUser {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  exp: number;
}

function getAuthSecret(): string {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.GITHUB_CLIENT_SECRET?.trim();
  if (secret) return secret;
  // Ephemeral fallback for local dev only so signing never uses an empty string
  if (!globalThis.__aiHubDevSecret) {
    globalThis.__aiHubDevSecret = crypto.randomBytes(32).toString("hex");
  }
  return globalThis.__aiHubDevSecret;
}

declare global {
  // eslint-disable-next-line no-var
  var __aiHubDevSecret: string | undefined;
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() &&
      process.env.GITHUB_CLIENT_SECRET?.trim()
  );
}

function signPayload(dataB64: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(dataB64)
    .digest("base64url");
}

export function createSessionToken(
  user: Omit<SessionUser, "exp">,
  ttlSeconds = 60 * 60 * 24 * 7
): string {
  const payload: SessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const dataB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = signPayload(dataB64);
  return `${dataB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [dataB64, sig] = token.split(".");
  if (!dataB64 || !sig) return null;

  const expectedSig = signPayload(dataB64);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(dataB64, "base64url").toString("utf8")
    ) as SessionUser;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
