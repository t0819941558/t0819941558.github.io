import { describe, expect, it } from 'vitest';
import worker from './index';

const env = {
  SITE_ORIGIN: 'https://t0819941558.github.io',
  GITHUB_OAUTH_ID: 'test-client',
  GITHUB_OAUTH_SECRET: 'test-secret',
  OAUTH_STATE_SECRET: 'test-state-secret-with-enough-entropy',
  VIEW_HASH_SECRET: 'test-view-secret-with-enough-entropy',
  ALLOWED_GITHUB_LOGIN: 't0819941558',
} as unknown as Parameters<typeof worker.fetch>[1];

const context = {
  waitUntil() {},
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext;

describe('Worker routes', () => {
  it('reports health with site CORS headers', async () => {
    const request = new Request('https://worker.example/health', {
      headers: { Origin: env.SITE_ORIGIN },
    });
    const response = await worker.fetch(request, env, context);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(env.SITE_ORIGIN);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('answers browser preflight requests', async () => {
    const request = new Request('https://worker.example/api/views/welcome', {
      method: 'OPTIONS',
      headers: { Origin: env.SITE_ORIGIN },
    });
    const response = await worker.fetch(request, env, context);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('rejects invalid view slugs before touching the database', async () => {
    const request = new Request('https://worker.example/api/views/%E4%B8%AD%E6%96%87');
    const response = await worker.fetch(request, env, context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid slug' });
  });

  it('requests only the public repository OAuth scope', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/auth?provider=github'),
      env,
      context,
    );
    const location = new URL(response.headers.get('Location') ?? '');

    expect(response.status).toBe(302);
    expect(location.searchParams.get('scope')).toBe('public_repo');
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
  });

  it('returns 404 for unknown routes', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/unknown'),
      env,
      context,
    );

    expect(response.status).toBe(404);
  });
});
