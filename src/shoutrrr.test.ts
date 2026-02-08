import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseUrl,
  parseShoutrrrUrls,
  dispatchShoutrrr,
  SUPPORTED_SERVICES,
} from './shoutrrr';
import type { AlertPayload } from './index';

// --- URL parser tests ---

describe('parseUrl', () => {
  it('returns null for invalid input', () => {
    expect(parseUrl('')).toBeNull();
    expect(parseUrl('not-a-url')).toBeNull();
    expect(parseUrl('://missing-scheme')).toBeNull();
  });

  it('parses a Slack URL', () => {
    const parsed = parseUrl('slack://T00000000/B00000000/XXXXXXXXXXXX');
    expect(parsed).toEqual({
      scheme: 'slack',
      user: '',
      password: '',
      host: 'T00000000',
      port: '',
      path: '/B00000000/XXXXXXXXXXXX',
      query: {},
    });
  });

  it('parses a Slack URL with botname', () => {
    const parsed = parseUrl('slack://mybot@T00000000/B00000000/XXXXXXXXXXXX');
    expect(parsed).toEqual({
      scheme: 'slack',
      user: 'mybot',
      password: '',
      host: 'T00000000',
      port: '',
      path: '/B00000000/XXXXXXXXXXXX',
      query: {},
    });
  });

  it('parses a Discord URL', () => {
    const parsed = parseUrl('discord://webhooktoken@123456789');
    expect(parsed).toEqual({
      scheme: 'discord',
      user: 'webhooktoken',
      password: '',
      host: '123456789',
      port: '',
      path: '',
      query: {},
    });
  });

  it('parses a Telegram URL with colon in token', () => {
    const parsed = parseUrl('telegram://123456:ABCdef@telegram?chats=@mychannel,12345');
    expect(parsed).toEqual({
      scheme: 'telegram',
      user: '123456',
      password: 'ABCdef',
      host: 'telegram',
      port: '',
      path: '',
      query: { chats: '@mychannel,12345' },
    });
  });

  it('parses an Ntfy URL without auth', () => {
    const parsed = parseUrl('ntfy://ntfy.sh/mytopic');
    expect(parsed).toEqual({
      scheme: 'ntfy',
      user: '',
      password: '',
      host: 'ntfy.sh',
      port: '',
      path: '/mytopic',
      query: {},
    });
  });

  it('parses an Ntfy URL with auth', () => {
    const parsed = parseUrl('ntfy://admin:s3cret@ntfy.example.com:8080/alerts');
    expect(parsed).toEqual({
      scheme: 'ntfy',
      user: 'admin',
      password: 's3cret',
      host: 'ntfy.example.com',
      port: '8080',
      path: '/alerts',
      query: {},
    });
  });

  it('parses a Pushover URL', () => {
    const parsed = parseUrl('pushover://shoutrrr:apptoken123@userkey456/?devices=phone,tablet');
    expect(parsed).toEqual({
      scheme: 'pushover',
      user: 'shoutrrr',
      password: 'apptoken123',
      host: 'userkey456',
      port: '',
      path: '/',
      query: { devices: 'phone,tablet' },
    });
  });

  it('parses a Gotify URL', () => {
    const parsed = parseUrl('gotify://gotify.example.com/Axxxxxxxxxx');
    expect(parsed).toEqual({
      scheme: 'gotify',
      user: '',
      password: '',
      host: 'gotify.example.com',
      port: '',
      path: '/Axxxxxxxxxx',
      query: {},
    });
  });

  it('parses a Gotify URL with port', () => {
    const parsed = parseUrl('gotify://gotify.local:8080/mytoken');
    expect(parsed).toEqual({
      scheme: 'gotify',
      user: '',
      password: '',
      host: 'gotify.local',
      port: '8080',
      path: '/mytoken',
      query: {},
    });
  });

  it('parses a generic URL', () => {
    const parsed = parseUrl('generic://hooks.example.com/webhook/abc');
    expect(parsed).toEqual({
      scheme: 'generic',
      user: '',
      password: '',
      host: 'hooks.example.com',
      port: '',
      path: '/webhook/abc',
      query: {},
    });
  });

  it('preserves case in hostname (unlike URL class)', () => {
    const parsed = parseUrl('slack://T0NUK5G23/B0NUK5F3E/bJFbQpQd2lHcYCNzF4CjqxPi');
    expect(parsed!.host).toBe('T0NUK5G23');
  });

  it('decodes percent-encoded userinfo', () => {
    const parsed = parseUrl('generic://my%40user:p%40ss@example.com/hook');
    expect(parsed!.user).toBe('my@user');
    expect(parsed!.password).toBe('p@ss');
  });
});

// --- parseShoutrrrUrls tests ---

