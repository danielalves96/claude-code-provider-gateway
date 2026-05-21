import type { Config } from "../../config/schema.js";
import type { MessagesRequest } from "../../core/anthropic/types.js";
import { logger } from "../../observability/log.js";
import type { TokenSaverStats } from "../../runtime/session-types.js";
import { injectCaveman } from "../token-savers/caveman.js";
import { compressMessages, formatRtkLog } from "../token-savers/rtk.js";

export function applyTokenSavers(
  req: MessagesRequest,
  config: Config,
): { req: MessagesRequest; stats: TokenSaverStats | undefined } {
  const { tokenSavers } = config;
  const rtkStats = compressMessages(req, tokenSavers.rtkEnabled);
  const rtkLine = formatRtkLog(rtkStats);
  if (rtkLine) logger.info("rtk", rtkLine);

  injectCaveman(req, tokenSavers.cavemanEnabled, tokenSavers.cavemanLevel);
  if (tokenSavers.cavemanEnabled) {
    logger.info("caveman", `system prompt injected (${tokenSavers.cavemanLevel})`);
  }

  if (!rtkStats && !tokenSavers.cavemanEnabled) return { req, stats: undefined };

  const stats: TokenSaverStats = {
    rtkBytesBefore: rtkStats?.bytesBefore ?? 0,
    rtkBytesAfter: rtkStats?.bytesAfter ?? 0,
    rtkHits: rtkStats?.hits.length ?? 0,
    rtkFilters: rtkStats ? Array.from(new Set(rtkStats.hits.map((hit) => hit.filter))) : [],
    cavemanLevel: tokenSavers.cavemanEnabled ? tokenSavers.cavemanLevel : null,
  };
  return { req, stats };
}
