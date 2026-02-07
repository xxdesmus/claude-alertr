# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Local dev server (wrangler dev)
npm run deploy       # Deploy to Cloudflare Workers
npx vitest run       # Run tests once
npx vitest           # Run tests in watch mode
npx tsc --noEmit     # Type check without emitting
```

Deploy requires specifying the account (multiple accounts on this Cloudflare login):
```bash
CLOUDFLARE_ACCOUNT_ID=f6de64c1af101c33b6d229d3c9cdfcb9 npm run deploy
```

Production URL: `https://claude-alertr.unemployed.workers.dev`

Worker secrets are managed via `wrangler secret put <NAME>` (AUTH_TOKEN, WEBHOOK_URL, RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM). Prefix with `CLOUDFLARE_ACCOUNT_ID=...` when multiple accounts are present.

## Architecture

This is a two-component system that alerts users when Claude Code is idle:

**Cloudflare Worker** (`src/index.ts`) — The main Worker that receives alert payloads and forwards them to webhook URLs (Slack/Discord) and/or email (via Resend API). Tests alongside in `src/index.test.ts`. Routes: `GET /` (health), `GET /setup` (setup wizard), `POST /alert` (forward notification), `POST /test` (send test alert).

**Setup wizard** (`src/setup-page.ts`) — A self-contained HTML/CSS/JS page served at `/setup`. No framework or build step — just a template literal returning the full page. The wizard guides users through connection testing, delay configuration, and install command generation.

**Local shell hooks** (`hooks/`) — Two bash scripts installed into Claude Code's hook system:
- `idle-alert.sh` runs on `Notification` events. It starts a background `sleep` timer; if the user doesn't respond within the delay (default 60s), it POSTs to the Worker's `/alert` endpoint.
- `dismiss-alert.sh` runs on `UserPromptSubmit` events. It kills the pending timer and removes the marker file.

The hooks communicate via files in `/tmp/claude-alertr/` (one file per session_id, plus a .pid file for the timer process).

## Security Conventions

- **Auth is mandatory**: `checkAuth()` returns 503 if AUTH_TOKEN is not set (fail-closed). All mutation endpoints require Bearer token auth.
- **HTML escaping**: All user-controlled values in email templates must go through `escapeHtml()` before interpolation.
- **Timing-safe auth**: Token comparison uses SHA-256 digest to prevent timing side-channels.
- **Session ID sanitization**: Shell hooks strip all characters except `[a-zA-Z0-9_-]` from session_id before using it in file paths.
- **Config parsing**: The hooks read `~/.claude-alertr/config` via `grep`/`cut` (not `source`) to avoid arbitrary code execution.
- **CI/CD**: GitHub Actions workflows must pass secrets and step outputs through `env:` blocks, never inline `${{ }}` interpolation in `run:` scripts. Use `jq -n --arg` to build JSON bodies safely.
- **Hook merging**: `install.sh` and `uninstall.sh` merge/remove only claude-alertr entries in Claude Code settings, preserving other hooks.
