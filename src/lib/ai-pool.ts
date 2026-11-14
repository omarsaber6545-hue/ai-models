export type ProviderId =
  | "nvidia"
  | "groq"
  | "cerebras"
  | "mistral"
  | "openrouter"
  | "gemini"
  | "github";

export type ModelTag =
  | "chat"
  | "fast"
  | "vision"
  | "ocr"
  | "reasoning-code"
  | "embed"
  | "safety"
  | "translate";

export interface DiscoveredModel {
  provider: ProviderId;
  id: string;
  tags: ModelTag[];
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  envVar: string;
  modelsUrl: string;
  chatUrl: string;
  docsUrl: string;
  headers?: Record<string, string>;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    envVar: "NVIDIA_API_KEY",
    modelsUrl: "https://integrate.api.nvidia.com/v1/models",
    chatUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    docsUrl: "https://build.nvidia.com/",
  },
  groq: {
    id: "groq",
    name: "Groq",
    envVar: "GROQ_API_KEY",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    chatUrl: "https://api.groq.com/openai/v1/chat/completions",
    docsUrl: "https://console.groq.com/",
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    envVar: "CEREBRAS_API_KEY",
    modelsUrl: "https://api.cerebras.ai/v1/models",
    chatUrl: "https://api.cerebras.ai/v1/chat/completions",
    docsUrl: "https://cloud.cerebras.ai/",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    envVar: "MISTRAL_API_KEY",
    modelsUrl: "https://api.mistral.ai/v1/models",
    chatUrl: "https://api.mistral.ai/v1/chat/completions",
    docsUrl: "https://console.mistral.ai/",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    chatUrl: "https://openrouter.ai/api/v1/chat/completions",
    docsUrl: "https://openrouter.ai/keys",
  },
  gemini: {
    id: "gemini",
    name: "Google AI Studio",
    envVar: "GEMINI_API_KEY",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/openai/models",
    chatUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  github: {
    id: "github",
    name: "GitHub Models",
    envVar: "GITHUB_TOKEN",
    modelsUrl: "https://models.github.ai/catalog/models",
    chatUrl: "https://models.github.ai/inference/chat/completions",
    docsUrl: "https://github.com/marketplace/models",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
};

export const PROVIDER_LIST: ProviderConfig[] = Object.values(PROVIDERS);

export function classifyModel(id: string): ModelTag[] {
  const name = id.toLowerCase();
  const tags: ModelTag[] = [];

  if (/embed|nvclip|deplot|bge-|rerank|retriever|arctic-embed/.test(name)) {
    tags.push("embed");
  }
  if (/guard|safety|detector|reward|shield/.test(name)) tags.push("safety");
  if (/translate/.test(name)) tags.push("translate");
  if (/parse|ocr/.test(name)) tags.push("ocr");
  if (
    /vision|vl|omni|vila|fuyu|kosmos|neva|flash|gemini|large-4|gpt-4o|gemma-4|minimax-m3/.test(
      name
    )
  ) {
    tags.push("vision");
  }
  if (
    /coder|codestral|code|starcoder|laguna|r1|reasoning|large-4|ultra|super|kimi|deepseek-v4|nemotron-4-340b|gpt-oss/.test(
      name
    )
  ) {
    tags.push("reasoning-code");
  }
  if (/flash|bolt|lightning|mini|instant|8b|4b|llama-3\.3-70b|qwen/.test(name)) {
    tags.push("fast");
  }
  if (tags.length === 0) tags.push("chat");

  return tags;
}

export function resolveProviderKey(
  provider: ProviderId,
  clientKey?: string
): string | undefined {
  const trimmed = clientKey?.trim();
  if (trimmed) return trimmed;
  const envName = PROVIDERS[provider].envVar;
  return process.env[envName]?.trim() || undefined;
}

export async function discoverModels(
  provider: ProviderId,
  apiKey: string
): Promise<DiscoveredModel[]> {
  const cfg = PROVIDERS[provider];
  const res = await fetch(cfg.modelsUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...cfg.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${cfg.name} failed (${res.status}): ${body.slice(0, 180)}`);
  }

  const json = await res.json();
  const list = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : [];

  return list
    .map((m: { id?: string; name?: string }) => m.id || m.name || "")
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b))
    .map((id: string) => ({
      provider,
      id,
      tags: classifyModel(id),
    }));
}

export interface FailoverCandidate {
  provider: ProviderId;
  model: string;
  apiKey?: string;
}

export interface FailoverAttempt {
  provider: ProviderId;
  model: string;
  status?: number;
  error?: string;
}

export async function callWithFailover(
  candidates: FailoverCandidate[],
  payload: Record<string, unknown>
): Promise<{
  provider: ProviderId;
  model: string;
  response: Response;
  attempts: FailoverAttempt[];
}> {
  const attempts: FailoverAttempt[] = [];

  for (const target of candidates) {
    const cfg = PROVIDERS[target.provider];
    const resolvedKey = resolveProviderKey(target.provider, target.apiKey);

    if (!cfg || !resolvedKey) {
      attempts.push({
        provider: target.provider,
        model: target.model,
        error: "Missing API key",
      });
      continue;
    }

    try {
      const res = await fetch(cfg.chatUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolvedKey}`,
          "Content-Type": "application/json",
          ...cfg.headers,
        },
        body: JSON.stringify({
          ...payload,
          model: target.model,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        return {
          provider: target.provider,
          model: target.model,
          response: res,
          attempts,
        };
      }

      const errText = await res.text().catch(() => "");
      attempts.push({
        provider: target.provider,
        model: target.model,
        status: res.status,
        error: errText.slice(0, 200),
      });

      // Fail over to next candidate on rate limit, unavailable/bad model, timeout, or 5xx
      if (
        res.status === 400 ||
        res.status === 403 ||
        res.status === 404 ||
        res.status === 408 ||
        res.status === 429 ||
        res.status >= 500
      ) {
        continue;
      }

      throw new Error(`${cfg.name} (${res.status}): ${errText.slice(0, 200)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      attempts.push({
        provider: target.provider,
        model: target.model,
        error: msg,
      });
    }
  }

  const summary = attempts
    .map((a) => `${a.provider}/${a.model}: ${a.status ?? ""} ${a.error ?? ""}`.trim())
    .join(" | ");
  throw new Error(summary || "All fallback providers exhausted");
}
