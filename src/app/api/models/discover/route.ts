import { NextRequest } from "next/server";
import {
  discoverModels,
  PROVIDERS,
  resolveProviderKey,
  type ProviderId,
} from "@/lib/ai-pool";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      provider?: ProviderId;
      apiKey?: string;
    };

    const provider = body.provider;
    if (!provider || !(provider in PROVIDERS)) {
      return Response.json({ error: "Invalid provider" }, { status: 400 });
    }

    const resolvedKey = resolveProviderKey(provider, body.apiKey);
    if (!resolvedKey) {
      return Response.json(
        {
          error: `Missing API key for ${PROVIDERS[provider].name}. Paste a key in the Admin Panel or set ${PROVIDERS[provider].envVar} in .env.local.`,
        },
        { status: 400 }
      );
    }

    const models = await discoverModels(provider, resolvedKey);
    return Response.json({
      provider,
      count: models.length,
      models,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
