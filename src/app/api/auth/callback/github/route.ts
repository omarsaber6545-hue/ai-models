import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  isGitHubOAuthConfigured,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { upsertUser } from "@/lib/db";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!isGitHubOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/?auth_error=missing_github_oauth", origin)
    );
  }

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?auth_error=invalid_state", origin));
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID!.trim(),
        client_secret: process.env.GITHUB_CLIENT_SECRET!.trim(),
        code,
        redirect_uri: `${origin}/api/auth/callback/github`,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(
        new URL("/?auth_error=token_exchange_failed", origin)
      );
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(
        new URL("/?auth_error=profile_fetch_failed", origin)
      );
    }

    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      name?: string | null;
      avatar_url?: string;
    };

    const profile = {
      id: ghUser.id,
      login: ghUser.login,
      name: ghUser.name || ghUser.login,
      avatarUrl: ghUser.avatar_url || "",
    };

    try {
      upsertUser(profile);
    } catch {
      // non-fatal if DB init happens lazily later
    }

    const sessionToken = createSessionToken(profile);
    const isHttps =
      req.nextUrl.protocol === "https:" ||
      req.headers.get("x-forwarded-proto") === "https";

    const res = NextResponse.redirect(new URL("/", origin));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/?auth_error=oauth_error", origin));
  }
}
