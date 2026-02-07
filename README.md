# claude-alertr

A Claude Code plugin that alerts you when Claude has been waiting for your input for more than 1 minute. Get notified via **webhook** (Slack, Discord, etc.) or **email** so you never leave Claude hanging.

## How It Works

```
Claude Code is waiting ──► Notification hook fires ──► 60s timer starts
                                                            │
User responds? ──► Dismiss hook cancels timer               │
                                                            │
                                          Timer expires ──► Worker sends alert
                                                            │
                                              ┌─────────────┴──────────────┐
                                              ▼                            ▼
                                         Webhook POST                Email (Resend)
                                      (Slack, Discord, etc.)
```

**Two components:**

1. **Cloudflare Worker** — A lightweight relay service that receives alerts and forwards them to your webhook URL and/or email
2. **Claude Code hooks** — Local shell scripts that detect when Claude is idle, wait 60 seconds, then fire if you still haven't responded

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/) (free tier works)
- [`jq`](https://jqlang.github.io/jq/) installed locally
- [`curl`](https://curl.se/) installed locally
- (Optional) [Resend](https://resend.com/) account for email alerts

## Quick Start

### 1. Clone and install dependencies

```bash
git clone https://github.com/xxdesmus/claude-alertr.git
cd claude-alertr
npm install
```

### 2. Deploy the Worker

```bash
npx wrangler login
npm run deploy
```

Note the URL printed (e.g., `https://claude-alertr.<you>.workers.dev`).

### 3. Configure notification channels

Set at least one of these:

**Webhook (Slack, Discord, any URL):**
```bash
npx wrangler secret put WEBHOOK_URL
# Paste your webhook URL when prompted
```

**Email (via Resend):**
```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ALERT_EMAIL_TO
# Optionally customize the sender:
npx wrangler secret put ALERT_EMAIL_FROM
```

**(Optional) Secure the endpoint:**
```bash
npx wrangler secret put AUTH_TOKEN
# Choose a random token. The hook scripts will send it as a Bearer token.
```

### 4. Install hooks into Claude Code

```bash
./install.sh
```

The installer will:
- Copy hook scripts to `~/.claude-alertr/hooks/`
- Prompt you for your Worker URL and auth token
- Add hooks to your global Claude Code settings (`~/.claude/settings.json`)

### 5. Test it

```bash
curl -X POST https://claude-alertr.<you>.workers.dev/test
# You should receive a webhook/email within seconds
```

## Configuration

All local configuration lives in `~/.claude-alertr/config`:

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_ALERTR_URL` | Your deployed Worker URL | (required) |
| `CLAUDE_ALERTR_TOKEN` | Bearer token for authentication | (empty) |
| `CLAUDE_ALERTR_DELAY` | Seconds to wait before alerting | `60` |

Edit it directly:
```bash
nano ~/.claude-alertr/config
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check — shows status and configured channels |
| `POST` | `/alert` | Receive an alert and forward to configured channels |
| `POST` | `/test` | Send a test notification through all configured channels |

### Alert payload format

```json
{
  "session_id": "abc123",
  "notification_type": "idle_prompt",
  "message": "Claude needs your attention",
  "title": "Permission needed",
  "cwd": "/path/to/project",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Webhook output format

The Worker forwards alerts as a JSON POST:

```json
{
  "text": "Claude Code is waiting for your input (idle_prompt)",
  "session_id": "abc123",
  "notification_type": "idle_prompt",
  "message": "Claude needs your attention",
  "project": "/path/to/project",
  "waiting_since": "2025-01-15T10:30:00Z"
}
```

The `text` field is compatible with Slack and Discord incoming webhooks.

## Notification Types

| Type | When it fires |
|------|---------------|
| `idle_prompt` | Claude finished and is waiting for your next prompt |
| `permission_prompt` | Claude needs permission to run a tool |
| `elicitation_dialog` | Claude is asking you a question |

## Uninstall

```bash
./uninstall.sh
```

This removes the hooks from Claude Code settings and deletes `~/.claude-alertr/`. To also remove the Worker:

```bash
npx wrangler delete claude-alertr
```

## Development

```bash
npm run dev     # Start local dev server
npm run test    # Run tests
npm run deploy  # Deploy to Cloudflare
```

## License

MIT
