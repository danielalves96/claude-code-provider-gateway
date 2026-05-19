import type { Session } from "./types.js";

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? `today ${d.toLocaleTimeString()}`
    : d.toLocaleString();
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function commandFor(session: Session): string {
  if (session.launchHint === "all") return "ccpg --all";
  return `ccpg --${session.launchHint.replace(/_/g, "")}`;
}

export function topModel(session: Session): string | null {
  const models = Object.entries(session.modelStats ?? {}).sort(
    ([, a], [, b]) => b.requests - a.requests,
  );
  return models[0]?.[0] ?? [...(session.requestLog ?? [])].reverse()[0]?.requestedModel ?? null;
}
