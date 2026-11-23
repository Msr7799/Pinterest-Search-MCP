# Pinterest MCP — Vercel request diagnostics

This folder is the **Vercel Root Directory** (`src` in the GitHub repository).
Use the **Other** framework preset; the `vercel.json` file also enforces it.
Do not point Vercel at `src/server.js`: that entrypoint is for local stdio MCP,
not HTTP requests.

## HTTP endpoints

| URL | Method | Purpose |
| --- | --- | --- |
| `/mcp` (or `/api/mcp`) | POST | Stateless MCP Streamable HTTP: `initialize`, `tools/list`, `tools/call` |
| `/health` (or `/api/health`) | GET | Readiness and authentication mode |
| `/health?check=pinterest` | GET | Make a live Pinterest connectivity check |

`GET /mcp` deliberately returns HTTP 405 in stateless mode to avoid holding a
stream open until Vercel times out. Use POST from a real MCP client. Request logs record a random
`request_id`, HTTP method, route, status, and duration without request bodies,
cookies, search queries, or bearer tokens. Match `X-Request-Id` in the response
to the Vercel runtime logs.

## Authentication

- Private mode (default): set sensitive `MCP_AUTH_TOKEN`. Requests require
  `Authorization: Bearer <token>`.
- ChatGPT custom plugin with **No authentication**: set
  `MCP_PUBLIC_READONLY=true` in the Vercel environment and redeploy. This
  explicitly makes the endpoint public, so do **not** enable downloads or other
  write tools in this mode. The public MCP exposes search, pin inspection,
  board inspection, previews, and diagnostics, not file downloads.

These modes deliberately do not implement OAuth; selecting OAuth in ChatGPT's
plugin form will not work without a separately implemented OAuth flow.

## Request diagnosis

1. `GET /health` must return HTTP 200 and `status: ready`.
2. `GET /health?check=pinterest` should return HTTP 200 with
   `checks.pinterest.status: reachable`; this checks only HTTP reachability,
   not Pinterest's private JSON APIs.
3. From an MCP client, run `initialize`, `tools/list`, and
   `tools/call` with `pinterest_diagnostics`.
4. Finally call `pinterest_search` with a small limit (e.g. 3), then test
   a real public pin and board.
5. Inspect Vercel runtime logs by status and `request_id`. The Pin resource
   endpoints are unofficial and can change or require login at any time.

When Pinterest blocks `RelatedModulesResource` with `Login required`, the
related-pins tool explicitly reports `source: keyword_fallback`; those results
are **not** guaranteed to be visually similar.
