import {
  getCurrentSessionUser,
  isGitHubOAuthConfigured,
} from "@/lib/auth";

export async function GET() {
  const user = await getCurrentSessionUser();
  return Response.json({
    user,
    githubOAuthConfigured: isGitHubOAuthConfigured(),
  });
}
