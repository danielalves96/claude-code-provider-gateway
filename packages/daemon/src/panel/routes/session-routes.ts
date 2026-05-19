import type { Hono } from "hono";
import {
  attachSessionProcess,
  clearArchivedSessions,
  deleteArchivedSession,
  endSession,
  getCurrentSession,
  heartbeatSession,
  listArchivedSessions,
} from "../../runtime/sessions.js";
import type { SessionsResponse } from "../contracts.js";

export function registerSessionRoutes(app: Hono): void {
  app.get("/api/sessions", (c) => {
    const response = {
      current: getCurrentSession(),
      archive: listArchivedSessions(),
    } satisfies SessionsResponse;
    return c.json(response);
  });

  app.delete("/api/sessions", (c) => {
    clearArchivedSessions();
    const response = {
      ok: true,
      current: getCurrentSession(),
      archive: listArchivedSessions(),
    } satisfies SessionsResponse & { ok: true };
    return c.json(response);
  });

  app.delete("/api/sessions/:id", (c) => {
    const id = c.req.param("id");
    const deleted = deleteArchivedSession(id);
    return c.json({ ok: deleted, archive: listArchivedSessions() });
  });

  app.post("/api/launch/end", async (c) => {
    const body = await c.req
      .json<{ sessionId?: string }>()
      .catch(() => ({}) as { sessionId?: string });
    return c.json({ ok: endSession(body.sessionId) });
  });

  app.post("/api/launch/heartbeat", async (c) => {
    const body = await c.req
      .json<{ sessionId?: string }>()
      .catch(() => ({}) as { sessionId?: string });
    return c.json({ ok: heartbeatSession(body.sessionId) });
  });

  app.post("/api/launch/attach", async (c) => {
    const body = await c.req
      .json<{ sessionId?: string; pid?: number }>()
      .catch(() => ({}) as { sessionId?: string; pid?: number });
    return c.json({ ok: attachSessionProcess(body.sessionId, body.pid) });
  });
}
