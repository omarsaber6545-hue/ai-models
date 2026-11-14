import { NextRequest } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";
import { createChat, listUserChats, upsertUser } from "@/lib/db";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  upsertUser(user);
  const chats = listUserChats(user.id);
  return Response.json({ chats });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  upsertUser(user);
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    mode?: "chat" | "council";
  };

  const chat = createChat(
    user.id,
    body.title,
    body.mode === "council" ? "council" : "chat"
  );
  return Response.json({ chat }, { status: 201 });
}
