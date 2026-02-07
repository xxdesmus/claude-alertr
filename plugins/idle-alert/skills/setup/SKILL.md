# /idle-alert:setup

Walk the user through configuring claude-alertr. This skill replaces the interactive prompts from `install.sh`.

## Steps

### 1. Gather configuration

Ask the user for these three values (use AskUserQuestion or conversational prompts):

- **Worker URL** — The URL of their deployed claude-alertr Cloudflare Worker (e.g. `https://claude-alertr.you.workers.dev`). Required.
- **Auth Token** — The AUTH_TOKEN secret set on the Worker via `wrangler secret put AUTH_TOKEN`. Required.
- **Alert Delay** — Seconds to wait before sending an alert. Default: `60`. Optional.

### 2. Write the config file

Create `~/.claude-alertr/config` with these contents (replace values with user input):

```
# claude-alertr configuration

# URL of your deployed claude-alertr Cloudflare Worker
CLAUDE_ALERTR_URL="<worker_url>"

# Auth token (must match AUTH_TOKEN secret on the Worker)
CLAUDE_ALERTR_TOKEN="<auth_token>"

# Seconds to wait before sending an alert (default: 60)
CLAUDE_ALERTR_DELAY="<delay>"
```

Create the directory first (`mkdir -p ~/.claude-alertr`) and set permissions (`chmod 600 ~/.claude-alertr/config`).

### 3. Test the connection

Run a test request against the Worker:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer <auth_token>" \
  <worker_url>/test
```

Interpret the result:
- **200** — Connected successfully. Tell the user to check their notification channels.
- **401** — Auth token doesn't match. Ask them to verify it matches what's set on the Worker.
- **503** — AUTH_TOKEN not configured on the Worker. Tell them to run `wrangler secret put AUTH_TOKEN`.
- **500** — Connected but no notification channels configured. Tell them to set `WEBHOOK_URL` or `RESEND_API_KEY` via `wrangler secret put`.
- **Connection error** — Worker URL may be wrong or Worker isn't deployed.

### 4. Confirm setup

Tell the user:
- claude-alertr is configured and will alert them after **{delay}** seconds of inactivity
- Config is stored at `~/.claude-alertr/config`
- The plugin hooks are automatically registered — no manual `settings.json` editing needed
- To change settings later, edit `~/.claude-alertr/config` or run `/idle-alert:setup` again
