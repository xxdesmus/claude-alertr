export interface Env {
  WEBHOOK_URL?: string;
  RESEND_API_KEY?: string;
  ALERT_EMAIL_TO?: string;
  ALERT_EMAIL_FROM?: string;
  AUTH_TOKEN?: string;
}

interface AlertPayload {
  session_id: string;
  notification_type: string;
  message?: string;
  title?: string;
  cwd?: string;
  timestamp?: string;
}

// --- Rate limiting (per-isolate, best-effort) ---

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Periodic cleanup to prevent unbounded memory growth
  if (rateLimit.size > 1000) {
    for (const [key, entry] of rateLimit) {
      if (now > entry.resetAt) rateLimit.delete(key);
    }
  }

  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/** @internal Exposed for test cleanup only. */
export function _resetRateLimit(): void {
  rateLimit.clear();
}

// --- Utilities ---

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Authentication ---

async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(a)));
  const bHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(b)));
  let diff = aHash.length ^ bHash.length;
  for (let i = 0; i < aHash.length; i++) {
    diff |= aHash[i] ^ bHash[i];
  }
  return diff === 0;
}

async function checkAuth(request: Request, env: Env): Promise<Response | null> {
  if (!env.AUTH_TOKEN) {
    return jsonResponse(
      { error: 'AUTH_TOKEN not configured. Set it via: wrangler secret put AUTH_TOKEN' },
      503,
    );
  }
  const header = request.headers.get('Authorization');
  if (!header || !(await timingSafeCompare(header, `Bearer ${env.AUTH_TOKEN}`))) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  return null;
}

// --- Notification dispatch ---

async function sendWebhook(url: string, payload: AlertPayload): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Claude Code is waiting for your input (${payload.notification_type})`,
        session_id: payload.session_id,
        notification_type: payload.notification_type,
        message: payload.message || '',
        project: payload.cwd || '',
        waiting_since: payload.timestamp || '',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendEmail(
  apiKey: string,
  to: string,
  from: string,
  payload: AlertPayload,
): Promise<boolean> {
  try {
    const projectName = escapeHtml(payload.cwd ? payload.cwd.split('/').pop() || 'unknown' : 'unknown');
    const safeType = escapeHtml(payload.notification_type);
    const safeMessage = payload.message ? escapeHtml(payload.message) : '';
    const safeCwd = escapeHtml(payload.cwd || 'unknown');
    const safeSessionId = escapeHtml(payload.session_id);
    const safeTimestamp = escapeHtml(payload.timestamp || 'unknown');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Claude Code: Action Required — ${projectName}`,
        html: [
          '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">',
          '<h2 style="color: #d97706;">Claude Code is waiting for your input</h2>',
          '<table style="border-collapse: collapse; width: 100%;">',
          `<tr><td style="padding: 8px; font-weight: bold;">Type</td><td style="padding: 8px;">${safeType}</td></tr>`,
          safeMessage
            ? `<tr><td style="padding: 8px; font-weight: bold;">Message</td><td style="padding: 8px;">${safeMessage}</td></tr>`
            : '',
          `<tr><td style="padding: 8px; font-weight: bold;">Project</td><td style="padding: 8px;">${safeCwd}</td></tr>`,
          `<tr><td style="padding: 8px; font-weight: bold;">Session</td><td style="padding: 8px;"><code>${safeSessionId}</code></td></tr>`,
          `<tr><td style="padding: 8px; font-weight: bold;">Waiting since</td><td style="padding: 8px;">${safeTimestamp}</td></tr>`,
          '</table>',
          '<br/>',
          '<p style="color: #6b7280; font-size: 14px;">This alert was sent because Claude has been waiting for more than 1 minute for your response.</p>',
          '</div>',
        ].join('\n'),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// --- Route handlers ---

async function handleAlert(request: Request, env: Env): Promise<Response> {
  const authError = await checkAuth(request, env);
  if (authError) return authError;

  let payload: AlertPayload;
  try {
    payload = (await request.json()) as AlertPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.session_id || !payload.notification_type) {
    return jsonResponse({ error: 'Missing required fields: session_id, notification_type' }, 400);
  }

  const results: Record<string, boolean> = {};

  if (env.WEBHOOK_URL) {
    results.webhook = await sendWebhook(env.WEBHOOK_URL, payload);
  }

  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO) {
    const from = env.ALERT_EMAIL_FROM || 'Claude Alertr <alerts@resend.dev>';
    results.email = await sendEmail(env.RESEND_API_KEY, env.ALERT_EMAIL_TO, from, payload);
  }

  if (Object.keys(results).length === 0) {
    return jsonResponse(
      {
        error: 'No notification channels configured',
        help: 'Set WEBHOOK_URL for webhook alerts, or RESEND_API_KEY + ALERT_EMAIL_TO for email alerts.',
      },
      500,
    );
  }

  return jsonResponse({ ok: true, results });
}

async function handleTest(request: Request, env: Env): Promise<Response> {
  const authError = await checkAuth(request, env);
  if (authError) return authError;

  const testPayload: AlertPayload = {
    session_id: 'test-session',
    notification_type: 'test',
    message: 'This is a test alert from claude-alertr',
    title: 'Test Alert',
    cwd: '/example/project',
    timestamp: new Date().toISOString(),
  };

  const results: Record<string, boolean> = {};

  if (env.WEBHOOK_URL) {
    results.webhook = await sendWebhook(env.WEBHOOK_URL, testPayload);
  }

  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO) {
    const from = env.ALERT_EMAIL_FROM || 'Claude Alertr <alerts@resend.dev>';
    results.email = await sendEmail(env.RESEND_API_KEY, env.ALERT_EMAIL_TO, from, testPayload);
  }

  if (Object.keys(results).length === 0) {
    return jsonResponse(
      {
        error: 'No notification channels configured',
        help: 'Set WEBHOOK_URL for webhook alerts, or RESEND_API_KEY + ALERT_EMAIL_TO for email alerts.',
      },
      500,
    );
  }

  return jsonResponse({ ok: true, test: true, results });
}

// --- Main handler ---

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' && request.method === 'GET') {
      return jsonResponse({ service: 'claude-alertr', status: 'ok' });
    }

    // Rate limit mutation endpoints
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return jsonResponse({ error: 'Rate limit exceeded. Try again later.' }, 429);
    }

    if (url.pathname === '/alert' && request.method === 'POST') {
      return handleAlert(request, env);
    }

    if (url.pathname === '/test' && request.method === 'POST') {
      return handleTest(request, env);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};