describe('parseShoutrrrUrls', () => {
  it('splits space-separated URLs', () => {
    expect(parseShoutrrrUrls('slack://a/b/c discord://t@id')).toEqual([
      'slack://a/b/c',
      'discord://t@id',
    ]);
  });

  it('splits newline-separated URLs', () => {
    expect(parseShoutrrrUrls('slack://a/b/c\ndiscord://t@id')).toEqual([
      'slack://a/b/c',
      'discord://t@id',
    ]);
  });

  it('handles mixed whitespace', () => {
    expect(parseShoutrrrUrls('  slack://a/b/c \n\n discord://t@id  ')).toEqual([
      'slack://a/b/c',
      'discord://t@id',
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(parseShoutrrrUrls('')).toEqual([]);
    expect(parseShoutrrrUrls('   ')).toEqual([]);
  });

  it('returns single URL in array', () => {
    expect(parseShoutrrrUrls('ntfy://ntfy.sh/topic')).toEqual(['ntfy://ntfy.sh/topic']);
  });
});

// --- SUPPORTED_SERVICES tests ---

describe('SUPPORTED_SERVICES', () => {
  it('includes all expected services', () => {
    expect(SUPPORTED_SERVICES).toContain('slack');
    expect(SUPPORTED_SERVICES).toContain('discord');
    expect(SUPPORTED_SERVICES).toContain('telegram');
    expect(SUPPORTED_SERVICES).toContain('ntfy');
    expect(SUPPORTED_SERVICES).toContain('pushover');
    expect(SUPPORTED_SERVICES).toContain('gotify');
    expect(SUPPORTED_SERVICES).toContain('generic');
    expect(SUPPORTED_SERVICES).toHaveLength(7);
  });
});

// --- dispatchShoutrrr tests ---

describe('dispatchShoutrrr', () => {
  const testPayload: AlertPayload = {
    session_id: 'test-123',
    notification_type: 'permission_prompt',
    message: 'Test message',
    cwd: '/home/user/project',
    hostname: 'dev-machine',
    timestamp: '2025-01-01T00:00:00Z',
    details: 'Bash: git push',
  };

  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('dispatches to Slack with correct webhook URL', async () => {
    const results = await dispatchShoutrrr(['slack://T00/B00/XXX'], testPayload);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'slack', success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/XXX',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('dispatches to Discord with correct webhook URL', async () => {
    const results = await dispatchShoutrrr(['discord://mytoken@12345'], testPayload);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'discord', success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/12345/mytoken',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('dispatches to Telegram for each chat', async () => {
    const results = await dispatchShoutrrr(
      ['telegram://111:AAA@telegram?chats=@chan1,123'],
      testPayload,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'telegram', success: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.telegram.org/bot111:AAA/sendMessage',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('dispatches to Ntfy with auth header', async () => {
    const results = await dispatchShoutrrr(
      ['ntfy://user:pass@ntfy.sh/alerts'],
      testPayload,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'ntfy', success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://ntfy.sh/alerts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${btoa('user:pass')}`,
        }),
      }),
    );
  });

  it('dispatches to Pushover', async () => {
    const results = await dispatchShoutrrr(
      ['pushover://shoutrrr:apptoken@userkey'],
      testPayload,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'pushover', success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.pushover.net/1/messages.json',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('dispatches to Gotify', async () => {
    const results = await dispatchShoutrrr(
      ['gotify://gotify.example.com/Atoken123'],
      testPayload,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'gotify', success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://gotify.example.com/message?token='),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('dispatches to generic webhook', async () => {
    const results = await dispatchShoutrrr(
      ['generic://hooks.example.com/webhook/abc'],
      testPayload,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'generic', success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://hooks.example.com/webhook/abc',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('dispatches to multiple services in parallel', async () => {
    const results = await dispatchShoutrrr(
      ['slack://T00/B00/XXX', 'discord://token@id'],
      testPayload,
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ service: 'slack', success: true });
    expect(results[1]).toEqual({ service: 'discord', success: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns success:false for unknown service schemes', async () => {
    const results = await dispatchShoutrrr(['foobar://test'], testPayload);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'foobar', success: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns success:false for invalid URLs', async () => {
    const results = await dispatchShoutrrr(['not-a-url'], testPayload);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'unknown', success: false });
  });

  it('returns success:false when fetch fails', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));
    const results = await dispatchShoutrrr(['slack://T00/B00/XXX'], testPayload);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'slack', success: false });
  });

  it('returns success:false when fetch returns non-ok', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });
    const results = await dispatchShoutrrr(['slack://T00/B00/XXX'], testPayload);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ service: 'slack', success: false });
  });

  it('isolates failures — one service failing does not block others', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });
    const results = await dispatchShoutrrr(
      ['slack://T00/B00/XXX', 'discord://token@id'],
      testPayload,
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ service: 'slack', success: false });
    expect(results[1]).toEqual({ service: 'discord', success: true });
  });

  it('returns empty array for empty URL list', async () => {
    const results = await dispatchShoutrrr([], testPayload);
    expect(results).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
