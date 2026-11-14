import { NextRequest } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";
import {
  deleteChat,
  getChatWithMessages,
  updateChat,
} from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ chatId: string }> }
) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await context.params;
  const data = getChatWithMessages(user.id, chatId);
  if (!data) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json(data);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ chatId: string }> }
) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    mode?: "chat" | "council";
  };

  const updated = updateChat(user.id, chatId, body);
  if (!updated) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ chat: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ chatId: string }> }
) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await context.params;
  const deleted = deleteChat(user.id, chatId);
  if (!deleted) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
