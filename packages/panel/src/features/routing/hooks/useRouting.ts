import { useEffect, useState } from "react";
import { useSaveFeedback } from "../../../shared/hooks/useSaveFeedback.js";
import { EMPTY_RULE, TIERS } from "../constants.js";
import { routingService } from "../routingService.js";
import type { RoutingMap, RoutingOption, RoutingRule, Tier } from "../types.js";

const emptyMap = (): RoutingMap => ({
  default: { ...EMPTY_RULE },
  opus: { ...EMPTY_RULE },
  sonnet: { ...EMPTY_RULE },
  haiku: { ...EMPTY_RULE },
});

function sanitize(map: RoutingMap): RoutingMap {
  const out = { ...map };
  for (const tier of TIERS) {
    const r = out[tier];
    out[tier] = { ...r, enabled: r.enabled && !!r.providerId && !!r.model };
  }
  return out;
}

export function useRouting() {
  const [rules, setRules] = useState<RoutingMap>(emptyMap);
  const [thinking, setThinking] = useState(true);
  const [options, setOptions] = useState<RoutingOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { saving, saved, wrap } = useSaveFeedback();

  useEffect(() => {
    Promise.all([routingService.getConfig(), routingService.getOptions()])
      .then(([config, opts]) => {
        setRules({
          default: config.routing.default ?? { ...EMPTY_RULE },
          opus: config.routing.opus ?? { ...EMPTY_RULE },
          sonnet: config.routing.sonnet ?? { ...EMPTY_RULE },
          haiku: config.routing.haiku ?? { ...EMPTY_RULE },
        });
        setThinking(config.thinking.enabled);
        setOptions(opts);
      })
      .finally(() => setLoaded(true));
  }, []);

  const updateRule = (tier: Tier, patch: Partial<RoutingRule>) =>
    setRules((m) => ({ ...m, [tier]: { ...m[tier], ...patch } }));

  const save = async () => {
    const sanitized = sanitize(rules);
    await wrap(() => routingService.save(sanitized, thinking));
    setRules(sanitized);
  };

  return {
    rules,
    thinking,
    setThinking,
    options,
    updateRule,
    loaded,
    saving,
    saved,
    save,
  };
}
