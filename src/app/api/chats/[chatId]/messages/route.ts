import { NextRequest } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";
import { appendMessage, type ChatAttachment } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ chatId: string }> }
) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await context.params;
  const body = (await req.json().catch(() => null)) as {
    role?: "user" | "assistant";
    content?: string;
    meta?: string;
    attachments?: ChatAttachment[];
  } | null;

  if (!body || (body.role !== "user" && body.role !== "assistant")) {
    return Response.json({ error: "Invalid message payload" }, { status: 400 });
  }

  const result = appendMessage(user.id, chatId, {
    role: body.role,
    content: typeof body.content === "string" ? body.content : "",
    meta: typeof body.meta === "string" ? body.meta : undefined,
    attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
  });

  if (!result) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json(result, { status: 201 });
}
