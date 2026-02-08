# claude-alertr

Get notified when [Claude Code](https://docs.anthropic.com/en/docs/claude-code) is waiting for your input.

When Claude hits a permission prompt or asks a question, claude-alertr waits a configurable delay (default: 60s) and then sends you an alert via Slack, Discord, or email — including what Claude is waiting on and which machine it's running on.

> **Disclaimer:** This is an independent, community-built tool. It is not affiliated with, endorsed by, or supported by Anthropic. Use of Claude Code is subject to Anthropic's [Terms of Service](https://www.anthropic.com/terms).

## How It Works

Two local shell hooks monitor Claude Code. When Claude is blocked waiting for you, a background timer starts. If you don't respond in time, the hook POSTs to a Cloudflare Worker you deploy, which relays the alert to your notification channels. When you respond, the timer is automatically cancelled.

```
Claude Code (local)                      Cloudflare Worker (relay)
┌──────────────┐                        ┌──────────────┐
│ Hook fires   │── delay ── curl POST ──│ /alert       │──▶ Slack / Discord webhook
│ on prompt    │                        │              │──▶ Email via Resend
│ Hook cancels │                        └──────────────┘
│ on response  │
└──────────────┘
```

## Quick Start

### 1. Deploy the Worker

```bash
git clone https://github.com/xxdesmus/claude-alertr.git
cd claude-alertr
npm install
npx wrangler login   # if not already authenticated
npm run deploy
```

Note the Worker URL printed (e.g., `https://claude-alertr.<you>.workers.dev`).

### 2. Set Worker secrets

```bash
# Required — protects your Worker from unauthorized use
wrangler secret put AUTH_TOKEN

# At least one notification channel:
wrangler secret put WEBHOOK_URL          # Slack or Discord webhook URL
# — or —
wrangler secret put RESEND_API_KEY       # Email via Resend
wrangler secret put ALERT_EMAIL_TO       # Recipient email address
```

### 3. Install the plugin

In Claude Code:

```
/plugin marketplace add xxdesmus/claude-alertr
/plugin install claude-alertr@xxdesmus-claude-alertr
/claude-alertr:setup
```

The setup wizard walks you through entering your Worker URL, auth token, and alert delay — then tests the connection. Hooks are auto-registered.

> **Tip:** Visit `https://<your-worker>.workers.dev/setup` for a browser-based setup wizard as an alternative.

### 4. Test it

```bash
curl -X POST \
  -H "Authorization: Bearer <your-token>" \
  https://<your-worker>.workers.dev/test
```

You should receive a notification within seconds.

## Configuration

Config lives at `~/.claude-alertr/config`:

| Setting | Description | Default |
|---------|-------------|---------|
| `CLAUDE_ALERTR_URL` | Your deployed Worker URL | *(required)* |
| `CLAUDE_ALERTR_TOKEN` | Auth token (must match Worker's `AUTH_TOKEN` secret) | *(required)* |
| `CLAUDE_ALERTR_DELAY` | Seconds to wait before alerting (15–300) | `60` |

## Notification Channels

Both channels can be active simultaneously.

**Webhook (Slack / Discord):** Set `WEBHOOK_URL` on the Worker. Alerts are sent as JSON with a `text` field compatible with Slack and Discord incoming webhooks. Example:

```
[macbook-pro] Claude Code is waiting for your input (permission_prompt)
Pull latest changes from GitHub: git pull
```

**Email (via Resend):** Set `RESEND_API_KEY` and `ALERT_EMAIL_TO` on the Worker. Optionally set `ALERT_EMAIL_FROM` (defaults to `alerts@resend.dev`). Sends a styled HTML email with type, details, project, host, and session info.

## Alert Payload

The hook sends a JSON payload to the Worker's `/alert` endpoint:

```json
{
  "session_id": "abc123",
  "notification_type": "permission_prompt",
  "message": "Claude needs your permission to use Bash",
  "details": "Pull latest changes from GitHub: git pull",
  "cwd": "/path/to/project",
  "hostname": "macbook-pro",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

The `details` field is automatically extracted from the session transcript — it contains the specific tool call or question Claude is waiting on. The `hostname` identifies which machine triggered the alert.

## Notification Types

| Type | When it fires |
|------|---------------|
| `permission_prompt` | Claude needs permission to run a tool |
| `elicitation_dialog` | Claude is asking you a question |

`idle_prompt` (Claude finished and is waiting for your next prompt) is intentionally excluded — it fires after every completed response.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | No | Health check |
| `GET` | `/setup` | No | Interactive setup wizard |
| `POST` | `/alert` | Yes | Forward alert to configured channels |
| `POST` | `/test` | Yes | Send a test notification |

## Alternative Install

If you prefer not to use the plugin marketplace:

```bash
./install.sh
```

This copies hook scripts, creates a config file, and registers hooks in Claude Code's settings.

## Uninstalling

Plugin installs: remove the plugin from Claude Code.

Manual installs:
```bash
./uninstall.sh
```

To also remove the Worker: `wrangler delete claude-alertr`

## Development

```bash
npm run dev          # Local dev server
npx vitest run       # Run tests
npx tsc --noEmit     # Type check
npm run deploy       # Deploy to Cloudflare
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/) (free tier works)
- [`jq`](https://jqlang.github.io/jq/) and [`curl`](https://curl.se/) installed locally

## License

[MIT](LICENSE)
