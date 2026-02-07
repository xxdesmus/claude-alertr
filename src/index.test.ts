import { describe, it, expect, beforeEach } from 'vitest';
import worker from './index';
import type { Env } from './index';

function makeRequest(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost${path}`, options);
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

describe('claude-alertr worker', () => {
  let env: Env;

  beforeEach(() => {
    env = {};
  });

  describe('GET /', () => {
    it('returns status with no channels configured', async () => {
      const res = await worker.fetch(makeRequest('/'), env, ctx);
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body.service).toBe('claude-alertr');
      expect(body.status).toBe('ok');
      expect(body.channels).toEqual({ webhook: false, email: false });
    });

    it('reports webhook as configured when WEBHOOK_URL is set', async () => {
      env.WEBHOOK_URL = 'https://hooks.example.com/test';
      const res = await worker.fetch(makeRequest('/'), env, ctx);
      const body = await res.json() as Record<string, unknown>;

      expect((body.channels as Record<string, boolean>).webhook).toBe(true);
      expect((body.channels as Record<string, boolean>).email).toBe(false);
    });

    it('reports email as configured when both keys are set', async () => {
      env.RESEND_API_KEY = 'test-key';
      env.ALERT_EMAIL_TO = 'user@example.com';
      const res = await worker.fetch(makeRequest('/'), env, ctx);
      const body = await res.json() as Record<string, unknown>;

      expect((body.channels as Record<string, boolean>).email).toBe(true);
    });
  });

  describe('POST /alert', () => {
    it('rejects invalid JSON', async () => {
      const res = await worker.fetch(
        makeRequest('/alert', { method: 'POST', body: 'not json' }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
    });

    it('rejects missing required fields', async () => {
      const res = await worker.fetch(
        makeRequest('/alert', {
          method: 'POST',
          body: JSON.stringify({ foo: 'bar' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toContain('Missing required fields');
    });

    it('returns 500 when no channels are configured', async () => {
      const res = await worker.fetch(
        makeRequest('/alert', {
          method: 'POST',
          body: JSON.stringify({
            session_id: 'test-123',
            notification_type: 'idle_prompt',
          }),
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(500);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toContain('No notification channels configured');
    });

    it('rejects unauthorized requests when AUTH_TOKEN is set', async () => {
      env.AUTH_TOKEN = 'secret-token';
      const res = await worker.fetch(
        makeRequest('/alert', {
          method: 'POST',
          body: JSON.stringify({
            session_id: 'test-123',
            notification_type: 'idle_prompt',
          }),
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(401);
    });

    it('allows authorized requests when AUTH_TOKEN matches', async () => {
      env.AUTH_TOKEN = 'secret-token';
      const res = await worker.fetch(
        makeRequest('/alert', {
          method: 'POST',
          body: JSON.stringify({
            session_id: 'test-123',
            notification_type: 'idle_prompt',
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer secret-token',
          },
        }),
        env,
        ctx,
      );
      // Will be 500 because no channels configured, but not 401
      expect(res.status).toBe(500);
    });
  });

  describe('POST /test', () => {
    it('returns 500 when no channels configured', async () => {
      const res = await worker.fetch(
        makeRequest('/test', { method: 'POST' }),
        env,
        ctx,
      );
      expect(res.status).toBe(500);
    });

    it('rejects unauthorized test requests', async () => {
      env.AUTH_TOKEN = 'secret';
      const res = await worker.fetch(
        makeRequest('/test', { method: 'POST' }),
        env,
        ctx,
      );
      expect(res.status).toBe(401);
    });
  });

  describe('CORS', () => {
    it('handles OPTIONS preflight', async () => {
      const res = await worker.fetch(
        makeRequest('/alert', { method: 'OPTIONS' }),
        env,
        ctx,
      );
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('404', () => {
    it('returns 404 for unknown paths', async () => {
      const res = await worker.fetch(makeRequest('/unknown'), env, ctx);
      expect(res.status).toBe(404);
    });
  });
});
