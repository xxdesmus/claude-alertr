import { describe, it, expect, beforeEach } from 'vitest';
import worker, { _resetRateLimit } from './index';
import type { Env } from './index';

function makeRequest(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost${path}`, options);
}

function authRequest(path: string, token: string, options?: RequestInit): Request {
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return new Request(`http://localhost${path}`, { ...options, headers });
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

describe('claude-alertr worker', () => {
  let env: Env;

  beforeEach(() => {
    env = { AUTH_TOKEN: 'test-secret' };
    _resetRateLimit();
  });

  describe('GET /', () => {
    it('returns health check without channel details', async () => {
      const res = await worker.fetch(makeRequest('/'), env, ctx);
      const body = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body.service).toBe('claude-alertr');
      expect(body.status).toBe('ok');
      expect(body).not.toHaveProperty('channels');
    });
  });

  describe('POST /alert', () => {
    it('returns 503 when AUTH_TOKEN is not configured', async () => {
      env = {};
      const res = await worker.fetch(
        authRequest('/alert', 'anything', {
          method: 'POST',
          body: JSON.stringify({ session_id: 'x', notification_type: 'y' }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(503);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('AUTH_TOKEN not configured');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await worker.fetch(
        makeRequest('/alert', {
          method: 'POST',
          body: JSON.stringify({ session_id: 'x', notification_type: 'y' }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(401);
    });

    it('rejects wrong token', async () => {
      const res = await worker.fetch(
        authRequest('/alert', 'wrong-token', {
          method: 'POST',
          body: JSON.stringify({ session_id: 'x', notification_type: 'y' }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(401);
    });

    it('rejects invalid JSON', async () => {
      const res = await worker.fetch(
        authRequest('/alert', 'test-secret', {
          method: 'POST',
          body: 'not json',
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
    });

    it('rejects missing required fields', async () => {
      const res = await worker.fetch(
        authRequest('/alert', 'test-secret', {
          method: 'POST',
          body: JSON.stringify({ foo: 'bar' }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('Missing required fields');
    });

    it('returns 500 when no channels are configured', async () => {
      const res = await worker.fetch(
        authRequest('/alert', 'test-secret', {
          method: 'POST',
          body: JSON.stringify({
            session_id: 'test-123',
            notification_type: 'idle_prompt',
          }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain('No notification channels configured');
    });

    it('allows authorized requests with correct token', async () => {
      const res = await worker.fetch(
        authRequest('/alert', 'test-secret', {
          method: 'POST',
          body: JSON.stringify({
            session_id: 'test-123',
            notification_type: 'idle_prompt',
          }),
        }),
        env,
        ctx,
      );
      // 500 because no channels configured, but NOT 401 or 503
      expect(res.status).toBe(500);
    });
  });

  describe('POST /test', () => {
    it('returns 503 when AUTH_TOKEN not configured', async () => {
      env = {};
      const res = await worker.fetch(
        makeRequest('/test', { method: 'POST' }),
        env,
        ctx,
      );
      expect(res.status).toBe(503);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await worker.fetch(
        makeRequest('/test', { method: 'POST' }),
        env,
        ctx,
      );
      expect(res.status).toBe(401);
    });

    it('returns 500 when no channels configured', async () => {
      const res = await worker.fetch(
        authRequest('/test', 'test-secret', { method: 'POST' }),
        env,
        ctx,
      );
      expect(res.status).toBe(500);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 after exceeding request limit', async () => {
      for (let i = 0; i < 10; i++) {
        await worker.fetch(
          authRequest('/alert', 'test-secret', {
            method: 'POST',
            body: JSON.stringify({ session_id: `s-${i}`, notification_type: 'test' }),
          }),
          env,
          ctx,
        );
      }
      const res = await worker.fetch(
        authRequest('/alert', 'test-secret', {
          method: 'POST',
          body: JSON.stringify({ session_id: 'overflow', notification_type: 'test' }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(429);
    });

    it('does not rate limit GET /', async () => {
      for (let i = 0; i < 15; i++) {
        const res = await worker.fetch(makeRequest('/'), env, ctx);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('404', () => {
    it('returns 404 for unknown paths', async () => {
      const res = await worker.fetch(makeRequest('/unknown'), env, ctx);
      expect(res.status).toBe(404);
    });
  });
});
