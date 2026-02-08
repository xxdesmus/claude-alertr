// Shoutrrr-compatible URL parser and notification dispatchers.
//
// Implements the Shoutrrr URL scheme (https://github.com/containrrr/shoutrrr)
// as native TypeScript fetch() calls, so the Cloudflare Worker can dispatch to
// any supported service without a Go binary or sidecar.

import type { AlertPayload } from './index';

// --- Types ---

export interface ShoutrrrResult {
  service: string;
  success: boolean;
}

export interface ParsedUrl {
  scheme: string;
  user: string;
  password: string;
  host: string;
  port: string;
  path: string;
  query: Record<string, string>;
}

// --- URL parsing ---

/**
 * Parse a Shoutrrr URL without lowercasing the hostname (unlike the standard
 * URL class). This matters because several services encode tokens in the
 * hostname position.
 */
export function parseUrl(raw: string): ParsedUrl | null {
  const schemeMatch = raw.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (!schemeMatch) return null;

  const scheme = schemeMatch[1].toLowerCase();
  let rest = raw.slice(schemeMatch[0].length);

  // Extract query string
  const query: Record<string, string> = {};
  const qIdx = rest.indexOf('?');
  if (qIdx !== -1) {
    const qs = rest.slice(qIdx + 1);
    rest = rest.slice(0, qIdx);
    for (const pair of qs.split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx !== -1) {
        query[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1));
      } else {
        query[decodeURIComponent(pair)] = '';
      }
    }
  }

  // Extract userinfo (everything before the last @ that precedes the first /)
  let user = '';
  let password = '';
  const slashBoundary = rest.indexOf('/');
  const authority = slashBoundary !== -1 ? rest.slice(0, slashBoundary) : rest;
  const atIdx = authority.lastIndexOf('@');
  if (atIdx !== -1) {
    const userinfo = rest.slice(0, atIdx);
    rest = rest.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(':');
    if (colonIdx !== -1) {
      user = decodeURIComponent(userinfo.slice(0, colonIdx));
      password = decodeURIComponent(userinfo.slice(colonIdx + 1));
    } else {
      user = decodeURIComponent(userinfo);
    }
  }

  // Split host[:port] from path
  let host = rest;
  let path = '';
  let port = '';
  const slashIdx = rest.indexOf('/');
  if (slashIdx !== -1) {
    host = rest.slice(0, slashIdx);
    path = rest.slice(slashIdx);
  }
  const portMatch = host.match(/:(\d+)$/);
  if (portMatch) {
    port = portMatch[1];
    host = host.slice(0, -portMatch[0].length);
  }

  return { scheme, user, password, host, port, path, query };
}

/** Split a whitespace-separated string of Shoutrrr URLs into an array. */
export function parseShoutrrrUrls(input: string): string[] {
  return input.split(/[\s]+/).filter(Boolean);
}

// --- Message formatting ---

function formatMessage(payload: AlertPayload): { title: string; body: string } {
  const project = payload.cwd ? payload.cwd.split('/').pop() || 'unknown' : 'unknown';

  const title = payload.hostname
    ? `Claude Code: Action Required \u2014 ${project} (${payload.hostname})`
    : `Claude Code: Action Required \u2014 ${project}`;

  const hostPrefix = payload.hostname ? `[${payload.hostname}] ` : '';
  const lines: string[] = [
    `${hostPrefix}Claude Code is waiting for your input (${payload.notification_type})`,
  ];
  if (payload.details) lines.push(payload.details);
  if (payload.message) lines.push(payload.message);
  lines.push(`Project: ${payload.cwd || 'unknown'}`);
  if (payload.timestamp) lines.push(`Waiting since: ${payload.timestamp}`);

  return { title, body: lines.join('\n') };
}

// --- Service adapters ---

async function sendSlack(parsed: ParsedUrl, payload: AlertPayload): Promise<boolean> {
  // slack://[botname@]token-a/token-b/token-c
  const tokenA = parsed.host;
  if (!tokenA || !parsed.path) return false;

  const webhookUrl = `https://hooks.slack.com/services/${tokenA}${parsed.path}`;
  const { title, body } = formatMessage(payload);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `*${title}*\n${body}` }),
  });
  return response.ok;
}

async function sendDiscord(parsed: ParsedUrl, payload: AlertPayload): Promise<boolean> {
  // discord://token@id
  const webhookId = parsed.host;
  const token = parsed.user;
  if (!webhookId || !token) return false;

  const webhookUrl = `https://discord.com/api/webhooks/${webhookId}/${token}`;
  const { title, body } = formatMessage(payload);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `**${title}**\n${body}` }),
  });
  return response.ok;
}

