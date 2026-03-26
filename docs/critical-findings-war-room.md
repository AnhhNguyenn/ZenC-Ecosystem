# ZenC War Room Checklist

50 critical issues grouped into 6 areas. Treat this as a fix-tracking sheet, not as verified truth. Each item should be confirmed against the current code before closing.

## Group 1: Financial and Business Risk

- [ ] Infinite free usage: `handleConnection` does not block users with `tokenBalance <= 0`.
- [ ] Billing on graceful exit only: charging happens in session cleanup, so crashes or abrupt disconnects can create unpaid provider usage.
- [ ] Broken token deduction logic: SQL clamps deduction to zero when the user balance is already zero, which does not protect revenue.
- [ ] Silent tier downgrade on DB failure: loading failures appear to default PRO users to FREE and A1-like fallback behavior.
- [ ] Hardcoded billing assumptions: token or audio charging depends on fixed audio throughput assumptions and can drift across microphone sample rates.
- [ ] Token watchdog is only advisory in `voice.gateway.ts`: over-threshold usage emits an error event but does not stop forwarding audio or disconnect the client.
- [ ] Stale tier claims in JWT payloads: access tokens embed `tier`, so upgrades or downgrades can remain inconsistent for up to the token lifetime unless tier is re-checked from cache or storage.

## Group 2: Crash, OOM, and Availability Risk

- [ ] Unhandled promise rejection in provider switching: async event listeners can terminate the Node.js process if errors are not contained.
- [ ] OOM via oversized audio payloads: socket audio buffers appear to accept arbitrary payload size without an upper bound.
- [ ] Event-loop DDoS via websocket spam: `audio_chunk` traffic does not appear to be rate-limited per socket or per user.
- [ ] Redis adapter crash path: Redis connection errors are not handled defensively enough and may cascade into gateway instability.
- [ ] Redis key buildup from realtime grammar flow: poll/read paths do not reliably delete temporary keys after use.
- [ ] Zombie sessions and leaked TCP state: missing heartbeat or stale-session eviction can leave dead connections and stale in-memory state behind.
- [ ] Transcript accumulation has poor memory behavior in `voice.gateway.ts`: repeated string concatenation for long sessions creates excessive allocations and GC pressure.

## Group 3: Frontend and Backend Contract Breakage

- [ ] Refresh token contract mismatch: frontend sends refresh through cookie flow while backend expects refresh token in request body.
- [ ] API versioning mismatch: gateway serves `/api/v1/...` while frontend appears to call unversioned paths like `/api/auth/refresh`.
- [ ] Invalid public URL configuration: `NEXT_PUBLIC_*` values reference internal Docker hostnames that browsers cannot resolve outside the container network.
- [ ] Refresh race condition in Axios: multiple simultaneous 401 responses can trigger parallel refresh calls and force logout.
- [ ] Cross-user token contamination in SSR: global in-memory access token state risks leaking one user's token into another request on the server.
- [ ] FastAPI request validation is bypassed in `apps/ai-worker/main.py`: POST endpoints accept raw `dict` payloads, so missing fields degrade into `KeyError` and 500s instead of typed 422 responses and documented OpenAPI schemas.

## Group 4: Security and Data Integrity

- [ ] Dangerous `synchronize` behavior risk: an environment mistake could enable destructive schema sync behavior against real data.
- [ ] Over-trusting implicit conversion: DTO coercion is too permissive and needs review for unsafe parsing and validation bypasses.
- [ ] Websocket auth bypass for banned or deleted users: socket connection flow may not re-check `status`, `isDeleted`, or token validity strongly enough.
- [ ] Prompt injection through raw user context: user-controlled values are inserted into system prompts without strong sanitization or isolation.
- [ ] Open internal APIs: gateway CORS is too permissive and worker endpoints appear callable without auth.
- [ ] Transcript loss through fire-and-forget Redis Pub/Sub: critical learning data can disappear if delivery is not durable.
- [ ] Unicode corruption risk in SQL Server: Vietnamese text handling must be verified for `NVARCHAR` end to end.
- [ ] Global exception filter leaks raw internals in `global-exception.filter.ts`: unexpected exceptions may expose database details, connection failures, or filesystem paths to clients.
- [ ] Refresh-token theft handling is incomplete in `auth.service.ts`: clearing the stored refresh-token hash does not immediately revoke already-issued access tokens.
- [ ] Login timing leaks account existence in `auth.service.ts`: requests for nonexistent users return faster than bcrypt comparisons for real users, enabling user enumeration by latency.
- [ ] Bcrypt 72-byte truncation is not mitigated in `auth.service.ts`: long passwords may be silently truncated unless pre-hashed before bcrypt.

## Group 5: Architecture and Deployment Failure Modes

- [ ] In-memory socket session state: session ownership is not externalized, so horizontal scaling breaks consistency.
- [ ] Scheduler duplication across replicas: worker cron jobs lack distributed locking and can execute multiple times when scaled out.
- [ ] Worker event loop blocked by heavy synchronous tasks: CPU-heavy analytics, audio parsing, or report generation can starve realtime APIs.
- [ ] False healthy worker state: startup failures for Redis or Qdrant are treated as non-fatal even when functionality is unavailable.
- [ ] RAG not connected to the voice path: Qdrant may exist, but the realtime conversation flow does not actually consume retrieval context.
- [ ] DB pool bottleneck: configured connection pool limits are likely too small for the intended concurrency profile.
- [ ] Sentry blind bootstrap path: monitoring is initialized before configuration is fully available, reducing observability at startup.
- [ ] Cronjob failures may bypass Sentry in `apps/ai-worker/main.py`: `AsyncIOScheduler` background jobs need explicit error capture or wrappers so crashes appear in monitoring.

## Group 6: Deep Infrastructure and Reliability Debt

- [ ] Blocking password hashing on the gateway event loop: auth flows must use async bcrypt calls, not sync hashing.
- [ ] User and profile creation without transaction safety: partial writes can create orphaned accounts that cannot recover cleanly.
- [ ] Registration has a duplicate-email race in `auth.service.ts`: `findOne` followed by hash and save is not atomic and can collapse into 500s or duplicate records under concurrent requests.
- [ ] Public Qdrant exposure: port `6333` is exposed without obvious API-key protection or network restriction.
- [ ] Unpaginated admin or leaderboard queries: list endpoints risk loading unbounded result sets into memory.
- [ ] Refresh-token cookie flags need review: `Secure`, `HttpOnly`, and `SameSite` protections must be verified and enforced.
- [ ] Missing DTO length limits: large string payloads can pressure validation, parsing, and memory usage.
- [ ] Missing outbound timeout policy for AI providers: hung Gemini or OpenAI requests can exhaust sockets and worker capacity.
- [ ] Proxy and IP trust misconfiguration: rate limiting can misbehave behind reverse proxies without explicit trust configuration.
- [ ] Unsafe fallback secrets: JWT setup must fail closed when required secrets are missing.
- [ ] Batch-update and deadlock risk in SM-2 cron processing: per-user update loops can create slow jobs, lock contention, and deadlocks.

## Operating Rule

Do not close an item with "looks fine." For every closed item, record:

- the file or files reviewed
- the exact fix applied
- the test or verification used
- the residual risk, if any
