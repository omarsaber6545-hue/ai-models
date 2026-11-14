"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  DiscoveredModel,
  FailoverCandidate,
  ModelTag,
  ProviderId,
} from "@/lib/ai-pool";

export type ToolRole =
  | "fastChat"
  | "vision"
  | "ocr"
  | "coder"
  | "councilJudge";

export interface ModelRef {
  provider: ProviderId;
  model: string;
}

export interface ServerProviderStatus {
  id: ProviderId;
  name: string;
  envVar: string;
  docsUrl: string;
  hasEnvKey: boolean;
}

interface StoredPoolState {
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, DiscoveredModel[]>>;
  roles: Partial<Record<ToolRole, ModelRef>>;
  councilMembers: ModelRef[];
}

const STORAGE_KEY = "ai-tools-hub-pool-v1";

const DEFAULT_STATE: StoredPoolState = {
  keys: {},
  models: {},
  roles: {},
  councilMembers: [],
};

interface PoolContextValue {
  keys: Partial<Record<ProviderId, string>>;
  modelsByProvider: Partial<Record<ProviderId, DiscoveredModel[]>>;
  allModels: DiscoveredModel[];
  roles: Partial<Record<ToolRole, ModelRef>>;
  councilMembers: ModelRef[];
  serverStatus: ServerProviderStatus[];
  setProviderKey: (provider: ProviderId, key: string) => void;
  setProviderModels: (provider: ProviderId, list: DiscoveredModel[]) => void;
  setRoleModel: (role: ToolRole, ref: ModelRef | undefined) => void;
  toggleCouncilMember: (ref: ModelRef) => void;
  buildCandidates: (role: ToolRole, override?: ModelRef) => FailoverCandidate[];
  hasAnyKey: boolean;
  clearAllLocal: () => void;
}

const PoolContext = createContext<PoolContextValue | null>(null);

function pickBestForTag(
  list: DiscoveredModel[],
  preferredTag: ModelTag,
  preferredNames: string[]
): ModelRef | undefined {
  for (const hint of preferredNames) {
    const match = list.find((m) => m.id.toLowerCase().includes(hint));
    if (match) return { provider: match.provider, model: match.id };
  }
  const byTag = list.find((m) => m.tags.includes(preferredTag));
  if (byTag) return { provider: byTag.provider, model: byTag.id };
  if (list[0]) return { provider: list[0].provider, model: list[0].id };
  return undefined;
}

