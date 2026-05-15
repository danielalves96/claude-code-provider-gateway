import type { CavemanLevel } from "../../config/schema.js";
import type { MessagesRequest } from "../../core/anthropic/types.js";

const SEP = "\n\n";

type SystemBlock = { type: "text"; text: string; cache_control?: unknown };

const SHARED_BOUNDARIES =
  "Code blocks, file paths, commands, errors, URLs: keep exact. Security warnings, irreversible action confirmations, multi-step ordered sequences: write normal. Resume terse style after.";

const CAVEMAN_PROMPTS: Record<CavemanLevel, string> = {
  lite: [
    "Respond tersely. Keep grammar and full sentences but drop filler, hedging and pleasantries.",
    "Pattern: state the thing, the action, the reason. Then next step.",
    SHARED_BOUNDARIES,
    "Active every response until user asks for normal mode.",
  ].join(" "),
  full: [
    "Respond like terse caveman. All technical substance stay exact, only fluff die.",
    "Drop articles, filler, pleasantries, hedging. Fragments OK. Short synonyms.",
    "Pattern: thing action reason. next step.",
    SHARED_BOUNDARIES,
    "Active every response until user asks for normal mode.",
  ].join(" "),
  ultra: [
    "Respond ultra-terse. Maximum compression. Telegraphic.",
    "Abbreviate DB/auth/config/req/res/fn/impl, strip conjunctions, use arrows for causality.",
    "Pattern: thing -> result. fix.",
    SHARED_BOUNDARIES,
    "Active every response until user asks for normal mode.",
  ].join(" "),
};

export function injectCaveman(req: MessagesRequest, enabled: boolean, level: CavemanLevel): void {
  if (!enabled) return;
  const prompt = CAVEMAN_PROMPTS[level];
  if (!prompt) return;

  if (typeof req.system === "string") {
    req.system = req.system ? `${req.system}${SEP}${prompt}` : prompt;
    return;
  }

  if (Array.isArray(req.system)) {
    const block: SystemBlock = { type: "text", text: prompt };
    let lastCacheIdx = -1;
    for (let i = req.system.length - 1; i >= 0; i -= 1) {
      if ((req.system[i] as SystemBlock).cache_control !== undefined) {
        lastCacheIdx = i;
        break;
      }
    }
    if (lastCacheIdx >= 0) req.system.splice(lastCacheIdx, 0, block);
    else req.system.push(block);
    return;
  }

  req.system = prompt;
}
