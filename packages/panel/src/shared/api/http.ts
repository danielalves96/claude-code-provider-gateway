import { request } from "./client.js";

export const http = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  put: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: "DELETE" }),
};