export function PoolProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredPoolState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerProviderStatus[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredPoolState>;
        setState({
          keys: parsed.keys ?? {},
          models: parsed.models ?? {},
          roles: parsed.roles ?? {},
          councilMembers: parsed.councilMembers ?? [],
        });
      }
    } catch {
      // ignore corrupted local storage
    } finally {
      setHydrated(true);
    }

    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.providers)) {
          setServerStatus(data.providers);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state, hydrated]);

  const setProviderKey = useCallback((provider: ProviderId, key: string) => {
    setState((prev) => ({
      ...prev,
      keys: { ...prev.keys, [provider]: key },
    }));
  }, []);

  const setProviderModels = useCallback(
    (provider: ProviderId, list: DiscoveredModel[]) => {
      setState((prev) => {
        const nextModels = { ...prev.models, [provider]: list };
        const mergedAll = Object.values(nextModels).flat() as DiscoveredModel[];

        const nextRoles = { ...prev.roles };
        if (!nextRoles.fastChat) {
          nextRoles.fastChat = pickBestForTag(mergedAll, "fast", [
            "llama-3.3-70b-instruct",
            "llama-3.1-8b-instant",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gpt-4o-mini",
            "mistral-small",
            "qwen-2.5",
          ]);
        }
        if (!nextRoles.vision) {
          nextRoles.vision = pickBestForTag(mergedAll, "vision", [
            "minimax-m3.1-flash",
            "nemotron-3.5-super-vl",
            "mistral-large-4",
            "llama-3.2-90b-vision",
          ]);
        }
        if (!nextRoles.ocr) {
          nextRoles.ocr = pickBestForTag(mergedAll, "ocr", [
            "nemotron-parse-2.0",
            "nemotron-parse",
            "nemotron-3.5-parse",
            "minimax-m3.1-flash",
          ]);
        }
        if (!nextRoles.coder) {
          nextRoles.coder = pickBestForTag(mergedAll, "reasoning-code", [
            "mistral-large-4",
            "deepseek-v4.1-flash",
            "codestral",
            "nemotron-3-super",
            "laguna",
          ]);
        }
        if (!nextRoles.councilJudge) {
          nextRoles.councilJudge = pickBestForTag(mergedAll, "reasoning-code", [
            "mistral-large-4",
            "nemotron-3-ultra",
            "nemotron-3.1-nemotron-ultra",
            "kimi-k2.6",
          ]);
        }

        let nextCouncil = prev.councilMembers;
        if (nextCouncil.length === 0 && list.length > 0) {
          const picks = [
            pickBestForTag(mergedAll, "fast", [
              "minimax-m3.1-flash",
              "deepseek-v4.1-flash",
            ]),
            pickBestForTag(mergedAll, "reasoning-code", [
              "nemotron-3-super",
              "kimi-k2.6",
              "mistral-large-4",
            ]),
            pickBestForTag(mergedAll, "chat", [
              "glm-5.3-flash",
              "gemma-4-31b-it",
              "gpt-oss-20b",
            ]),
          ].filter(Boolean) as ModelRef[];

          const unique = new Map<string, ModelRef>();
          for (const p of picks) {
            unique.set(`${p.provider}:${p.model}`, p);
          }
          nextCouncil = Array.from(unique.values());
        }

        return {
          ...prev,
          models: nextModels,
          roles: nextRoles,
          councilMembers: nextCouncil,
        };
      });
    },
    []
  );

  const setRoleModel = useCallback(
    (role: ToolRole, ref: ModelRef | undefined) => {
      setState((prev) => ({
        ...prev,
        roles: { ...prev.roles, [role]: ref },
      }));
    },
    []
  );

  const toggleCouncilMember = useCallback((ref: ModelRef) => {
    setState((prev) => {
      const exists = prev.councilMembers.some(
        (m) => m.provider === ref.provider && m.model === ref.model
      );
      const next = exists
        ? prev.councilMembers.filter(
            (m) => !(m.provider === ref.provider && m.model === ref.model)
          )
        : [...prev.councilMembers, ref].slice(0, 5);
      return { ...prev, councilMembers: next };
    });
  }, []);

  const allModels = useMemo(() => {
    return Object.values(state.models).flat() as DiscoveredModel[];
  }, [state.models]);

  const buildCandidates = useCallback(
    (role: ToolRole, override?: ModelRef): FailoverCandidate[] => {
      const list: FailoverCandidate[] = [];
      const seen = new Set<string>();

      const pushCandidate = (ref?: ModelRef) => {
        if (!ref) return;
        const key = `${ref.provider}:${ref.model}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push({
          provider: ref.provider,
          model: ref.model,
          apiKey: state.keys[ref.provider],
        });
      };

      pushCandidate(override);
      pushCandidate(state.roles[role]);

      // Add up to 3 automatic fallbacks from discovered models
      const tagMap: Record<ToolRole, ModelTag> = {
        fastChat: "fast",
        vision: "vision",
        ocr: "ocr",
        coder: "reasoning-code",
        councilJudge: "reasoning-code",
      };
      const desiredTag = tagMap[role];

      const chatSafeModels = allModels.filter(
        (m) =>
          !m.tags.includes("embed") &&
          !m.tags.includes("safety") &&
          !m.tags.includes("ocr")
      );

      for (const m of chatSafeModels) {
        if (list.length >= 4) break;
        if (m.tags.includes(desiredTag)) {
          pushCandidate({ provider: m.provider, model: m.id });
        }
      }
      for (const m of chatSafeModels) {
        if (list.length >= 4) break;
        pushCandidate({ provider: m.provider, model: m.id });
      }

      return list;
    },
    [state.keys, state.roles, allModels]
  );

  const hasAnyKey = useMemo(() => {
    const clientHas = Object.values(state.keys).some((v) => Boolean(v?.trim()));
    const serverHas = serverStatus.some((s) => s.hasEnvKey);
    return clientHas || serverHas;
  }, [state.keys, serverStatus]);

  const clearAllLocal = useCallback(() => {
    setState(DEFAULT_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <PoolContext.Provider
      value={{
        keys: state.keys,
        modelsByProvider: state.models,
        allModels,
        roles: state.roles,
        councilMembers: state.councilMembers,
        serverStatus,
        setProviderKey,
        setProviderModels,
        setRoleModel,
        toggleCouncilMember,
        buildCandidates,
        hasAnyKey,
        clearAllLocal,
      }}
    >
      {children}
    </PoolContext.Provider>
  );
}

export function usePool() {
  const ctx = useContext(PoolContext);
  if (!ctx) throw new Error("usePool must be used inside PoolProvider");
  return ctx;
}
