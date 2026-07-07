const API = import.meta.env.VITE_API;

/**
 * Wraps fetch with the backend's actual contract:
 * - base URL from VITE_API
 * - every authenticated request needs an `x-session-token` header
 *   (the backend has no JWT / cookies — see api/users.js + README)
 * - JSON body in, JSON or text out, non-2xx throws with the response body
 *   as the message so callers can show it directly.
 */
async function request(path, { method = "GET", body, sessionToken } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (sessionToken) headers["x-session-token"] = sessionToken;

  const response = await fetch(API + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string" ? payload : payload?.message || response.statusText;
    throw new Error(message || `Request to ${path} failed (${response.status}).`);
  }

  return payload;
}

export const api = {
  get: (path, sessionToken) => request(path, { method: "GET", sessionToken }),
  post: (path, body, sessionToken) => request(path, { method: "POST", body: body ?? {}, sessionToken }),
  delete: (path, sessionToken) => request(path, { method: "DELETE", sessionToken }),
};

export const API_BASE = API;
