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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function checkAuth(request: Request, env: Env): boolean {
  if (!env.AUTH_TOKEN) return true;
  const header = request.headers.get('Authorization');
  return header === `Bearer ${env.AUTH_TOKEN}`;
}

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
    const projectName = payload.cwd ? payload.cwd.split('/').pop() : 'unknown';
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
          `<tr><td style="padding: 8px; font-weight: bold;">Type</td><td style="padding: 8px;">${payload.notification_type}</td></tr>`,
          payload.message
            ? `<tr><td style="padding: 8px; font-weight: bold;">Message</td><td style="padding: 8px;">${payload.message}</td></tr>`
            : '',
          `<tr><td style="padding: 8px; font-weight: bold;">Project</td><td style="padding: 8px;">${payload.cwd || 'unknown'}</td></tr>`,
          `<tr><td style="padding: 8px; font-weight: bold;">Session</td><td style="padding: 8px;"><code>${payload.session_id}</code></td></tr>`,
          `<tr><td style="padding: 8px; font-weight: bold;">Waiting since</td><td style="padding: 8px;">${payload.timestamp || 'unknown'}</td></tr>`,
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

async function handleAlert(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

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
  if (!checkAuth(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return jsonResponse({
        service: 'claude-alertr',
        status: 'ok',
        channels: {
          webhook: !!env.WEBHOOK_URL,
          email: !!(env.RESEND_API_KEY && env.ALERT_EMAIL_TO),
        },
      });
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
