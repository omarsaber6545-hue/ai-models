import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isGitHubOAuthConfigured, OAUTH_STATE_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!isGitHubOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/?auth_error=missing_github_oauth", origin)
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID!.trim();
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/auth/callback/github`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });

  const isHttps =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";

  const res = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
