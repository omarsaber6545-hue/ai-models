import { NextRequest } from "next/server";
import {
  callWithFailover,
  PROVIDERS,
  resolveProviderKey,
  type FailoverCandidate,
} from "@/lib/ai-pool";

export async function GET() {
  const status = Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    envVar: p.envVar,
    docsUrl: p.docsUrl,
    hasEnvKey: Boolean(resolveProviderKey(p.id)),
  }));

  return Response.json({ providers: status });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      candidates?: FailoverCandidate[];
      messages?: unknown[];
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
      reasoning_effort?: "low" | "medium" | "high";
    };

    if (!body.candidates?.length || !body.messages?.length) {
      return Response.json(
        { error: "candidates and messages are required" },
        { status: 400 }
      );
    }

    const stream = Boolean(body.stream);
    const payload: Record<string, unknown> = {
      messages: body.messages,
      temperature: body.temperature ?? 0.6,
      max_tokens: body.max_tokens ?? 4096,
      stream,
    };

    if (body.reasoning_effort) {
      payload.reasoning_effort = body.reasoning_effort;
    }

    const { provider, model, response, attempts } = await callWithFailover(
      body.candidates,
      payload
    );

    if (stream) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Selected-Provider": provider,
          "X-Selected-Model": model,
        },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return Response.json({
      provider,
      model,
      content,
      attempts,
      usage: data?.usage ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
