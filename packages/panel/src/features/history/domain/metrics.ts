import { stripModelPrefix } from "./format.js";
import { providerLabel } from "./labels.js";
import type { Session } from "./types.js";

export interface TopProviderInfo {
  id: string;
  name: string;
  requests: number;
}

export interface TopModelInfo {
  name: string;
  requests: number;
}

export function getTopProviderInfo(sessions: Session[]): TopProviderInfo | null {
  const counts: Record<string, number> = {};

  for (const session of sessions) {
    for (const [provider, stat] of Object.entries(session.providerStats ?? {})) {
      counts[provider] = (counts[provider] ?? 0) + stat.requests;
    }
  }

  const top = getHighestCount(counts);
  if (!top) return null;

  return {
    id: top.name,
    name: providerLabel(top.name),
    requests: top.count,
  };
}

export function getTopModelInfo(sessions: Session[]): TopModelInfo | null {
  const counts: Record<string, number> = {};

  for (const session of sessions) {
    for (const [model, stat] of Object.entries(session.modelStats ?? {})) {
      const key = stripModelPrefix(model);
      counts[key] = (counts[key] ?? 0) + stat.requests;
    }
  }

  const top = getHighestCount(counts);
  if (!top) return null;

  return {
    name: top.name,
    requests: top.count,
  };
}

function getHighestCount(counts: Record<string, number>): { name: string; count: number } | null {
  let topName: string | null = null;
  let topCount = 0;

  for (const [name, count] of Object.entries(counts)) {
    if (count > topCount) {
      topName = name;
      topCount = count;
    }
  }

  return topName ? { name: topName, count: topCount } : null;
}
