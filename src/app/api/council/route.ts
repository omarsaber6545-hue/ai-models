import { NextRequest } from "next/server";
import {
  callWithFailover,
  PROVIDERS,
  type FailoverCandidate,
} from "@/lib/ai-pool";

interface CouncilResponseItem {
  provider: string;
  model: string;
  ok: boolean;
  content: string;
  latencyMs: number;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      prompt?: string;
      members?: FailoverCandidate[];
      judge?: FailoverCandidate;
      systemPrompt?: string;
    };

    if (!body.prompt?.trim() || !body.members?.length) {
      return Response.json(
        { error: "prompt and at least one council member are required" },
        { status: 400 }
      );
    }

    const baseSystem =
      body.systemPrompt?.trim() ||
      "You are an expert advisor. Provide a clear, accurate, concise answer.";

    const memberResults: CouncilResponseItem[] = await Promise.all(
      body.members.map(async (member) => {
        const started = Date.now();
        try {
          const { response } = await callWithFailover([member], {
            messages: [
              { role: "system", content: baseSystem },
              { role: "user", content: body.prompt },
            ],
            temperature: 0.6,
            max_tokens: 2048,
            stream: false,
          });
          const data = await response.json();
          return {
            provider: PROVIDERS[member.provider]?.name ?? member.provider,
            model: member.model,
            ok: true,
            content: data?.choices?.[0]?.message?.content ?? "",
            latencyMs: Date.now() - started,
          };
        } catch (err) {
          return {
            provider: PROVIDERS[member.provider]?.name ?? member.provider,
            model: member.model,
            ok: false,
            content: "",
            latencyMs: Date.now() - started,
            error: err instanceof Error ? err.message : "Failed",
          };
        }
      })
    );

    const successful = memberResults.filter((m) => m.ok && m.content.trim());
    let verdict: {
      provider: string;
      model: string;
      content: string;
      error?: string;
    } | null = null;

    if (body.judge && successful.length > 0) {
      const answersBlock = successful
        .map(
          (m, idx) =>
            `### Member ${idx + 1}: ${m.model} (${m.provider})\n${m.content}`
        )
        .join("\n\n---\n\n");

      try {
        const { provider, model, response } = await callWithFailover(
          [body.judge],
          {
            messages: [
              {
                role: "system",
                content:
                  "You are the Chief Judge of an AI Council. Compare all member answers, detect any errors or contradictions, highlight key agreements, and synthesize one final, accurate, well-structured answer in the same language as the user prompt.",
              },
              {
                role: "user",
                content: `User Question:\n${body.prompt}\n\nMember Responses:\n${answersBlock}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 3072,
            stream: false,
          }
        );
        const judgeData = await response.json();
        verdict = {
          provider: PROVIDERS[provider]?.name ?? provider,
          model,
          content: judgeData?.choices?.[0]?.message?.content ?? "",
        };
      } catch (err) {
        verdict = {
          provider: PROVIDERS[body.judge.provider]?.name ?? body.judge.provider,
          model: body.judge.model,
          content: "",
          error: err instanceof Error ? err.message : "Judge failed",
        };
      }
    }

    return Response.json({
      members: memberResults,
      verdict,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Council failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