async function sendTelegram(parsed: ParsedUrl, payload: AlertPayload): Promise<boolean> {
  // telegram://bottoken@telegram?chats=chatId1,chatId2
  // Bot tokens contain a colon (e.g. 123456:ABC-DEF), so reconstruct from user:password
  const token = parsed.password ? `${parsed.user}:${parsed.password}` : parsed.user;
  const chats = parsed.query.chats?.split(',').filter(Boolean) || [];
  if (!token || chats.length === 0) return false;

  const { body } = formatMessage(payload);
  const results = await Promise.allSettled(
    chats.map((chat) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat.trim(), text: body }),
      }),
    ),
  );
  return results.every((r) => r.status === 'fulfilled' && r.value.ok);
}

async function sendNtfy(parsed: ParsedUrl, payload: AlertPayload): Promise<boolean> {
  // ntfy://[user:pass@]host[:port]/topic
  const topic = parsed.path.split('/').filter(Boolean)[0];
  if (!parsed.host || !topic) return false;

  const portSuffix = parsed.port ? `:${parsed.port}` : '';
  const url = `https://${parsed.host}${portSuffix}/${topic}`;
  const { title, body } = formatMessage(payload);

  const headers: Record<string, string> = { Title: title };
  if (parsed.user && parsed.password) {
    headers.Authorization = `Basic ${btoa(`${parsed.user}:${parsed.password}`)}`;
  }

  const response = await fetch(url, { method: 'POST', headers, body });
  return response.ok;
}

async function sendPushover(parsed: ParsedUrl, payload: AlertPayload): Promise<boolean> {
  // pushover://shoutrrr:apiToken@userKey/?devices=dev1,dev2
  const apiToken = parsed.password;
  const userKey = parsed.host;
  if (!apiToken || !userKey) return false;

  const { title, body } = formatMessage(payload);
  const reqBody: Record<string, string> = {
    token: apiToken,
    user: userKey,
    title,
    message: body,
  };
  if (parsed.query.devices) {
    reqBody.device = parsed.query.devices;
  }

  const response = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  });
  return response.ok;
}

async function sendGotify(parsed: ParsedUrl, payload: AlertPayload): Promise<boolean> {
  // gotify://host[:port]/token
  const token = parsed.path.split('/').filter(Boolean)[0];
  if (!parsed.host || !token) return false;

  const portSuffix = parsed.port ? `:${parsed.port}` : '';
  const url = `https://${parsed.host}${portSuffix}/message?token=${encodeURIComponent(token)}`;
  const { title, body } = formatMessage(payload);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message: body, priority: 5 }),
  });
  return response.ok;
}

async function sendGeneric(parsed: ParsedUrl, payload: AlertPayload): Promise<boolean> {
  // generic://host[:port]/path
  if (!parsed.host) return false;

  const portSuffix = parsed.port ? `:${parsed.port}` : '';
  const url = `https://${parsed.host}${portSuffix}${parsed.path}`;
  const { title, body } = formatMessage(payload);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (parsed.user && parsed.password) {
    headers.Authorization = `Basic ${btoa(`${parsed.user}:${parsed.password}`)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title,
      message: body,
      session_id: payload.session_id,
      notification_type: payload.notification_type,
      details: payload.details || '',
      project: payload.cwd || '',
      hostname: payload.hostname || '',
      waiting_since: payload.timestamp || '',
    }),
  });
  return response.ok;
}

// --- Adapter registry ---

const adapters: Record<
  string,
  (parsed: ParsedUrl, payload: AlertPayload) => Promise<boolean>
> = {
  slack: sendSlack,
  discord: sendDiscord,
  telegram: sendTelegram,
  ntfy: sendNtfy,
  pushover: sendPushover,
  gotify: sendGotify,
  generic: sendGeneric,
};

export const SUPPORTED_SERVICES = Object.keys(adapters);

/**
 * Dispatch a notification to all configured Shoutrrr URLs.
 * Each URL is dispatched independently; one failure does not block others.
 */
export async function dispatchShoutrrr(
  urls: string[],
  payload: AlertPayload,
): Promise<ShoutrrrResult[]> {
  return Promise.all(
    urls.map(async (rawUrl): Promise<ShoutrrrResult> => {
      const parsed = parseUrl(rawUrl);
      if (!parsed) return { service: 'unknown', success: false };

      const adapter = adapters[parsed.scheme];
      if (!adapter) return { service: parsed.scheme, success: false };

      try {
        const success = await adapter(parsed, payload);
        return { service: parsed.scheme, success };
      } catch {
        return { service: parsed.scheme, success: false };
      }
    }),
  );
}
